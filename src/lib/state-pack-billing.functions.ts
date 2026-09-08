import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { StripeEnv } from './stripe.server';
import { statePackProration } from './state-pack-proration';

function environment(value: string): StripeEnv {
  if (value !== 'live' && value !== 'sandbox') throw new Error('Invalid billing environment.');
  return value;
}

export const getStatePackBilling = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: { environment: StripeEnv; sessionId?: string | undefined }) => {
    if (data.sessionId && !/^cs_(?:live|test)_[A-Za-z0-9]+$/.test(data.sessionId)) throw new Error('Invalid checkout session.');
    return { ...data, environment: environment(data.environment) };
  })
  .handler(async ({ context, data }) => {
    const service = await import('./state-pack-billing.server');
    const db = service.stateBillingDb();
    const { data: members, error } = await db.from('enterprise_license_members').select('license_id').eq('user_id', context.userId).eq('role','admin');
    if (error) throw new Error('Could not load billing authority.');
    const ids = (members ?? []).map(row => row.license_id as string);
    if (!ids.length) return { administrator: false, licenses: [], availableStates: [] as string[], checkoutPending: false };
    let checkoutPending = false;
    if (data.sessionId) {
      const { data: order, error: orderError } = await db.from('enterprise_state_pack_orders').select('license_id').eq('stripe_session_id', data.sessionId).eq('environment',data.environment).maybeSingle();
      if (orderError || !order || !ids.includes(order.license_id)) throw new Error('This checkout does not belong to your organization.');
      checkoutPending = !(await service.fulfillStateCheckout(data.sessionId,data.environment));
    }
    const availableStates = await service.availableStatePacks();
    const licenses = [];
    for (const id of ids) {
      try {
        const account = await service.stateBillingAccount(context.userId,id,data.environment);
        const quote = statePackProration(account.termStart,account.termEnd,Math.floor(Date.now()/1000));
        const { data: orders, error: ordersError } = await db.from('enterprise_state_pack_orders').select('state_code,status,term_end,amount_cents').eq('license_id',id).eq('environment',data.environment).order('created_at',{ascending:false});
        if (ordersError) throw new Error('Purchase history could not be loaded.');
        licenses.push({ id, number: String(account.license.license_number ?? id), states: account.license.licensed_state_codes as string[], quote, orders: (orders ?? []).map(row => ({ state: String(row.state_code), status: String(row.status), termEnd: String(row.term_end), amountCents: Number(row.amount_cents) })), unavailableReason: null as string|null });
      } catch (error) {
        licenses.push({ id, number: id, states: [] as string[], quote: null, orders: [] as {state:string;status:string;termEnd:string;amountCents:number}[], unavailableReason: error instanceof Error ? error.message : 'This license is not eligible for additional states.' });
      }
    }
    return { administrator: true, licenses, availableStates, checkoutPending };
  });

export const purchaseStatePack = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .validator((data: { licenseId: string; stateCode: string; environment: StripeEnv }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.licenseId) || !/^[A-Z]{2}$/.test(data.stateCode)) throw new Error('Invalid state selection.');
    return { ...data, environment: environment(data.environment) };
  })
  .handler(async ({ context, data }) => {
    const { beginStateCheckout } = await import('./state-pack-billing.server');
    return beginStateCheckout(context.userId,data.licenseId,data.stateCode,data.environment);
  });
