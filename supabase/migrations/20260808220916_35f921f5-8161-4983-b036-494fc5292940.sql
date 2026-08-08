revoke execute on function public.is_agency_member(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.has_agency_role(uuid, uuid, text[]) from public, anon, authenticated;
revoke execute on function public.agency_can_view_submission(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.agency_can_review_submission(uuid, uuid) from public, anon, authenticated;