BEGIN;
DO $t$
DECLARE j public.operations_jobs; n public.operations_jobs; counted integer;
BEGIN
 SELECT * INTO j FROM public.merlin_claim_native_preparation('merlin-native:retry-test',true);
 IF j.id IS NULL THEN RAISE EXCEPTION 'fixture missing'; END IF;
 UPDATE public.operations_jobs SET attempts=max_attempts,lease_expires_at=now()-interval '1 minute' WHERE id=j.id;
 SELECT * INTO n FROM public.merlin_claim_native_preparation('merlin-native:reap-test',true);
 IF (SELECT status FROM public.operations_jobs WHERE id=j.id)<>'quarantined' THEN RAISE EXCEPTION 'expired lease retry cap bypass'; END IF;
 IF n.id IS NOT NULL THEN UPDATE public.operations_jobs SET status='queued',lease_owner=NULL,lease_expires_at=NULL WHERE id=n.id; END IF;
 SELECT count(*) INTO counted FROM private.merlin_native_attempts WHERE created_at>=now()-interval '24 hours';
 INSERT INTO private.merlin_native_attempts(job_id) SELECT j.id FROM generate_series(1,greatest(0,24-counted));
 SELECT * INTO n FROM public.merlin_claim_native_preparation('merlin-native:budget-test',true);
 IF n.id IS NOT NULL THEN RAISE EXCEPTION 'daily attempt cap bypass'; END IF;
END $t$;
ROLLBACK;
SELECT 'PASS: expired lease reaches quarantine at retry cap; rolling 24-hour attempt cap blocks new claims; fixtures rolled back' verification;