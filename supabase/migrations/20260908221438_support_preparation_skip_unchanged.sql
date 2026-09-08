CREATE OR REPLACE FUNCTION private.certivoiq_support_preparation_tick()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE c record; fingerprint text; prepared jsonb; inserted_note uuid; prepared_count integer:=0; source_text text;
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'postgres scheduler required'; END IF;
 IF NOT pg_try_advisory_xact_lock(48308270,909) THEN RETURN '{"skipped":"already_running"}'::jsonb; END IF;
 FOR c IN
  SELECT s.*,pn.public_notes
  FROM public.support_cases s
  CROSS JOIN LATERAL (SELECT coalesce(string_agg(n.note,E'\n' ORDER BY n.created_at,n.id),'') public_notes
   FROM public.support_case_notes n WHERE n.case_id=s.id AND NOT n.internal) pn
  WHERE s.status NOT IN ('closed','resolved') AND s.subject NOT ILIKE '[SYSTEM TEST]%'
   AND NOT EXISTS (SELECT 1 FROM private.support_preparation_receipts r WHERE r.case_id=s.id
    AND r.input_sha256=encode(sha256(convert_to(concat_ws(E'\n',s.subject,s.description,pn.public_notes,s.triage_category),'UTF8')),'hex'))
  ORDER BY s.updated_at,s.id LIMIT 100
 FOR UPDATE OF s SKIP LOCKED
 LOOP
  source_text:=concat_ws(E'\n',c.subject,c.description,c.public_notes,c.triage_category);
  fingerprint:=encode(sha256(convert_to(source_text,'UTF8')),'hex');
  IF EXISTS(SELECT 1 FROM private.support_preparation_receipts r WHERE r.case_id=c.id AND r.input_sha256=fingerprint) THEN CONTINUE; END IF;
  prepared:=private.prepare_support_case_draft(source_text);
  INSERT INTO public.support_case_notes(case_id,author_id,author_name,note,internal)
   VALUES(c.id,NULL,'SupportIQ — automated preparation',
    'INTERNAL DRAFT — human review required; not sent.'||E'\n\n'||
    'Category: '||(prepared->>'category')||E'\n'||
    'Suggested reply:'||E'\n'||(prepared->>'draft_reply')||E'\n\n'||
    'Investigation checklist:'||E'\n'||(prepared->>'investigation')||E'\n\n'||
    'Coverage: '||CASE WHEN c.assigned_to IS NULL THEN 'No reviewer assigned.' ELSE 'Review with the assigned case owner.' END||E'\n'||
    'Prepared from current case text and public notes; verify against the latest case before use. Template: support-prep-v1.',
    true) RETURNING id INTO inserted_note;
  INSERT INTO private.support_preparation_receipts(case_id,input_sha256,note_id) VALUES(c.id,fingerprint,inserted_note);
  prepared_count:=prepared_count+1;
 END LOOP;
 RETURN jsonb_build_object('prepared',prepared_count,'sent',0,'cases_closed',0);
END $$;
REVOKE ALL ON FUNCTION private.certivoiq_support_preparation_tick() FROM PUBLIC,anon,authenticated,service_role;
