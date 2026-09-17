-- The authenticated public RPC delegates to a private implementation that enforces
-- auth.uid(), manager authority, workflow status, resolved findings, immutable
-- confirmation evidence, and audit filing. The wrapper must run as definer so it
-- can invoke the private function without granting authenticated users direct
-- EXECUTE privileges on the private schema implementation.
alter function public.approve_certification_final(uuid,text,text,text) security definer;

revoke all on function public.approve_certification_final(uuid,text,text,text) from public, anon;
grant execute on function public.approve_certification_final(uuid,text,text,text) to authenticated;

comment on function public.approve_certification_final(uuid,text,text,text) is
'Authenticated entrypoint for final certification review. Runs as definer only to invoke the private implementation; private implementation still enforces auth.uid(), manager authority, pending-final-review status, resolved findings, immutable confirmation, evidence manifest, and audit filing.';
