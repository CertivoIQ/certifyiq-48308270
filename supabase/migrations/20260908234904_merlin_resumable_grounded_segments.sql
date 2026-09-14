
CREATE TABLE private.merlin_segment_progress (
 document_id uuid NOT NULL REFERENCES public.merlin_procedure_documents(id),
 source_sha256 text NOT NULL,
 parser_version integer NOT NULL DEFAULT 4 CHECK(parser_version=4),
 segments jsonb NOT NULL CHECK(jsonb_typeof(segments)='array' AND jsonb_array_length(segments) BETWEEN 1 AND 100),
 next_segment integer NOT NULL DEFAULT 0,
 procedures jsonb NOT NULL DEFAULT '[]', evidence jsonb NOT NULL, responses jsonb NOT NULL DEFAULT '[]',
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(document_id,source_sha256),
 CHECK(next_segment BETWEEN 0 AND jsonb_array_length(segments))
);
ALTER TABLE private.merlin_segment_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.merlin_segment_progress FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON private.merlin_segment_progress TO service_role;

CREATE FUNCTION public.merlin_segment_state(_job_id uuid,_worker text,_segments jsonb DEFAULT NULL,_evidence jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $f$
DECLARE j public.operations_jobs; d public.merlin_procedure_documents; p private.merlin_segment_progress;
BEGIN
 IF current_user NOT IN ('postgres','service_role') THEN RAISE EXCEPTION 'service role required'; END IF;
 SELECT * INTO j FROM public.operations_jobs WHERE id=_job_id FOR UPDATE;
 IF j.status IS DISTINCT FROM 'running' OR j.lease_owner IS DISTINCT FROM _worker OR j.lease_expires_at<=now()
 OR j.job_type<>'merlin_state_procedure_crawl' OR j.risk_tier<>'tier_2_prepare' THEN RAISE EXCEPTION 'LEASE_LOST'; END IF;
 SELECT * INTO d FROM public.merlin_procedure_documents WHERE id=(j.payload->>'procedure_document_id')::uuid FOR UPDATE;
 IF d.validated_at IS NOT NULL OR d.status NOT IN ('queued','failed') OR d.source_sha256 IS DISTINCT FROM j.payload->>'source_sha256'
 OR NOT EXISTS(SELECT 1 FROM public.state_rule_source_candidates c WHERE c.id=d.source_candidate_id AND c.source_url=d.source_url
 AND c.source_sha256=d.source_sha256 AND c.agent_verification_status='verified' AND c.exact_bytes_captured
 AND coalesce(c.verification_evidence->>'validation_evidence_eligible','true')<>'false') THEN RAISE EXCEPTION 'SOURCE_CHANGED_OR_NOT_ELIGIBLE'; END IF;
 SELECT * INTO p FROM private.merlin_segment_progress WHERE document_id=d.id AND source_sha256=d.source_sha256;
 IF p.document_id IS NULL AND _segments IS NOT NULL THEN
  IF _evidence->>'sha256' IS DISTINCT FROM d.source_sha256 OR pg_column_size(_segments)>2000000 THEN RAISE EXCEPTION 'INVALID_SEGMENT_EVIDENCE'; END IF;
  INSERT INTO private.merlin_segment_progress(document_id,source_sha256,segments,evidence) VALUES(d.id,d.source_sha256,_segments,_evidence) RETURNING * INTO p;
  UPDATE public.merlin_procedure_documents SET source_snapshot=source_snapshot||jsonb_build_object('native_capture',_evidence),updated_at=now() WHERE id=d.id;
 END IF;
 IF p.document_id IS NULL THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('index',p.next_segment,'total',jsonb_array_length(p.segments),'segment',p.segments->p.next_segment,'evidence',p.evidence);
END $f$;
REVOKE ALL ON FUNCTION public.merlin_segment_state(uuid,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.merlin_segment_state(uuid,text,jsonb,jsonb) TO service_role;

CREATE FUNCTION public.merlin_commit_segment(_job_id uuid,_worker text,_index integer,_procedures jsonb,_response jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $f$
DECLARE state jsonb; j public.operations_jobs; p private.merlin_segment_progress; evidence jsonb; outcome text; item jsonb; citation jsonb;
BEGIN
 state:=public.merlin_segment_state(_job_id,_worker);
 SELECT * INTO j FROM public.operations_jobs WHERE id=_job_id FOR UPDATE;
 SELECT * INTO p FROM private.merlin_segment_progress WHERE document_id=(j.payload->>'procedure_document_id')::uuid AND source_sha256=j.payload->>'source_sha256' FOR UPDATE;
 IF p.document_id IS NULL OR p.next_segment<>_index OR _index>=jsonb_array_length(p.segments) THEN RAISE EXCEPTION 'SEGMENT_OUT_OF_ORDER'; END IF;
 IF jsonb_typeof(_procedures) IS DISTINCT FROM 'array' OR jsonb_array_length(_procedures)>3 THEN RAISE EXCEPTION 'INVALID_PROCEDURES'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(_procedures) LOOP
  IF jsonb_typeof(item->'citations') IS DISTINCT FROM 'array' OR jsonb_array_length(item->'citations')=0 THEN RAISE EXCEPTION 'CITATIONS_REQUIRED'; END IF;
  FOR citation IN SELECT value FROM jsonb_array_elements(item->'citations') LOOP
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p.segments->_index) s WHERE s->>'page'=citation->>'page_or_locator' AND s->>'excerpt'=citation->>'excerpt') THEN RAISE EXCEPTION 'CITATION_NOT_IN_SOURCE'; END IF;
  END LOOP;
 END LOOP;
 IF jsonb_array_length(p.procedures)+jsonb_array_length(_procedures)>100 THEN RAISE EXCEPTION 'PROCEDURE_REVIEW_LIMIT'; END IF;
 UPDATE private.merlin_segment_progress SET next_segment=next_segment+1,procedures=procedures||_procedures,
 responses=responses||jsonb_build_array(_response),updated_at=now()
 WHERE document_id=p.document_id AND source_sha256=p.source_sha256 RETURNING * INTO p;
 INSERT INTO public.operations_audit_events(actor_kind,action,target_type,target_id,correlation_id,detail)
 VALUES('worker','merlin.native.segment_saved','operations_job',j.id::text,j.correlation_id,
 jsonb_build_object('segment',_index,'total',jsonb_array_length(p.segments),'procedure_count',jsonb_array_length(_procedures)));
 IF p.next_segment=jsonb_array_length(p.segments) THEN
  IF jsonb_array_length(p.procedures)=0 THEN
   PERFORM public.merlin_fail_native_preparation(j.id,_worker,'NO_EXPLICIT_PROCEDURES');
   outcome:='review_no_explicit_procedures';
  ELSE
   evidence:=p.evidence||jsonb_build_object('provider','groq','model',_response->>'model','response_id',_response->>'response_id',
    'responses',p.responses,'segments_processed',p.next_segment,'segments_total',jsonb_array_length(p.segments),'coverage','all_text_segments_processed_draft_procedures_partial','native_preparation_version',4);
   IF NOT public.merlin_finish_native_preparation(j.id,_worker,jsonb_build_object('procedures',p.procedures,
    'document_ambiguity_flags',jsonb_build_array('All text segments processed; at most three draft procedures per segment. Table/image interpretation, semantic citation support, cross-page context and complete coverage require independent validation.')),evidence) THEN RAISE EXCEPTION 'LEASE_LOST'; END IF;
   outcome:='pending_independent_validation';
  END IF;
 ELSE
  UPDATE public.operations_jobs SET status='queued',scheduled_at=now()+interval '1 hour',attempts=greatest(0,attempts-1),
   lease_owner=NULL,lease_expires_at=NULL,last_error=NULL,updated_at=now() WHERE id=j.id;
  outcome:='segment_saved';
 END IF;
 RETURN jsonb_build_object('status',outcome,'segments_processed',p.next_segment,'segments_total',jsonb_array_length(p.segments),'procedure_count',jsonb_array_length(p.procedures));
END $f$;
REVOKE ALL ON FUNCTION public.merlin_commit_segment(uuid,text,integer,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.merlin_commit_segment(uuid,text,integer,jsonb,jsonb) TO service_role;
