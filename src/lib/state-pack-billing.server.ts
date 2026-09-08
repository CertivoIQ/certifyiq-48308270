import { createClient } from '@supabase/supabase-js';
import { createStripeClient, type StripeEnv } from './stripe.server';
import { statePackProration } from './state-pack-proration';

export function stateBillingDb() {
  return createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_SERVICE_ROLE_KEY']!, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function stateBillingAccount(userId: string, licenseId: string, environment: StripeEnv) {
  const db = stateBillingDb();
  const { data: member, error: memberError } = await db.from('enterprise_license_members').select('license_id').eq('license_id', licenseId).eq('user_id', userId).eq('role', 'admin').maybeSingle();
  if (memberError || !member) throw new Error('Only this organization’s license administrator can purchase state packs.');
  const { data: license, error } = await db.from('enterprise_licenses').select('*').eq('id', licenseId).single();
  if (error || !license || license.license_kind !== 'multifamily_enterprise' || license.status !== 'active' || !license.paid_through || Date.parse(license.paid_through) <= Date.now()) throw new Error('An active Multifamily Enterprise license is required.');
  const stripe = createStripeClient(environment);
  if (!license.stripe_schedule_id || !license.stripe_customer_id) throw new Error('The annual contract is not available for state additions.');
  const schedule = await stripe.subscriptionSchedules.retrieve(license.stripe_schedule_id);
  const customerId = typeof schedule.customer === 'string' ? schedule.customer : schedule.customer.id;
  if (schedule.livemode !== (environment === 'live') || customerId !== license.stripe_customer_id || schedule.status !== 'active') throw new Error('The billing contract could not be verified.');
  const termStart = schedule.phases[0]?.start_date;
  const termEnd = schedule.phases.at(-1)?.end_date;
  if (!termStart || !termEnd) throw new Error('The annual renewal date is unavailable.');
  return { db, stripe, license, termStart, termEnd };
}

