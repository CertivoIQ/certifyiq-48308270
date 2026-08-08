-- 1. Suspension support on memberships + lifecycle audit fields
ALTER TABLE public.hfa_agency_memberships
  ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_by uuid REFERENCES auth.users(id);

-- 2. Helpers: exclude suspended members, fixed search_path, minimum grants
CREATE OR REPLACE FUNCTION public.is_agency_member(_agency_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (
    select 1 from public.hfa_agency_memberships m
    where m.agency_id = _agency_id and m.user_id = _user_id and m.suspended_at is null
  );
$$;

CREATE OR REPLACE FUNCTION public.has_agency_role(_agency_id uuid, _user_id uuid, _roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (
    select 1 from public.hfa_agency_memberships m
    where m.agency_id = _agency_id and m.user_id = _user_id
      and m.suspended_at is null and m.role = any(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.agency_can_view_submission(_submission_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (
    select 1
    from public.hfa_submission_grants g
    join public.hfa_submissions s on s.id = g.submission_id
    join public.hfa_agency_memberships m
      on m.agency_id = g.agency_id and m.user_id = _user_id and m.suspended_at is null
    where g.submission_id = _submission_id
      and g.revoked_at is null
      and s.agency_id = g.agency_id
      and s.status <> 'draft'
  );
$$;

CREATE OR REPLACE FUNCTION public.agency_can_review_submission(_submission_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists (
    select 1
    from public.hfa_submission_grants g
    join public.hfa_submissions s on s.id = g.submission_id
    join public.hfa_agency_memberships m
      on m.agency_id = g.agency_id and m.user_id = _user_id and m.suspended_at is null
    where g.submission_id = _submission_id
      and g.revoked_at is null
      and s.agency_id = g.agency_id
      and s.status <> 'draft'
      and m.role in ('agency_admin','monitor')
  );
$$;

-- Least privilege: RLS policies run as the caller, so policy helpers need
-- authenticated EXECUTE. anon and PUBLIC get nothing.
REVOKE ALL ON FUNCTION public.is_agency_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_agency_role(uuid, uuid, text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.agency_can_view_submission(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.agency_can_review_submission(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_agency_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agency_can_view_submission(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.agency_can_review_submission(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_agency_role(uuid, uuid, text[]) TO service_role;

-- Trigger-only / internal functions must not be callable over RPC
REVOKE ALL ON FUNCTION public.block_hfa_audit_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_manifest_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_pack_release() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_support_case_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_support_case_number() TO service_role;

-- 3. Invitation-based agency membership provisioning
CREATE TABLE IF NOT EXISTS public.hfa_agency_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.hfa_agencies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('agency_admin','rule_reviewer','monitor','read_only')),
  token_hash text NOT NULL UNIQUE,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.hfa_agency_invitations TO authenticated;
GRANT ALL ON public.hfa_agency_invitations TO service_role;
ALTER TABLE public.hfa_agency_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agency admins and staff read their agency invitations"
ON public.hfa_agency_invitations FOR SELECT TO authenticated
USING (
  public.has_agency_role(agency_id, auth.uid(), ARRAY['agency_admin']::text[])
  OR public.has_role(auth.uid(), 'staff')
);

CREATE INDEX IF NOT EXISTS hfa_agency_invitations_agency_idx
  ON public.hfa_agency_invitations(agency_id);
CREATE UNIQUE INDEX IF NOT EXISTS hfa_agency_invitations_open_unique
  ON public.hfa_agency_invitations(agency_id, lower(email))
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE TRIGGER t_hfa_agency_invitations_updated
BEFORE UPDATE ON public.hfa_agency_invitations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- has_agency_role is used inside this policy, so authenticated must execute it
GRANT EXECUTE ON FUNCTION public.has_agency_role(uuid, uuid, text[]) TO authenticated;

-- 4. Server-managed correction evidence
ALTER TABLE public.correction_evidence
  ADD COLUMN IF NOT EXISTS storage_bucket text,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS storage_version text,
  ADD COLUMN IF NOT EXISTS byte_size bigint,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS scan_status text NOT NULL DEFAULT 'quarantined';

ALTER TABLE public.correction_evidence
  DROP CONSTRAINT IF EXISTS correction_evidence_scan_status_check;
ALTER TABLE public.correction_evidence
  ADD CONSTRAINT correction_evidence_scan_status_check
  CHECK (scan_status IN ('quarantined','clean','infected','unavailable'));

CREATE UNIQUE INDEX IF NOT EXISTS correction_evidence_storage_path_unique
  ON public.correction_evidence(storage_bucket, storage_path)
  WHERE storage_path IS NOT NULL;

-- Client-authoritative hashes are gone: only the server may record evidence.
DROP POLICY IF EXISTS "Owners attach correction evidence" ON public.correction_evidence;
REVOKE INSERT, UPDATE, DELETE ON public.correction_evidence FROM authenticated;

CREATE OR REPLACE FUNCTION public.block_correction_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
begin
  raise exception 'Correction evidence records are immutable.';
end;
$$;
REVOKE ALL ON FUNCTION public.block_correction_evidence_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS t_correction_evidence_immutable ON public.correction_evidence;
CREATE TRIGGER t_correction_evidence_immutable
BEFORE UPDATE OR DELETE ON public.correction_evidence
FOR EACH ROW EXECUTE FUNCTION public.block_correction_evidence_mutation();