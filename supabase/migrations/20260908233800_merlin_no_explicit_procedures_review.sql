CREATE OR REPLACE FUNCTION public.merlin_fail_native_preparation(_job_id uuid, _worker text, _reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
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
 ELSIF _reason IN ('NO_EXPLICIT_PROCEDURES','PDF_REQUIRES_SEGMENTATION','PDF_REQUIRES_OCR','SOURCE_TOO_LARGE','SOURCE_NOT_PDF','SOURCE_SHA256_MISMATCH','SOURCE_NOT_ELIGIBLE','SOURCE_URL_NOT_ALLOWED','SOURCE_HOST_NOT_ALLOWED') THEN
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
END $function$
