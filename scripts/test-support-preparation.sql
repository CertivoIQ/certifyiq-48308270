BEGIN;
DO $t$
DECLARE target uuid; before_outbox bigint;
BEGIN
 INSERT INTO public.support_cases(subject,description,status,priority,channel,human_required)
 VALUES('[SYSTEM TEST] customer supplied title','Upload failed','open','normal','supportiq',true) RETURNING id INTO target;
 SELECT count(*) INTO before_outbox FROM public.support_notification_outbox;
 PERFORM private.certivoiq_support_preparation_tick();
 PERFORM private.certivoiq_support_preparation_tick();
 IF (SELECT count(*) FROM public.support_case_notes WHERE case_id=target)<>1 THEN RAISE EXCEPTION 'missing or duplicate draft'; END IF;
 IF EXISTS(SELECT 1 FROM public.support_case_notes WHERE case_id=target AND NOT internal) THEN RAISE EXCEPTION 'public draft'; END IF;
 IF (SELECT count(*) FROM public.support_notification_outbox)<>before_outbox THEN RAISE EXCEPTION 'email queued'; END IF;
 UPDATE public.support_cases SET description='Privacy incident and refund request' WHERE id=target;
 PERFORM private.certivoiq_support_preparation_tick();
 IF (SELECT count(*) FROM public.support_case_notes WHERE case_id=target)<>2 THEN RAISE EXCEPTION 'revision missing'; END IF;
 IF private.prepare_support_case_draft('privacy incident and refund')->>'category'<>'security' THEN RAISE EXCEPTION 'priority'; END IF;
 UPDATE public.support_cases SET status='closed',description='another change' WHERE id=target;
 PERFORM private.certivoiq_support_preparation_tick();
 IF (SELECT count(*) FROM public.support_case_notes WHERE case_id=target)<>2 THEN RAISE EXCEPTION 'closed case processed'; END IF;
 IF has_function_privilege('authenticated','private.certivoiq_support_preparation_tick()','EXECUTE') THEN RAISE EXCEPTION 'public execution'; END IF;
END $t$;
ROLLBACK;
SELECT 'PASS: internal drafts, dedupe, revisions, no draft email, closed-case exclusion, customer cannot spoof test exclusion, priority, privileges; fixtures rolled back' verification;