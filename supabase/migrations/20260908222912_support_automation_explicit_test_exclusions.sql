CREATE TABLE private.support_automation_exclusions (
 case_id uuid PRIMARY KEY REFERENCES public.support_cases(id) ON DELETE CASCADE,
 reason text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.support_automation_exclusions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.support_automation_exclusions FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO private.support_automation_exclusions(case_id,reason)
SELECT id,'Existing controlled support-notification system fixture, verified during September 8 audit'
FROM public.support_cases
WHERE subject='[SYSTEM TEST] Support notification end-to-end verification'
 AND description='Controlled production verification created by the approved CertivoIQ support notification rollout.';
CREATE OR REPLACE FUNCTION private.certivoiq_support_preparation_tick()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE c record; fingerprint text; prepared jsonb; inserted_note uuid; prepared_count integer:=0; source_text text;
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'postgres scheduler required'; END IF;
 IF NOT pg_try_advisory_xact_lock(48308270,909) THEN RETURN '{"skipped":"already_running"}'::jsonb; END IF;
 FOR c IN
  SELECT s.*,pn.public_notes
  FROM public.support_cases s
  CROSS JOIN LATERAL (SELECT coalesce(string_agg(n.note,E'\n' ORDER BY n.created_at,n.id),'') public_notes
   FROM public.support_case_notes n WHERE n.case_id=s.id AND NOT n.internal) pn
  WHERE s.status NOT IN ('closed','resolved') AND NOT EXISTS(SELECT 1 FROM private.support_automation_exclusions x WHERE x.case_id=s.id)
   AND NOT EXISTS (SELECT 1 FROM private.support_preparation_receipts r WHERE r.case_id=s.id
    AND r.input_sha256=encode(sha256(convert_to(concat_ws(E'\n',s.subject,s.description,pn.public_notes,s.triage_category),'UTF8')),'hex'))
  ORDER BY s.updated_at,s.id LIMIT 100
 FOR UPDATE OF s SKIP LOCKED
 LOOP
  source_text:=concat_ws(E'\n',c.subject,c.description,c.public_notes,c.triage_category);
  fingerprint:=encode(sha256(convert_to(source_text,'UTF8')),'hex');
  IF EXISTS(SELECT 1 FROM private.support_preparation_receipts r WHERE r.case_id=c.id AND r.input_sha256=fingerprint) THEN CONTINUE; END IF;
  prepared:=private.prepare_support_case_draft(source_text);
  INSERT INTO public.support_case_notes(case_id,author_id,author_name,note,internal)
   VALUES(c.id,NULL,'SupportIQ — automated preparation',
    'INTERNAL DRAFT — human review required; not sent.'||E'\n\n'||
    'Category: '||(prepared->>'category')||E'\n'||
    'Suggested reply:'||E'\n'||(prepared->>'draft_reply')||E'\n\n'||
    'Investigation checklist:'||E'\n'||(prepared->>'investigation')||E'\n\n'||
    'Coverage: '||CASE WHEN c.assigned_to IS NULL THEN 'No reviewer assigned.' ELSE 'Review with the assigned case owner.' END||E'\n'||
    'Prepared from current case text and public notes; verify against the latest case before use. Template: support-prep-v1.',
    true) RETURNING id INTO inserted_note;
  INSERT INTO private.support_preparation_receipts(case_id,input_sha256,note_id) VALUES(c.id,fingerprint,inserted_note);
  prepared_count:=prepared_count+1;
 END LOOP;
 RETURN jsonb_build_object('prepared',prepared_count,'sent',0,'cases_closed',0);
END $$;
REVOKE ALL ON FUNCTION private.certivoiq_support_preparation_tick() FROM PUBLIC,anon,authenticated,service_role;

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
        AND NOT EXISTS(SELECT 1 FROM private.support_automation_exclusions x WHERE x.case_id=public.support_cases.id)
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
