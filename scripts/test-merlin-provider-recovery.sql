BEGIN;
DO $t$
DECLARE j public.operations_jobs; before_attempts integer; incidents_before integer; blocked public.operations_jobs;
BEGIN
 PERFORM public.merlin_record_provider_probe(true,NULL);
 SELECT * INTO j FROM public.merlin_claim_native_preparation('merlin-native:provider-test',false);
 IF j.id IS NULL THEN RAISE EXCEPTION 'fixture missing'; END IF;
 before_attempts:=j.attempts;
 IF NOT public.merlin_fail_native_preparation(j.id,'merlin-native:provider-test','MODEL_HTTP_429_credit_balance_exhausted') THEN RAISE EXCEPTION 'defer failed'; END IF;
 IF (SELECT attempts FROM public.operations_jobs WHERE id=j.id)<>before_attempts-1 THEN RAISE EXCEPTION 'provider consumed document retry'; END IF;
 SELECT * INTO blocked FROM public.merlin_claim_native_preparation('merlin-native:provider-blocked',false);
 IF blocked.id IS NOT NULL THEN RAISE EXCEPTION 'provider backoff ignored'; END IF;
 SELECT count(*) INTO incidents_before FROM public.operations_incidents WHERE detail->>'monitor'='merlin_provider' AND status IN('open','acknowledged');
 IF incidents_before<>1 THEN RAISE EXCEPTION 'provider incident missing'; END IF;
 PERFORM public.merlin_record_provider_probe(false,'credit_balance_exhausted');
 IF (SELECT count(*) FROM public.operations_incidents WHERE detail->>'monitor'='merlin_provider' AND status IN('open','acknowledged'))<>incidents_before THEN RAISE EXCEPTION 'duplicate provider incident'; END IF;
 PERFORM public.merlin_record_provider_probe(true,NULL);
 IF EXISTS(SELECT 1 FROM public.operations_incidents WHERE detail->>'monitor'='merlin_provider' AND status IN('open','acknowledged')) THEN RAISE EXCEPTION 'provider recovery not reflected'; END IF;
END $t$;
ROLLBACK;
SELECT 'PASS: provider backoff, preserved document retries, single incident, automatic recovery; fixtures rolled back' verification;