export async function availableStatePacks() {
  const { data, error } = await stateBillingDb().from('state_rule_pack_releases').select('state_code,status,approved_at,effective_from,failed_fixture_count,unresolved_conflict_count,validated_rule_count,created_at').lte('effective_from', new Date().toISOString()).order('effective_from', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw new Error('State availability could not be verified.');
  const seen = new Set<string>();
  return (data ?? []).filter(row => { if (seen.has(row.state_code)) return false; seen.add(row.state_code); return row.status === 'validated' && !!row.approved_at && row.failed_fixture_count === 0 && row.unresolved_conflict_count === 0 && row.validated_rule_count > 0; }).map(row => row.state_code as string);
}

export async function beginStateCheckout(userId: string, licenseId: string, stateCode: string, environment: StripeEnv) {
  const { db, stripe, license, termStart, termEnd } = await stateBillingAccount(userId, licenseId, environment);
  if (!(await availableStatePacks()).includes(stateCode)) throw new Error('This state pack is not yet available for purchase.');
  if (license.licensed_state_codes.includes(stateCode)) throw new Error('This state is already included in your license.');
  const now = Math.floor(Date.now() / 1000);
  const quote = statePackProration(termStart, termEnd, now);
  const termEndIso = new Date(termEnd * 1000).toISOString();
  const { data: previous, error: previousError } = await db.from('enterprise_state_pack_orders').select('*').eq('license_id', licenseId).eq('state_code', stateCode).eq('environment', environment).eq('term_end', termEndIso).in('status', ['pending','paid']).maybeSingle();
  if (previousError) throw new Error('Could not check for an existing state purchase.');
  let order = previous;
  if (order?.status === 'paid') throw new Error('This state is already purchased.');
  if (order && !order.stripe_session_id) {
    const sessions = await stripe.checkout.sessions.list({ customer: order.stripe_customer_id, created: { gte: Math.floor(Date.parse(order.quoted_at)/1000)-60, lte: Math.floor(Date.parse(order.checkout_expires_at)/1000) }, limit: 100 });
    const recovered = sessions.data.find(session=>session.metadata?.['order_id']===order.id);
    if (recovered) {
      const { error } = await db.from('enterprise_state_pack_orders').update({stripe_session_id:recovered.id}).eq('id',order.id).is('stripe_session_id',null);
      if(error) throw new Error('Could not recover the previous checkout.');
      order.stripe_session_id=recovered.id;
    } else if (sessions.has_more) {
      throw new Error('Your previous checkout is still being reconciled. Please retry later.');
    } else if (Date.parse(order.checkout_expires_at)<Date.now()+1_800_000) {
      const { error } = await db.from('enterprise_state_pack_orders').update({status:'expired'}).eq('id',order.id).eq('status','pending');
      if(error) throw new Error('Could not refresh the previous checkout.');
      order=null;
    }
  }
  if (order?.stripe_session_id) {
    const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
    if (session.status === 'open' && session.url) return { url: session.url };
    if (session.status === 'complete') {
      if (session.payment_status === 'paid') await fulfillStateCheckout(session.id, environment);
      throw new Error('Payment has been submitted. Refresh billing to see its status.');
    }
    const { error: expiredError } = await db.from('enterprise_state_pack_orders').update({ status: 'expired' }).eq('id', order.id).eq('status', 'pending');
    if (expiredError) throw new Error('Could not refresh the previous checkout.');
    order = null;
  }
  if (!order) {
    const { data, error } = await db.from('enterprise_state_pack_orders').insert({ license_id: licenseId, purchaser_id: userId, state_code: stateCode, environment, term_start: new Date(termStart*1000).toISOString(), term_end: termEndIso, quoted_at: new Date(now*1000).toISOString(), amount_cents: quote.amountCents, stripe_customer_id: license.stripe_customer_id, checkout_expires_at: new Date((now+3600)*1000).toISOString() }).select('*').single();
    if (error) throw new Error('A state purchase is already being prepared. Refresh billing and try again.');
    order = data;
  }
  if (!order) throw new Error('Could not prepare state purchase.');
  // Recover a session after a lost API response using the same order key.
  const session = await stripe.checkout.sessions.create({
    mode: 'payment', customer: order.stripe_customer_id, client_reference_id: order.id,
    expires_at: Math.floor(Date.parse(order.checkout_expires_at)/1000),
    success_url: 'https://certivoiq.com/billing?state_checkout={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://certivoiq.com/billing',
    payment_method_types: ['card', 'us_bank_account'],
    metadata: { purchase_type: 'enterprise_state_pack', order_id: order.id },
    payment_intent_data: { metadata: { purchase_type: 'enterprise_state_pack', order_id: order.id } },
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: order.amount_cents, product_data: { name: `Multifamily Enterprise — ${stateCode} state pack`, description: `Prorated through ${termEndIso.slice(0,10)}. Annual price $65,000. This addition ends with your current contract and does not renew separately.` } } }],
  }, { idempotencyKey: `state-pack-${order.id}` });
  const { error: saveError } = await db.from('enterprise_state_pack_orders').update({ stripe_session_id: session.id, checkout_url: session.url }).eq('id', order.id).eq('status','pending');
  if (saveError || !session.url) throw new Error('Checkout is being prepared. Please retry.');
  return { url: session.url };
}

/** Both webhook and authenticated return reconciliation use Stripe's paid state. */
export async function fulfillStateCheckout(sessionId: string, environment: StripeEnv) {
  const stripe = createStripeClient(environment);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.metadata?.['purchase_type'] !== 'enterprise_state_pack') return false;
  if (session.mode !== 'payment' || session.payment_status !== 'paid') return false;
  if (session.livemode !== (environment === 'live') || session.currency !== 'usd') throw new Error('Payment environment mismatch.');
  const orderId = session.metadata['order_id'];
  const customer = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const intent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
  if (!orderId || !customer || !intent || !session.amount_total) throw new Error('Incomplete state payment.');
  const db = stateBillingDb();
  // The session can complete before its creation response is saved locally.
  const { data: order, error: orderError } = await db.from('enterprise_state_pack_orders').select('id,stripe_session_id,stripe_customer_id').eq('id', orderId).single();
  if (orderError || !order || order.stripe_customer_id !== customer) throw new Error('Unknown state purchase.');
  if (!order.stripe_session_id) {
    const { error } = await db.from('enterprise_state_pack_orders').update({ stripe_session_id: session.id }).eq('id', orderId).is('stripe_session_id', null);
    if (error) throw new Error('Could not reconcile state checkout.');
  }
  const { error } = await db.rpc('fulfill_enterprise_state_pack', { target_order: orderId, session_id: session.id, payment_intent_id: intent, customer_id: customer, paid_cents: session.amount_total, payment_environment: environment });
  if (error) throw new Error('State payment is confirmed; access activation is pending.');
  return true;
}
