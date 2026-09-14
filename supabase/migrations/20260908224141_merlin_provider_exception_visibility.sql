CREATE OR REPLACE FUNCTION public.merlin_record_provider_probe(_available boolean,_code text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF current_user NOT IN ('postgres','service_role') THEN RAISE EXCEPTION 'service role required'; END IF;
 PERFORM pg_advisory_xact_lock(48308270,911);
 INSERT INTO private.merlin_provider_state(singleton,blocked_until,error_code,checked_at)
 VALUES(true,CASE WHEN _available THEN NULL ELSE now()+interval '1 hour' END,CASE WHEN _available THEN NULL ELSE left(_code,80) END,now())
 ON CONFLICT(singleton) DO UPDATE SET blocked_until=excluded.blocked_until,error_code=excluded.error_code,checked_at=excluded.checked_at;
 IF _available THEN
  UPDATE public.operations_incidents SET status='resolved',resolved_at=now(),last_seen_at=now(),
   resolution='{"method":"successful_provider_probe"}'::jsonb
  WHERE detail->>'monitor'='merlin_provider' AND status IN ('open','acknowledged');
 ELSE
  UPDATE public.operations_incidents SET last_seen_at=now(),
   detail=detail||jsonb_build_object('code',left(_code,80),'retry_after',now()+interval '1 hour')
  WHERE detail->>'monitor'='merlin_provider' AND status IN ('open','acknowledged');
  IF NOT FOUND THEN
   INSERT INTO public.operations_incidents(severity,status,correlation_id,summary,detail)
   VALUES('high','open',gen_random_uuid(),'Merlin AI provider requires attention',
    jsonb_build_object('monitor','merlin_provider','code',left(_code,80),'queue','operations','retry_after',now()+interval '1 hour'));
  END IF;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.merlin_record_provider_probe(boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.merlin_record_provider_probe(boolean,text) TO service_role;
