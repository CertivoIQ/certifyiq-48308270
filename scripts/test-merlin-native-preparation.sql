BEGIN;
DO $t$
DECLARE j public.operations_jobs; next_job public.operations_jobs; token text; proc jsonb; evidence jsonb; n integer;
BEGIN
 PERFORM public.merlin_record_provider_probe(true,NULL);
 token:=repeat('a',64);
 INSERT INTO private.merlin_dispatch_tokens(token_hash,expires_at) VALUES(encode(sha256(convert_to(token,'UTF8')),'hex'),now()+interval '1 minute');
 IF NOT public.merlin_consume_dispatch_token(token) OR public.merlin_consume_dispatch_token(token) THEN RAISE EXCEPTION 'token replay'; END IF;
 INSERT INTO private.merlin_dispatch_tokens(token_hash,expires_at) VALUES(encode(sha256(convert_to(repeat('b',64),'UTF8')),'hex'),now()-interval '1 minute');
 IF public.merlin_consume_dispatch_token(repeat('b',64)) THEN RAISE EXCEPTION 'expired token'; END IF;
 SELECT * INTO j FROM public.merlin_claim_native_preparation('merlin-native:rollback-test');
 IF j.id IS NULL THEN RAISE EXCEPTION 'no eligible fixture'; END IF;
 SELECT * INTO next_job FROM public.merlin_claim_native_preparation('merlin-native:second-test');
 IF next_job.id IS NOT NULL THEN RAISE EXCEPTION 'parallel claim'; END IF;
 IF j.risk_tier<>'tier_2_prepare' THEN RAISE EXCEPTION 'risk tier'; END IF;
 proc:='{"document_ambiguity_flags":["synthetic transaction fixture"],"procedures":[{"procedure_key":"test_fixture","category":"review","title":"Synthetic fixture","summary":"Test only","steps":[],"responsible_roles":[],"triggering_events":[],"required_inputs":[],"required_evidence":[],"deadlines":[],"exceptions":[],"citations":[{"page_or_locator":"1","section":"fixture","excerpt":"Test only"}],"ambiguity_flags":[],"extraction_confidence":0.5}]}'::jsonb;
 evidence:=jsonb_build_object('sha256',j.payload->>'source_sha256','model','fixture','response_id','fixture');
 IF public.merlin_finish_native_preparation(j.id,'wrong-worker',proc,evidence) THEN RAISE EXCEPTION 'wrong lease'; END IF;
 IF NOT public.merlin_finish_native_preparation(j.id,'merlin-native:rollback-test',proc,evidence) THEN RAISE EXCEPTION 'completion failed'; END IF;
 IF public.merlin_finish_native_preparation(j.id,'merlin-native:rollback-test',proc,evidence) THEN RAISE EXCEPTION 'duplicate completion'; END IF;
 IF EXISTS(SELECT 1 FROM public.merlin_procedures WHERE document_id=(j.payload->>'procedure_document_id')::uuid AND usable_for_compliance_determination) THEN RAISE EXCEPTION 'authority elevation'; END IF;
 IF has_function_privilege('authenticated','public.merlin_claim_native_preparation(text,boolean)','EXECUTE') OR has_function_privilege('anon','public.merlin_consume_dispatch_token(text)','EXECUTE') THEN RAISE EXCEPTION 'privilege leak'; END IF;
END $t$;
ROLLBACK;
SELECT 'PASS: one-use/expired token, single-worker claim, Tier 2 scope, lease-bound atomic completion, duplicate completion denial, non-authoritative output, restricted privileges; fixtures rolled back' verification;