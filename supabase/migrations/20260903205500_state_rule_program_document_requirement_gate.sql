-- Exact program-document requirements for all 50 CertivoIQ state rule packs.
-- The gate requires state LIHTC QAP/limits/manual evidence plus inherited HUD
-- HCV/PBV/HOTMA/Section 202/811 baselines. State-specific HUD-program overlays
-- are required only where the state source inventory shows the HFA publishes them.

create table if not exists public.state_rule_document_requirements (
  state_code text not null check (state_code ~ '^[A-Z]{2}$'),
  requirement_key text not null,
  source_scope text not null check (source_scope in ('STATE','FEDERAL_SHARED')),
  applicability_basis text not null,
  required boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (state_code, requirement_key)
);

insert into public.state_rule_document_requirements (state_code, requirement_key, source_scope, applicability_basis)
select p.state_code, r.requirement_key, r.source_scope, r.applicability_basis
from public.state_rule_pack_candidates p
cross join (values
  ('LIHTC_QAP','STATE','Every state LIHTC pack requires an exact current QAP'),
  ('INCOME_LIMITS','STATE','Every state LIHTC pack requires exact applicable income limits'),
  ('RENT_LIMITS','STATE','Every state LIHTC pack requires exact applicable rent limits'),
  ('LIHTC_COMPLIANCE_MANUAL','STATE','Every state LIHTC pack requires an exact compliance manual or guidebook'),
  ('HCV_COMPLIANCE_GUIDEBOOK','FEDERAL_SHARED','HUD HCV baseline is inherited by every state pack; local PHA policy overlays remain workspace-specific'),
  ('PBV_COMPLIANCE_GUIDANCE','FEDERAL_SHARED','HUD PBV baseline is inherited by every state pack; local PHA administrative-plan overlays remain workspace-specific'),
  ('HOTMA_GUIDANCE','FEDERAL_SHARED','Current HUD HOTMA guidance is inherited by every state pack for layered HUD programs'),
  ('SECTION_202_HANDBOOK','FEDERAL_SHARED','HUD Section 202 baseline is inherited where Section 202 applies'),
  ('SECTION_811_HANDBOOK','FEDERAL_SHARED','HUD Section 811 baseline is inherited where Section 811 applies')
) as r(requirement_key,source_scope,applicability_basis)
where p.state_code <> 'US'
on conflict (state_code, requirement_key) do nothing;

with signals as (
  select s.state_code,
    bool_or(lower(coalesce(s.source_type,'')||' '||coalesce(s.program,'')||' '||coalesce(s.source_url,'')||' '||coalesce(s.verification_evidence->>'document_title','')) ~ 'housing choice voucher|(^|[^a-z])hcv([^a-z]|$)|section[- _]?8') hcv,
    bool_or(lower(coalesce(s.source_type,'')||' '||coalesce(s.program,'')||' '||coalesce(s.source_url,'')||' '||coalesce(s.verification_evidence->>'document_title','')) ~ 'project[- _]?based voucher|(^|[^a-z])pbv([^a-z]|$)') pbv,
    bool_or(lower(coalesce(s.source_type,'')||' '||coalesce(s.program,'')||' '||coalesce(s.source_url,'')||' '||coalesce(s.verification_evidence->>'document_title','')) ~ 'section[- _]?811|811pra|811 pra|supportive housing.{0,30}disabil') s811,
    bool_or(lower(coalesce(s.source_type,'')||' '||coalesce(s.program,'')||' '||coalesce(s.source_url,'')||' '||coalesce(s.verification_evidence->>'document_title','')) ~ 'section[- _]?202|supportive housing.{0,30}elder') s202,
    bool_or(lower(coalesce(s.source_type,'')||' '||coalesce(s.program,'')||' '||coalesce(s.source_url,'')||' '||coalesce(s.verification_evidence->>'document_title','')) ~ 'hotma') hotma
  from public.state_rule_source_candidates s
  where s.state_code <> 'US'
  group by s.state_code
), conditional as (
  select state_code,'HCV_STATE_ADMIN_PLAN'::text requirement_key,'STATE'::text source_scope,'State housing agency publishes or administers HCV/Section 8 material'::text basis from signals where hcv
  union all select state_code,'PBV_STATE_POLICY','STATE','State housing agency publishes or administers PBV material' from signals where pbv
  union all select state_code,'SECTION_811_STATE_OVERLAY','STATE','State housing agency publishes Section 811/PRA material' from signals where s811
  union all select state_code,'SECTION_202_STATE_OVERLAY','STATE','State housing agency publishes Section 202 material' from signals where s202
  union all select state_code,'HOTMA_STATE_GUIDANCE','STATE','State housing agency publishes HOTMA-specific guidance or forms' from signals where hotma
)
insert into public.state_rule_document_requirements (state_code,requirement_key,source_scope,applicability_basis)
select state_code,requirement_key,source_scope,basis from conditional
on conflict (state_code,requirement_key) do nothing;

update public.state_rule_source_candidates
set verification_evidence = coalesce(verification_evidence,'{}'::jsonb) || jsonb_build_object(
  'programs', jsonb_build_array('HUD_MULTIFAMILY','SECTION_202','SECTION_811'),
  'program_document_roles', jsonb_build_array('HUD_MULTIFAMILY_OCCUPANCY_HANDBOOK','SECTION_202_HANDBOOK','SECTION_811_HANDBOOK')
), updated_at=now()
where state_code='US' and source_type='HUD_HANDBOOK_4350_3';

