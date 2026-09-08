BEGIN;
DO $t$
DECLARE j public.operations_jobs; s jsonb; r jsonb; proc jsonb; rejected boolean:=false; owner text:='merlin-native:segment-test';
BEGIN
 SELECT * INTO j FROM public.merlin_claim_native_preparation(owner,true);
 IF j.id IS NULL THEN RAISE EXCEPTION 'fixture missing'; END IF;
 s:=public.merlin_segment_state(j.id,owner,
 '[ [{"id":"p1w0","page":1,"excerpt":"Owners must notify tenants before changing allowances."}], [{"id":"p2w0","page":2,"excerpt":"Retain written documentation of all tenant notices."}] ]',
 jsonb_build_object('sha256',j.payload->>'source_sha256','storage_bucket','merlin-source-snapshots'));
 IF (s->>'index')::int<>0 OR (s->>'total')::int<>2 THEN RAISE EXCEPTION 'initial state'; END IF;
 proc:='[{"procedure_key":"segment_0_procedure_0","category":"draft_operating_procedure","title":"Notify tenants","summary":"Notify before changing allowances.","steps":[],"responsible_roles":[],"triggering_events":[],"required_inputs":[],"required_evidence":[],"deadlines":[],"exceptions":[],"ambiguity_flags":[],"extraction_confidence":0,"citations":[{"page_or_locator":"1","section":"PDF text","excerpt":"Owners must notify tenants before changing allowances."}]}]';
 BEGIN
  PERFORM public.merlin_commit_segment(j.id,owner,0,jsonb_set(proc,'{0,citations,0,excerpt}','"Invented quotation that does not appear."'),'{"model":"test"}');
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='CITATION_NOT_IN_SOURCE' THEN rejected:=true; ELSE RAISE; END IF; END;
 IF NOT rejected THEN RAISE EXCEPTION 'invented citation accepted'; END IF;
 r:=public.merlin_commit_segment(j.id,owner,0,proc,'{"model":"test","response_id":"fixture"}');
 IF r->>'status'<>'segment_saved' OR (SELECT status FROM public.operations_jobs WHERE id=j.id)<>'queued' THEN RAISE EXCEPTION 'partial completed'; END IF;
 IF EXISTS(SELECT 1 FROM public.merlin_procedures WHERE document_id=(j.payload->>'procedure_document_id')::uuid) THEN RAISE EXCEPTION 'partial visible'; END IF;
 UPDATE public.operations_jobs SET status='running',lease_owner=owner,lease_expires_at=now()+interval '5 minutes' WHERE id=j.id;
 rejected:=false;
 BEGIN PERFORM public.merlin_commit_segment(j.id,owner,0,proc,'{"model":"test"}');
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='SEGMENT_OUT_OF_ORDER' THEN rejected:=true; ELSE RAISE; END IF; END;
 IF NOT rejected THEN RAISE EXCEPTION 'duplicate advanced'; END IF;
 rejected:=false;
 BEGIN
  UPDATE public.merlin_procedure_documents SET source_sha256=repeat('0',64) WHERE id=(j.payload->>'procedure_document_id')::uuid;
  PERFORM public.merlin_segment_state(j.id,owner);
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='SOURCE_CHANGED_OR_NOT_ELIGIBLE' THEN rejected:=true; ELSE RAISE; END IF; END;
 IF NOT rejected THEN RAISE EXCEPTION 'changed source accepted'; END IF;
 s:=public.merlin_segment_state(j.id,owner);
 IF s->>'index'<>'1' THEN RAISE EXCEPTION 'resume lost'; END IF;
 r:=public.merlin_commit_segment(j.id,owner,1,'[]','{"model":"test","response_id":"fixture2"}');
 IF r->>'status'<>'pending_independent_validation' THEN RAISE EXCEPTION 'final missing'; END IF;
 IF EXISTS(SELECT 1 FROM public.merlin_procedures WHERE document_id=(j.payload->>'procedure_document_id')::uuid AND (usable_for_compliance_determination OR status<>'pending_independent_validation')) THEN RAISE EXCEPTION 'authority changed'; END IF;
 IF has_function_privilege('authenticated','public.merlin_commit_segment(uuid,text,integer,jsonb,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'customer privilege'; END IF;
END $t$;
ROLLBACK;
SELECT 'PASS: resume, duplicate prevention, exact citations, atomic finalization, non-authoritative results, restricted privileges' verification;