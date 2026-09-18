BEGIN;
DO $t$
DECLARE j public.operations_jobs; next_job public.operations_jobs; e jsonb; doc_id uuid;
BEGIN
 SELECT * INTO j FROM public.merlin_claim_native_preparation('merlin-native:capture-test',true);
 IF j.id IS NULL THEN RAISE EXCEPTION 'fixture missing'; END IF;
 doc_id:=(j.payload->>'procedure_document_id')::uuid;
 e:=jsonb_build_object('sha256',j.payload->>'source_sha256','storage_bucket','fixture','storage_path','fixture.pdf');
 IF NOT public.merlin_capture_native_preparation(j.id,'merlin-native:capture-test',e) THEN RAISE EXCEPTION 'capture failed'; END IF;
 IF (SELECT status FROM public.operations_jobs WHERE id=j.id)<>'queued' THEN RAISE EXCEPTION 'falsely completed'; END IF;
 IF EXISTS(SELECT 1 FROM public.merlin_procedures WHERE document_id=doc_id) THEN RAISE EXCEPTION 'procedures fabricated'; END IF;
 SELECT * INTO next_job FROM public.merlin_claim_native_preparation('merlin-native:capture-second',true);
 IF next_job.id=j.id THEN RAISE EXCEPTION 'source capture repeated'; END IF;
END $t$;
ROLLBACK;
SELECT 'PASS: source-only stage preserves queued extraction, inserts no procedures, and skips already-prepared source; fixtures rolled back' verification;