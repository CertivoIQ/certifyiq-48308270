CREATE OR REPLACE FUNCTION private.certivoiq_absence_watchdog()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE item record; incident_id uuid; active_keys text[] := ARRAY[]::text[];
        observed_at timestamptz := clock_timestamp(); findings integer := 0;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'postgres scheduler required'; END IF;
  IF NOT pg_try_advisory_xact_lock(48308270, 908) THEN
    RETURN jsonb_build_object('skipped','already_running');
  END IF;
  FOR item IN
    SELECT 'overdue_jobs' AS key, 'high' AS severity,
      'Operations jobs overdue by more than two hours' AS summary, 'operations' AS queue,
      count(*) AS affected, min(scheduled_at) AS oldest
      FROM public.operations_jobs
      WHERE status IN ('queued','retry_wait') AND scheduled_at < observed_at - interval '2 hours'
    UNION ALL
    SELECT 'expired_leases','high','Operations worker leases expired','operations',
      count(*),min(lease_expires_at) FROM public.operations_jobs
      WHERE status='running' AND lease_expires_at < observed_at - interval '5 minutes'
    UNION ALL
    SELECT 'held_backlog','medium','Operations backlog explicitly held beyond one day','compliance',
      count(*),min(created_at) FROM public.operations_jobs
      WHERE status IN ('queued','retry_wait') AND scheduled_at='infinity'::timestamptz
        AND created_at < observed_at - interval '1 day'
    UNION ALL
    SELECT 'support_delivery','high','Support notification delivery requires attention','operations',
      count(*),min(created_at) FROM public.support_notification_outbox
      WHERE status NOT IN ('sent','cancelled')
        AND created_at < observed_at - interval '30 minutes'
    UNION ALL
    SELECT 'unassigned_support','high','Human-required support has no assigned owner','support',
      count(*),min(created_at) FROM public.support_cases
      WHERE human_required AND assigned_to IS NULL AND status NOT IN ('resolved','closed')
        AND subject NOT ILIKE '[SYSTEM TEST]%'
        AND created_at < observed_at - interval '1 hour'
    UNION ALL
    SELECT 'quarantined_jobs','high','Operations jobs require recovery review','operations',
      count(*),min(updated_at) FROM public.operations_jobs WHERE status IN ('quarantined','failed')
  LOOP
    IF item.affected = 0 THEN CONTINUE; END IF;
    findings := findings + 1;
    active_keys := array_append(active_keys,item.key);
    SELECT id INTO incident_id FROM public.operations_incidents
      WHERE detail->>'monitor'='absence_watchdog_v1' AND detail->>'key'=item.key
        AND status IN ('open','acknowledged') ORDER BY first_seen_at LIMIT 1 FOR UPDATE;
    IF incident_id IS NULL THEN
      INSERT INTO public.operations_incidents(severity,status,correlation_id,summary,detail)
      VALUES(item.severity,'open',gen_random_uuid(),item.summary,
        jsonb_build_object('monitor','absence_watchdog_v1','key',item.key,
          'queue',item.queue,'affected',item.affected,'oldest',item.oldest,
          'owner_assignment_required',true,'observation_only',true));
    ELSE
      UPDATE public.operations_incidents SET last_seen_at=observed_at,
        detail=detail || jsonb_build_object('affected',item.affected,'oldest',item.oldest)
        WHERE id=incident_id;
    END IF;
  END LOOP;
  UPDATE public.operations_incidents SET status='resolved',resolved_at=observed_at,
    last_seen_at=observed_at,
    resolution=jsonb_build_object('method','automatic_observation','reason','condition_no_longer_present')
    WHERE detail->>'monitor'='absence_watchdog_v1' AND status IN ('open','acknowledged')
      AND NOT (detail->>'key'=ANY(active_keys));
  RETURN jsonb_build_object('checked_at',observed_at,'active_conditions',findings,
    'keys',active_keys,'observation_only',true);
END;
$function$
