begin;

select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  first_claim text;
  concurrent_replay text;
  completed_replay text;
  retry_claim text;
begin
  first_claim := public.claim_enterprise_billing_event(
    'evt_gate3_claim_test',
    'in_gate3_claim_test',
    null,
    'invoice.paid',
    'paid',
    1250000,
    1250000,
    'usd'
  );
  if first_claim <> 'claimed' then
    raise exception 'first event was not claimed: %', first_claim;
  end if;

  concurrent_replay := public.claim_enterprise_billing_event(
    'evt_gate3_claim_test',
    'in_gate3_claim_test',
    null,
    'invoice.paid',
    'paid',
    1250000,
    1250000,
    'usd'
  );
  if concurrent_replay <> 'in_progress' then
    raise exception 'concurrent replay was not bounded: %', concurrent_replay;
  end if;

  update public.enterprise_invoice_events
  set processing_state = 'completed', processed_at = now(), updated_at = now()
  where stripe_event_id = 'evt_gate3_claim_test';

  completed_replay := public.claim_enterprise_billing_event(
    'evt_gate3_claim_test',
    'in_gate3_claim_test',
    null,
    'invoice.paid',
    'paid',
    1250000,
    1250000,
    'usd'
  );
  if completed_replay <> 'duplicate' then
    raise exception 'completed replay was not rejected: %', completed_replay;
  end if;

  insert into public.enterprise_invoice_events (
    stripe_event_id, event_type, action, processing_state, attempt_count, last_error
  ) values (
    'evt_gate3_retry_test', 'invoice.payment_failed', 'exception', 'failed', 1, 'test failure'
  );

  retry_claim := public.claim_enterprise_billing_event(
    'evt_gate3_retry_test',
    null,
    null,
    'invoice.payment_failed',
    'open',
    null,
    null,
    'usd'
  );
  if retry_claim <> 'claimed' then
    raise exception 'failed event was not recoverable: %', retry_claim;
  end if;
  if not exists (
    select 1 from public.enterprise_invoice_events
    where stripe_event_id = 'evt_gate3_retry_test'
      and processing_state = 'processing'
      and attempt_count = 2
      and last_error is null
  ) then
    raise exception 'retry claim state was not updated correctly';
  end if;
end;
$$;

rollback;

