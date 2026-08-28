-- Derive PHA verification and EIV completion from controlled requirements and evidence.
-- Family action completion booleans remain compatibility fields, but runtime values are recomputed
-- from evidence state and cannot be used as independent workflow overrides.

create table if not exists public.pha_verification_requirement_matrix (
  id uuid primary key default gen_random_uuid(),
  program_code text not null check (program_code in ('hcv','pbv','public_housing','mod_rehab')),
  action_type text not null check (action_type in ('admission','annual_reexamination','interim_reexamination','portability','other')),
  requirement_key text not null check (requirement_key in ('general_verification','eiv_review')),
  satisfaction_mode text not null check (satisfaction_mode in ('verified_non_eiv_evidence','verified_eiv_or_controlled_exception')),
  source_authority_key text not null default 'PHA_VERIFICATION_CONTROLLED_SOURCE',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_code, action_type, requirement_key)
);

alter table public.pha_verification_requirement_matrix enable row level security;

create policy "Users read active PHA verification requirements"
on public.pha_verification_requirement_matrix
for select using (active = true or public.has_role(auth.uid(), 'staff'));

create policy "Staff manage PHA verification requirements"
on public.pha_verification_requirement_matrix
for all using (public.has_role(auth.uid(), 'staff'))
with check (public.has_role(auth.uid(), 'staff'));

insert into public.pha_verification_requirement_matrix
  (program_code, action_type, requirement_key, satisfaction_mode)
select p.program_code, a.action_type, r.requirement_key, r.satisfaction_mode
from (values ('hcv'), ('pbv'), ('public_housing'), ('mod_rehab')) as p(program_code)
cross join (values ('admission'), ('annual_reexamination'), ('interim_reexamination'), ('portability'), ('other')) as a(action_type)
cross join (values
  ('general_verification', 'verified_non_eiv_evidence'),
  ('eiv_review', 'verified_eiv_or_controlled_exception')
) as r(requirement_key, satisfaction_mode)
on conflict (program_code, action_type, requirement_key) do nothing;

create table if not exists public.pha_family_eiv_exceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  family_action_id uuid not null references public.pha_family_actions(id) on delete cascade,
  exception_reason text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_action_id)
);

alter table public.pha_family_eiv_exceptions enable row level security;

create policy "Users manage own PHA EIV exceptions"
on public.pha_family_eiv_exceptions
for all using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Staff read PHA EIV exceptions"
on public.pha_family_eiv_exceptions
for select using (public.has_role(auth.uid(), 'staff'));

create or replace function public.refresh_pha_family_verification_state(
  target_action_id uuid,
  target_user_id uuid
)
returns void language plpgsql security invoker as $$
declare
  action_row public.pha_family_actions%rowtype;
  general_requirement_active boolean := false;
  eiv_requirement_active boolean := false;
  has_verified_general boolean := false;
  has_verified_eiv boolean := false;
  has_conflict boolean := false;
  has_controlled_eiv_exception boolean := false;
  derived_verification boolean := false;
  derived_eiv boolean := false;
begin
  select * into action_row
    from public.pha_family_actions
   where id = target_action_id and user_id = target_user_id;

  if not found then
    return;
  end if;

  select exists (
    select 1
      from public.pha_verification_requirement_matrix m
     where m.program_code = action_row.program_code
       and m.action_type = action_row.action_type
       and m.requirement_key = 'general_verification'
       and m.satisfaction_mode = 'verified_non_eiv_evidence'
       and m.active = true
  ) into general_requirement_active;

  select exists (
    select 1
      from public.pha_verification_requirement_matrix m
     where m.program_code = action_row.program_code
       and m.action_type = action_row.action_type
       and m.requirement_key = 'eiv_review'
       and m.satisfaction_mode = 'verified_eiv_or_controlled_exception'
       and m.active = true
  ) into eiv_requirement_active;

  select exists (
    select 1
      from public.pha_family_evidence e
     where e.family_action_id = target_action_id
       and e.user_id = target_user_id
       and e.evidence_type <> 'eiv'
       and e.verified = true
       and e.conflict_detected = false
  ) into has_verified_general;

  select exists (
    select 1
      from public.pha_family_evidence e
     where e.family_action_id = target_action_id
       and e.user_id = target_user_id
       and e.evidence_type = 'eiv'
       and e.verified = true
       and e.conflict_detected = false
  ) into has_verified_eiv;

  select exists (
    select 1
      from public.pha_family_evidence e
     where e.family_action_id = target_action_id
       and e.user_id = target_user_id
       and e.conflict_detected = true
  ) into has_conflict;

  select exists (
    select 1
      from public.pha_family_eiv_exceptions x
     where x.family_action_id = target_action_id
       and x.user_id = target_user_id
       and length(trim(x.exception_reason)) > 0
  )
  and action_row.controlled_source_release_approved
  and action_row.current_rule_version_validated
  and not action_row.source_status_conflict
  into has_controlled_eiv_exception;

  -- Fail closed when the controlled matrix is absent or inactive.
  derived_verification := general_requirement_active and has_verified_general and not has_conflict;
  derived_eiv := eiv_requirement_active and (has_verified_eiv or has_controlled_eiv_exception) and not has_conflict;

  update public.pha_family_actions
     set verification_complete = derived_verification,
         eiv_review_complete = derived_eiv,
         updated_at = now()
   where id = target_action_id and user_id = target_user_id
     and (
       verification_complete is distinct from derived_verification
       or eiv_review_complete is distinct from derived_eiv
     );
