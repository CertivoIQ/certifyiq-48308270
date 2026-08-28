-- Authorized PHA members need read-only visibility into their agency's authoritative readiness controls.
-- Staff remains the only non-service role permitted to mutate these records.

drop policy if exists "PHA users read own authoritative controls" on public.pha_authoritative_control_state;
drop policy if exists "PHA users read agency authoritative controls" on public.pha_authoritative_control_state;
create policy "PHA users read agency authoritative controls"
on public.pha_authoritative_control_state for select to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1 from public.pha_workspace_memberships m
     where m.workspace_user_id = pha_authoritative_control_state.user_id
       and m.member_user_id = auth.uid()
       and m.active = true
  )
  or public.has_role(auth.uid(), 'staff')
);
