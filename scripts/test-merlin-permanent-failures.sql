BEGIN;
DO $t$
DECLARE j public.operations_jobs;
BEGIN
 SELECT * INTO j FROM public.merlin_claim_native_preparation('merlin-native:permanent-test',true);
 IF j.id IS NULL THEN RAISE EXCEPTION 'fixture missing'; END IF;
 IF NOT public.merlin_fail_native_preparation(j.id,'merlin-native:permanent-test','SOURCE_TOO_LARGE') THEN RAISE EXCEPTION 'failure not recorded'; END IF;
 IF (SELECT status FROM public.operations_jobs WHERE id=j.id)<>'quarantined' THEN RAISE EXCEPTION 'permanent error retried'; END IF;
 IF public.merlin_fail_native_preparation(j.id,'merlin-native:permanent-test','SOURCE_TOO_LARGE') THEN RAISE EXCEPTION 'failure replay'; END IF;
END $t$;
ROLLBACK;
SELECT 'PASS: nonretryable source error quarantined immediately; repeated failure cannot mutate completed state; fixtures rolled back' verification;