end;
$$;

create or replace function public.refresh_pha_family_verification_from_evidence()
returns trigger language plpgsql security invoker as $$
begin
  perform public.refresh_pha_family_verification_state(
    coalesce(new.family_action_id, old.family_action_id),
    coalesce(new.user_id, old.user_id)
  );
  return null;
end;
$$;

drop trigger if exists pha_family_evidence_refresh_verification_after_write on public.pha_family_evidence;
create trigger pha_family_evidence_refresh_verification_after_write
after insert or update or delete on public.pha_family_evidence
for each row execute function public.refresh_pha_family_verification_from_evidence();

drop trigger if exists pha_family_eiv_exception_refresh_after_write on public.pha_family_eiv_exceptions;
create trigger pha_family_eiv_exception_refresh_after_write
after insert or update or delete on public.pha_family_eiv_exceptions
for each row execute function public.refresh_pha_family_verification_from_evidence();

create or replace function public.enforce_pha_family_derived_verification()
returns trigger language plpgsql security invoker as $$
declare
  general_requirement_active boolean := false;
  eiv_requirement_active boolean := false;
  has_verified_general boolean := false;
  has_verified_eiv boolean := false;
  has_conflict boolean := false;
  has_controlled_eiv_exception boolean := false;
begin
  select exists (
    select 1 from public.pha_verification_requirement_matrix m
     where m.program_code = new.program_code
       and m.action_type = new.action_type
       and m.requirement_key = 'general_verification'
       and m.satisfaction_mode = 'verified_non_eiv_evidence'
       and m.active = true
  ) into general_requirement_active;

  select exists (
    select 1 from public.pha_verification_requirement_matrix m
     where m.program_code = new.program_code
       and m.action_type = new.action_type
       and m.requirement_key = 'eiv_review'
       and m.satisfaction_mode = 'verified_eiv_or_controlled_exception'
       and m.active = true
  ) into eiv_requirement_active;

  select exists (
    select 1 from public.pha_family_evidence e
     where e.family_action_id = new.id and e.user_id = new.user_id
       and e.evidence_type <> 'eiv' and e.verified = true and e.conflict_detected = false
  ) into has_verified_general;

  select exists (
    select 1 from public.pha_family_evidence e
     where e.family_action_id = new.id and e.user_id = new.user_id
       and e.evidence_type = 'eiv' and e.verified = true and e.conflict_detected = false
  ) into has_verified_eiv;

  select exists (
    select 1 from public.pha_family_evidence e
     where e.family_action_id = new.id and e.user_id = new.user_id and e.conflict_detected = true
  ) into has_conflict;

  select exists (
    select 1 from public.pha_family_eiv_exceptions x
     where x.family_action_id = new.id and x.user_id = new.user_id
       and length(trim(x.exception_reason)) > 0
  )
  and new.controlled_source_release_approved
  and new.current_rule_version_validated
  and not new.source_status_conflict
  into has_controlled_eiv_exception;

  new.verification_complete := general_requirement_active and has_verified_general and not has_conflict;
  new.eiv_review_complete := eiv_requirement_active and (has_verified_eiv or has_controlled_eiv_exception) and not has_conflict;
  return new;
end;
$$;

drop trigger if exists pha_family_action_derived_verification_before_write on public.pha_family_actions;
create trigger pha_family_action_derived_verification_before_write
before insert or update on public.pha_family_actions
for each row execute function public.enforce_pha_family_derived_verification();

-- Recompute existing family actions after installing the controlled matrix.
do $$
declare r record;
begin
  for r in select id, user_id from public.pha_family_actions loop
    perform public.refresh_pha_family_verification_state(r.id, r.user_id);
  end loop;
end;
$$;
