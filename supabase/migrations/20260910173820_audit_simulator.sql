-- Phase 8: conservative, evidence-backed Audit Simulator.
-- It evaluates all structured records in scope and never invents sampling rules
-- or predicts discretionary auditor behavior.

create table public.audit_simulation_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  simulation_mode text not null check (simulation_mode in (
    'lihtc_monitoring','hud_mor','home_monitoring','hcv_pbv_review',
    'investor_review','internal_qa_review'
  )),
  property_ids text[] not null default '{}',
  program_codes text[] not null default '{}',
  as_of date not null,
  report jsonb not null,
  report_sha256 text not null check (report_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index audit_simulation_reports_user_created_idx
  on public.audit_simulation_reports(user_id,created_at desc);

alter table public.audit_simulation_reports enable row level security;
create policy audit_simulation_reports_owner_read
  on public.audit_simulation_reports for select to authenticated
  using ((select auth.uid())=user_id);

revoke all on table public.audit_simulation_reports from public,anon,authenticated;
grant select on table public.audit_simulation_reports to authenticated;

create or replace function public.reject_audit_simulation_report_mutation()
returns trigger language plpgsql set search_path='' as $$
begin
  raise exception 'Audit simulation reports are immutable' using errcode='55000';
end;
$$;
revoke all on function public.reject_audit_simulation_report_mutation() from public,anon,authenticated;

create trigger audit_simulation_reports_immutable
before update or delete on public.audit_simulation_reports
for each row execute function public.reject_audit_simulation_report_mutation();

create or replace function public.run_audit_simulation(
  _mode text,
  _property_ids text[] default '{}',
  _program_codes text[] default '{}',
  _as_of date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user_id uuid := auth.uid();
  v_mode text := lower(trim(_mode));
  v_default_programs text[] := '{}';
  v_mode_label text;
  v_supported_criteria jsonb;
  v_readiness jsonb;
  v_outcomes jsonb;
  v_report jsonb;
  v_report_id uuid := gen_random_uuid();
  v_created_at timestamptz := clock_timestamp();
  v_hash text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  case v_mode
    when 'lihtc_monitoring' then
      v_mode_label := 'LIHTC monitoring';
      v_default_programs := array['LIHTC'];
      v_supported_criteria := '["deterministic findings","correction status","certification deadlines","signatures","verification state","controlled rule coverage","required reports"]'::jsonb;
    when 'hud_mor' then
      v_mode_label := 'HUD MOR';
      v_default_programs := array['HUD','SECTION8_PBRA','SECTION202_8','SECTION202_811_PRAC','SECTION811_PRA'];
      v_supported_criteria := '["deterministic findings","correction status","certification deadlines","signatures","verification state","required HUD reporting paths"]'::jsonb;
    when 'home_monitoring' then
      v_mode_label := 'HOME monitoring';
      v_default_programs := array['HOME'];
      v_supported_criteria := '["deterministic findings","correction status","certification deadlines","signatures","verification state","controlled rule coverage","required reports"]'::jsonb;
    when 'hcv_pbv_review' then
      v_mode_label := 'HCV/PBV review';
      v_default_programs := array['HCV','PBV','HCV_PBV'];
      v_supported_criteria := '["family action deadlines","verification state","controlled rule coverage","required reporting paths","deterministic findings","signatures"]'::jsonb;
    when 'investor_review' then
      v_mode_label := 'Investor review';
      v_supported_criteria := '["all in-scope deterministic findings","correction status","deadlines","signatures","verification state","controlled rule coverage","required reports"]'::jsonb;
    when 'internal_qa_review' then
      v_mode_label := 'Internal QA review';
      v_supported_criteria := '["all in-scope deterministic findings","correction status","deadlines","signatures","verification state","controlled rule coverage","required reports"]'::jsonb;
    else
      raise exception 'Unsupported audit simulation mode: %',_mode using errcode='22023';
  end case;

  v_readiness := public.audit_readiness_score(_as_of);

  with scoped as (
    select d
    from jsonb_array_elements(coalesce(v_readiness->'deductions','[]'::jsonb)) d
    where (
      coalesce(cardinality(_property_ids),0)=0
      or d->>'property_id'=any(_property_ids)
    )
    and (
      coalesce(cardinality(_program_codes),0)>0
      and upper(coalesce(d->>'program_code',''))=any(
        select upper(code) from unnest(_program_codes) code
      )
      or coalesce(cardinality(_program_codes),0)=0
      and (
        coalesce(cardinality(v_default_programs),0)=0
        or d->>'program_code' is null
        or upper(d->>'program_code')=any(v_default_programs)
      )
    )
  ), classified as (
    select d || jsonb_build_object(
      'classification',
        case d->>'deduction_code'
          when 'open_finding' then 'Confirmed Deficiency'
          when 'missing_signature' then 'Missing Evidence'
          when 'required_report' then 'Missing Evidence'
          when 'expired_verification' then 'Unable to Determine'
          else 'Potential Exposure'
        end,
      'classification_basis',
        case d->>'deduction_code'
          when 'open_finding' then 'A deterministic finding exists and remains open.'
          when 'missing_signature' then 'The structured record states that a required signature is absent.'
          when 'required_report' then 'The structured record has no validated required reporting path.'
          when 'expired_verification' then 'Compliance cannot be determined from expired or incomplete verification.'
          else 'The structured record identifies a deadline, correction, or controlled-source risk requiring review.'
        end
    ) as outcome
    from scoped
  )
  select coalesce(jsonb_agg(outcome order by
    case outcome->>'classification'
      when 'Confirmed Deficiency' then 1
      when 'Potential Exposure' then 2
      when 'Missing Evidence' then 3 else 4 end,
    (outcome->>'points')::integer desc,
    outcome->>'deduction_id'
  ),'[]'::jsonb) into v_outcomes
  from classified;

  if jsonb_array_length(v_outcomes)=0 then
    v_outcomes := jsonb_build_array(jsonb_build_object(
      'classification','Unable to Determine',
      'classification_basis','No supported structured criteria were present in the selected scope.',
      'deduction_code','no_supported_records',
      'title','No supported records in scope',
      'explanation','CertivoIQ did not infer a result from missing data.',
      'remediation','Add or select applicable records and rerun the simulation.',
      'source_table',null,
      'entity_id',null,
      'points',0
    ));
  end if;

  v_report := jsonb_build_object(
    'report_id',v_report_id,
    'generated_at',v_created_at,
    'as_of',_as_of,
    'simulation_mode',v_mode,
    'simulation_mode_label',v_mode_label,
    'method','deterministic-supported-criteria-v1',
    'scope',jsonb_build_object(
      'property_ids',coalesce(to_jsonb(_property_ids),'[]'::jsonb),
      'program_codes',coalesce(to_jsonb(_program_codes),'[]'::jsonb),
      'mode_default_program_codes',to_jsonb(v_default_programs)
    ),
    'supported_criteria',v_supported_criteria,
    'sampling_basis','All in-scope structured records; no discretionary or fabricated sampling.',
    'limitations','This simulation does not predict auditor discretion and does not assert criteria that CertivoIQ cannot support from structured evidence.',
    'source_readiness',jsonb_build_object(
      'method',v_readiness->>'method',
      'as_of',v_readiness->>'as_of'
    ),
    'summary',jsonb_build_object(
      'Confirmed Deficiency',(select count(*) from jsonb_array_elements(v_outcomes) x where x->>'classification'='Confirmed Deficiency'),
      'Potential Exposure',(select count(*) from jsonb_array_elements(v_outcomes) x where x->>'classification'='Potential Exposure'),
      'Missing Evidence',(select count(*) from jsonb_array_elements(v_outcomes) x where x->>'classification'='Missing Evidence'),
      'Unable to Determine',(select count(*) from jsonb_array_elements(v_outcomes) x where x->>'classification'='Unable to Determine')
    ),
    'outcomes',v_outcomes
  );
  v_hash := encode(extensions.digest(convert_to(v_report::text,'UTF8'),'sha256'),'hex');

  insert into public.audit_simulation_reports(
    id,user_id,simulation_mode,property_ids,program_codes,as_of,report,report_sha256,created_at
  ) values (
    v_report_id,v_user_id,v_mode,coalesce(_property_ids,'{}'),coalesce(_program_codes,'{}'),
    _as_of,v_report,v_hash,v_created_at
  );

  return v_report || jsonb_build_object('report_sha256',v_hash);
end;
$$;

revoke all on function public.run_audit_simulation(text,text[],text[],date) from public,anon;
grant execute on function public.run_audit_simulation(text,text[],text[],date) to authenticated;
comment on function public.run_audit_simulation(text,text[],text[],date) is
  'Generates and preserves a conservative audit simulation from supported, tenant-scoped structured criteria only.';
