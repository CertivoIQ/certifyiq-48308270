CREATE TABLE private.merlin_provider_state (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),blocked_until timestamptz,
 error_code text,checked_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.merlin_provider_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.merlin_provider_state FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON private.merlin_provider_state TO service_role;
CREATE OR REPLACE FUNCTION public.merlin_record_provider_probe(_available boolean,_code text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF current_user NOT IN ('postgres','service_role') THEN RAISE EXCEPTION 'service role required'; END IF;
 INSERT INTO private.merlin_provider_state(singleton,blocked_until,error_code,checked_at)
 VALUES(true,CASE WHEN _available THEN NULL ELSE now()+interval '1 hour' END,CASE WHEN _available THEN NULL ELSE left(_code,80) END,now())
 ON CONFLICT(singleton) DO UPDATE SET blocked_until=excluded.blocked_until,error_code=excluded.error_code,checked_at=excluded.checked_at;
END $$;
REVOKE ALL ON FUNCTION public.merlin_record_provider_probe(boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.merlin_record_provider_probe(boolean,text) TO service_role;
CREATE OR REPLACE FUNCTION public.merlin_claim_native_preparation(_worker text,_capture_only boolean DEFAULT false)
RETURNS public.operations_jobs LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE claimed public.operations_jobs; expired record;
BEGIN
 IF current_user NOT IN ('postgres','service_role') THEN RAISE EXCEPTION 'service role required'; END IF;
 IF _worker NOT LIKE 'merlin-native:%' THEN RAISE EXCEPTION 'native lease identity required'; END IF;
 PERFORM pg_advisory_xact_lock(48308270,910);
 IF NOT _capture_only AND EXISTS(SELECT 1 FROM private.merlin_provider_state WHERE blocked_until>now()) THEN RETURN NULL; END IF;
 FOR expired IN SELECT * FROM public.operations_jobs WHERE job_type='merlin_state_procedure_crawl'
  AND status='running' AND lease_owner LIKE 'merlin-native:%' AND lease_expires_at<=now() FOR UPDATE
 LOOP
  PERFORM public.operations_fail_job(expired.id,expired.lease_owner,
    '{"code":"NATIVE_LEASE_EXPIRED","message":"Preparation worker timed out; bounded retry"}'::jsonb);
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.operations_jobs WHERE job_type='merlin_state_procedure_crawl' AND status='running')
  OR (SELECT count(*) FROM private.merlin_native_attempts WHERE created_at>=now()-interval '24 hours')>=24
 THEN RETURN NULL; END IF;
 SELECT j.* INTO claimed FROM public.operations_jobs j
 JOIN public.merlin_procedure_documents d ON j.payload->>'procedure_document_id'=d.id::text
 JOIN public.state_rule_source_candidates c ON c.id=d.source_candidate_id
 WHERE j.job_type='merlin_state_procedure_crawl' AND j.worker='certivoiq-merlin-procedure'
  AND j.risk_tier='tier_2_prepare' AND j.status IN ('queued','retry_wait')
  AND (j.scheduled_at<=now() OR j.scheduled_at='infinity'::timestamptz)
  AND j.attempts<least(j.max_attempts,3)
  AND d.status IN ('queued','failed') AND d.validated_at IS NULL
  AND d.program IN ('LIHTC','LIHTC_LAYERED_STATE_COMPLIANCE','HUD_MULTIFAMILY')
  AND d.content_type='application/pdf'
  AND (NOT _capture_only OR d.source_snapshot->'native_capture'->>'sha256' IS DISTINCT FROM d.source_sha256)
  AND c.agent_verification_status='verified' AND c.exact_bytes_captured
  AND c.source_sha256=d.source_sha256 AND c.source_url=d.source_url
  AND j.payload->>'source_sha256'=d.source_sha256
  AND j.payload->>'source_candidate_id'=c.id::text
  AND coalesce(c.verification_evidence->>'validation_evidence_eligible','true')<>'false'
  AND coalesce(c.verification_evidence->>'evidence_kind','')<>'discovery_page_only'
 ORDER BY CASE WHEN j.status='retry_wait' THEN 0 ELSE 1 END,j.created_at,j.id
 FOR UPDATE OF j SKIP LOCKED LIMIT 1;
 IF claimed.id IS NULL THEN RETURN NULL; END IF;
 UPDATE public.operations_jobs SET status='running',lease_owner=_worker,lease_expires_at=now()+interval '5 minutes',
  heartbeat_at=now(),started_at=coalesce(started_at,now()),scheduled_at=now(),attempts=attempts+1,
  max_attempts=least(max_attempts,3),updated_at=now() WHERE id=claimed.id RETURNING * INTO claimed;
 INSERT INTO private.merlin_native_attempts(job_id) VALUES(claimed.id);
 INSERT INTO public.operations_audit_events(actor_kind,action,target_type,target_id,correlation_id,detail)
 VALUES('worker','merlin.native.claimed','operations_job',claimed.id::text,claimed.correlation_id,
  jsonb_build_object('worker',_worker,'attempt',claimed.attempts,'daily_attempt_cap',24));
 RETURN claimed;
END $$;
REVOKE ALL ON FUNCTION public.merlin_claim_native_preparation(text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.merlin_claim_native_preparation(text,boolean) TO service_role;



CREATE OR REPLACE FUNCTION public.merlin_fail_native_preparation(_job_id uuid,_worker text,_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE j public.operations_jobs;
BEGIN
 IF current_user NOT IN ('postgres','service_role') THEN RAISE EXCEPTION 'service role required'; END IF;
 SELECT * INTO j FROM public.operations_jobs WHERE id=_job_id FOR UPDATE;
 IF j.id IS NULL OR j.status<>'running' OR j.lease_owner IS DISTINCT FROM _worker
  OR _worker NOT LIKE 'merlin-native:%' OR j.job_type<>'merlin_state_procedure_crawl'
  OR j.risk_tier<>'tier_2_prepare' THEN RETURN false; END IF;
 IF _reason LIKE 'MODEL_HTTP_429%' OR _reason LIKE 'MODEL_HTTP_401%' OR _reason LIKE 'MODEL_HTTP_403%' THEN
  PERFORM public.merlin_record_provider_probe(false,_reason);
  UPDATE public.operations_jobs SET status='retry_wait',scheduled_at=now()+interval '1 hour',
   attempts=greatest(0,attempts-1),lease_owner=NULL,lease_expires_at=NULL,updated_at=now(),
   last_error=jsonb_build_object('code',_reason,'provider_blocked',true) WHERE id=j.id;
  INSERT INTO public.operations_audit_events(actor_kind,action,target_type,target_id,correlation_id,severity,detail)
  VALUES('worker','merlin.native.provider_deferred','operations_job',j.id::text,j.correlation_id,'warning',jsonb_build_object('code',_reason));
 ELSIF _reason IN ('SOURCE_TOO_LARGE','SOURCE_NOT_PDF','SOURCE_SHA256_MISMATCH','SOURCE_NOT_ELIGIBLE','SOURCE_URL_NOT_ALLOWED','SOURCE_HOST_NOT_ALLOWED') THEN
  UPDATE public.operations_jobs SET status='quarantined',last_error=jsonb_build_object('code',_reason,'retryable',false),
   lease_owner=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=j.id;
  INSERT INTO public.operations_incidents(severity,status,job_id,correlation_id,summary,detail,retry_count)
  VALUES('medium','open',j.id,j.correlation_id,'Merlin source requires preparation review',
   jsonb_build_object('code',_reason,'retryable',false,'queue','compliance','no_rule_activation',true),j.attempts);
  INSERT INTO public.operations_audit_events(actor_kind,action,target_type,target_id,correlation_id,severity,detail)
  VALUES('worker','merlin.native.source_blocked','operations_job',j.id::text,j.correlation_id,'warning',
   jsonb_build_object('code',_reason,'retryable',false));
 ELSE
  PERFORM public.operations_fail_job(j.id,_worker,jsonb_build_object('code','MERLIN_NATIVE_PREPARATION_FAILED','message',left(_reason,500)));
 END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.merlin_fail_native_preparation(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.merlin_fail_native_preparation(uuid,text,text) TO service_role;