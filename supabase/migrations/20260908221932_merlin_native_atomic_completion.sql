
CREATE OR REPLACE FUNCTION public.merlin_finish_native_preparation(_job_id uuid,_worker text,_extraction jsonb,_evidence jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE j public.operations_jobs; d public.merlin_procedure_documents; c public.state_rule_source_candidates; p jsonb; total integer;
BEGIN
 IF current_user NOT IN ('postgres','service_role') THEN RAISE EXCEPTION 'service role required'; END IF;
 SELECT * INTO j FROM public.operations_jobs WHERE id=_job_id FOR UPDATE;
 IF j.id IS NULL OR j.status<>'running' OR j.lease_owner IS DISTINCT FROM _worker OR j.lease_expires_at<=now()
  OR j.risk_tier<>'tier_2_prepare' OR j.job_type<>'merlin_state_procedure_crawl' THEN RETURN false; END IF;
 SELECT * INTO d FROM public.merlin_procedure_documents WHERE id=(j.payload->>'procedure_document_id')::uuid FOR UPDATE;
 SELECT * INTO c FROM public.state_rule_source_candidates WHERE id=d.source_candidate_id FOR SHARE;
 IF d.id IS NULL OR d.validated_at IS NOT NULL OR d.status NOT IN ('queued','failed')
  OR c.agent_verification_status<>'verified' OR NOT c.exact_bytes_captured
  OR c.source_sha256 IS DISTINCT FROM d.source_sha256 OR c.source_url IS DISTINCT FROM d.source_url
  OR _evidence->>'sha256' IS DISTINCT FROM d.source_sha256
  OR coalesce(c.verification_evidence->>'validation_evidence_eligible','true')='false'
 THEN RAISE EXCEPTION 'SOURCE_CHANGED_OR_NOT_ELIGIBLE'; END IF;
 IF jsonb_typeof(_extraction->'procedures') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'INVALID_PROCEDURES'; END IF;
 total:=jsonb_array_length(_extraction->'procedures');
 IF total<1 OR total>100 THEN RAISE EXCEPTION 'INVALID_PROCEDURE_COUNT'; END IF;
 IF EXISTS(SELECT 1 FROM public.merlin_procedures WHERE document_id=d.id AND status<>'pending_independent_validation')
 THEN RAISE EXCEPTION 'PRESERVE_REVIEWED_PROCEDURES'; END IF;
 DELETE FROM public.merlin_procedures WHERE document_id=d.id AND status='pending_independent_validation';
 FOR p IN SELECT value FROM jsonb_array_elements(_extraction->'procedures')
 LOOP
  IF jsonb_typeof(p->'citations') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'citations')=0 THEN RAISE EXCEPTION 'CITATIONS_REQUIRED'; END IF;
  INSERT INTO public.merlin_procedures(document_id,source_candidate_id,state_code,program,procedure_key,
   category,title,summary,steps,responsible_roles,triggering_events,required_inputs,required_evidence,
   deadlines,exceptions,citations,ambiguity_flags,extraction_confidence,status,usable_for_compliance_determination,
   source_sha256,source_effective_date)
  VALUES(d.id,d.source_candidate_id,d.state_code,d.program,p->>'procedure_key',p->>'category',p->>'title',p->>'summary',
   p->'steps',p->'responsible_roles',p->'triggering_events',p->'required_inputs',p->'required_evidence',
   p->'deadlines',p->'exceptions',p->'citations',p->'ambiguity_flags',(p->>'extraction_confidence')::numeric,
   'pending_independent_validation',false,d.source_sha256,d.source_effective_date);
 END LOOP;
 UPDATE public.merlin_procedure_documents SET status='pending_independent_validation',
  authority_status='NON_AUTHORITATIVE_PENDING_INDEPENDENT_VALIDATION',usable_for_compliance_determination=false,
  extraction_model=_evidence->>'model',extraction_response_id=_evidence->>'response_id',
  extracted_procedure_count=total,crawl_attempts=crawl_attempts+1,last_crawled_at=now(),last_error=NULL,
  source_snapshot=source_snapshot||jsonb_build_object('native_capture',_evidence),
  updated_at=now() WHERE id=d.id;
 INSERT INTO public.merlin_procedure_extraction_events(document_id,job_id,event_type,source_sha256,model,response_id,actor_kind,detail)
 VALUES(d.id,j.id,'extracted',d.source_sha256,_evidence->>'model',_evidence->>'response_id','worker',
  _evidence||jsonb_build_object('procedure_count',total,'document_ambiguity_flags',_extraction->'document_ambiguity_flags'));
 IF NOT public.operations_complete_job(j.id,_worker,jsonb_build_object('status','pending_independent_validation','procedure_count',total,'native_preparation',true))
 THEN RAISE EXCEPTION 'LEASE_LOST'; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.merlin_finish_native_preparation(uuid,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.merlin_finish_native_preparation(uuid,text,jsonb,jsonb) TO service_role;
