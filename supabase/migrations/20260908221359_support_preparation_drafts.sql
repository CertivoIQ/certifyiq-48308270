
CREATE TABLE private.support_preparation_receipts (
 case_id uuid NOT NULL REFERENCES public.support_cases(id) ON DELETE CASCADE,
 input_sha256 text NOT NULL,
 note_id uuid NOT NULL REFERENCES public.support_case_notes(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(case_id,input_sha256)
);
ALTER TABLE private.support_preparation_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.support_preparation_receipts FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.prepare_support_case_draft(_text text)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE category text; reply text; steps text;
BEGIN
 CASE
 WHEN _text ~* '(privacy|data breach|unauthori[sz]ed|suspicious login|another.*(resident|tenant|account).*data|security incident)' THEN
 category:='security';
 reply:='Please describe the affected workflow and approximate time without including passwords, access tokens, or resident records. This requires an authorized security reviewer; no resolution has been confirmed.';
 steps:='Preserve access logs; identify affected scope using authorized tools; assess containment; assign a security responder. Do not request sensitive records in ordinary email.';
 WHEN _text ~* '(refund|charged twice|billing|invoice|payment|contract)' THEN
 category:='billing';
 reply:='Please provide the invoice reference and a description of the discrepancy without sharing payment-card information. Account records need review before any adjustment can be confirmed.';
 steps:='Compare invoice, payment and contract records; identify discrepancy; prepare recommended action. Do not issue refunds or change terms.';
 WHEN _text ~* '(compliance|eligibility|approve|override|finding|legal|certification decision)' THEN
 category:='compliance';
 reply:='Please identify the affected workflow and finding reference without including resident information in this message. The evidence and applicable rule need review before a conclusion can be confirmed.';
 steps:='Collect authorized evidence references, applicable rule version, calculation and uncertainty; assign a qualified reviewer. Do not override findings or sign approvals.';
 WHEN _text ~* '(error|failed|not loading|cannot|can.t|unable|blank|crash|upload|save)' THEN
 category:='technical';
 reply:='Please share the workflow step, approximate time, browser, and exact error text with personal information removed. This will help reproduce the issue; a fix or completion time has not been confirmed.';
 steps:='Reproduce with a synthetic case; inspect authorized logs; identify error correlation; draft a fix and regression check. Do not modify customer data as a workaround.';
 ELSE
 category:='general';
 reply:='Please describe the step you are trying to complete and what happened instead, without including sensitive resident information. The request needs review before a specific resolution can be confirmed.';
 steps:='Identify requested outcome; consult approved product guidance; record missing facts and recommended next action.';
 END CASE;
 RETURN jsonb_build_object('category',category,'draft_reply',reply,'investigation',steps,
   'requires_review',true,'send_automatically',false,'template_version','support-prep-v1');
END $$;
REVOKE ALL ON FUNCTION private.prepare_support_case_draft(text) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.certivoiq_support_preparation_tick()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE c record; fingerprint text; prepared jsonb; inserted_note uuid; prepared_count integer:=0; source_text text;
BEGIN
 IF current_user<>'postgres' THEN RAISE EXCEPTION 'postgres scheduler required'; END IF;
 IF NOT pg_try_advisory_xact_lock(48308270,909) THEN RETURN '{"skipped":"already_running"}'::jsonb; END IF;
 FOR c IN
  SELECT s.*,coalesce((SELECT string_agg(n.note,E'\n' ORDER BY n.created_at,n.id)
   FROM public.support_case_notes n WHERE n.case_id=s.id AND NOT n.internal),'') public_notes
  FROM public.support_cases s WHERE s.status NOT IN ('closed','resolved')
   AND s.subject NOT ILIKE '[SYSTEM TEST]%'
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