create or replace view public.state_rule_document_requirement_readiness as
with sources as (
  select s.*,
    lower(coalesce(s.source_type,'')||' '||coalesce(s.program,'')||' '||coalesce(s.source_url,'')||' '||coalesce(s.verification_evidence->>'document_title','')||' '||coalesce(s.verification_evidence->'program_document_roles','[]'::jsonb)::text) as hay
  from public.state_rule_source_candidates s
  where s.candidate_status <> 'EXCLUDED_REDUNDANT_SOURCE'
), matched as (
  select r.state_code,r.requirement_key,r.source_scope,r.applicability_basis,r.required,s.id source_candidate_id,s.source_sha256,s.agent_verification_status,s.compliance_activation_allowed,s.exact_bytes_captured,
    case r.requirement_key
      when 'LIHTC_QAP' then s.hay ~ 'qualified allocation|(^|[^a-z])qap([^a-z]|$)'
      when 'INCOME_LIMITS' then s.hay ~ 'income.{0,25}limit|mtsp.{0,25}income'
      when 'RENT_LIMITS' then s.hay ~ 'rent.{0,25}limit|maximum rent|mtsp.{0,25}rent'
      when 'LIHTC_COMPLIANCE_MANUAL' then s.hay ~ '(lihtc|tax credit|housing credit).{0,70}(compliance|monitoring).{0,35}(manual|guide|handbook)|(compliance|monitoring).{0,35}(manual|guide|handbook).{0,70}(lihtc|tax credit|housing credit)'
      when 'HCV_COMPLIANCE_GUIDEBOOK' then s.hay ~ 'hcv_compliance_guidebook'
      when 'PBV_COMPLIANCE_GUIDANCE' then s.hay ~ 'pbv_compliance_guidance'
      when 'HOTMA_GUIDANCE' then s.hay ~ 'hotma_guidance'
      when 'SECTION_202_HANDBOOK' then s.hay ~ 'section_202_handbook'
      when 'SECTION_811_HANDBOOK' then s.hay ~ 'section_811_handbook'
      when 'HCV_STATE_ADMIN_PLAN' then s.hay ~ 'housing choice voucher|(^|[^a-z])hcv([^a-z]|$)|section[- _]?8'
      when 'PBV_STATE_POLICY' then s.hay ~ 'project[- _]?based voucher|(^|[^a-z])pbv([^a-z]|$)'
      when 'SECTION_811_STATE_OVERLAY' then s.hay ~ 'section[- _]?811|811pra|811 pra|supportive housing.{0,30}disabil'
      when 'SECTION_202_STATE_OVERLAY' then s.hay ~ 'section[- _]?202|supportive housing.{0,30}elder'
      when 'HOTMA_STATE_GUIDANCE' then s.hay ~ 'hotma'
      else false end as is_match
  from public.state_rule_document_requirements r
  left join sources s on s.state_code = case when r.source_scope='FEDERAL_SHARED' then 'US' else r.state_code end
), agg as (
  select state_code,requirement_key,source_scope,applicability_basis,required,
    bool_or(is_match and source_sha256 is not null and length(source_sha256)=64 and exact_bytes_captured) as sha_present,
    bool_or(is_match and source_sha256 is not null and length(source_sha256)=64 and exact_bytes_captured and agent_verification_status='verified' and compliance_activation_allowed) as verified,
    count(*) filter (where is_match and source_sha256 is not null and length(source_sha256)=64 and exact_bytes_captured) as sha_record_count
  from matched
  group by state_code,requirement_key,source_scope,applicability_basis,required
)
select * from agg;

create or replace function public.enforce_state_rule_document_requirements_on_activation()
returns trigger
language plpgsql
set search_path to 'pg_catalog','public'
as $$
declare
  v_missing_sha text;
  v_unverified text;
begin
  select string_agg(requirement_key, ', ' order by requirement_key)
    into v_missing_sha
  from public.state_rule_document_requirement_readiness
  where state_code=new.state_code and required and not coalesce(sha_present,false);
  if v_missing_sha is not null then
    raise exception 'State pack cannot activate; exact SHA evidence is missing for: %', v_missing_sha;
  end if;

  select string_agg(requirement_key, ', ' order by requirement_key)
    into v_unverified
  from public.state_rule_document_requirement_readiness
  where state_code=new.state_code and required and coalesce(sha_present,false) and not coalesce(verified,false);
  if v_unverified is not null then
    raise exception 'State pack cannot activate; program-document evidence is pending validation for: %', v_unverified;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_state_rule_document_requirements_on_activation on public.state_rule_pack_activation_events;
create trigger enforce_state_rule_document_requirements_on_activation
before insert on public.state_rule_pack_activation_events
for each row execute function public.enforce_state_rule_document_requirements_on_activation();

update public.state_rule_pack_candidates
set candidate_manifest=coalesce(candidate_manifest,'{}'::jsonb)||jsonb_build_object('program_document_requirement_gate',true,'program_document_requirement_gate_installed_at',now()),
    compliance_activation_allowed=false,
    status='agent_verification_in_progress',
    updated_at=now()
where state_code <> 'US';
