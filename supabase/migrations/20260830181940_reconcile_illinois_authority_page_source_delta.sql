-- Reconcile authority-page byte deltas discovered by the 2026-08-30 controlled Illinois recrawl.
-- Captures remain fail-closed until a separate independent validator reviews the new bytes.

do $$
declare
  v_pack_id uuid;
  v_changed integer;
begin
  select id into v_pack_id
  from public.state_rule_pack_candidates
  where state_code = 'IL'
  order by inventory_generated_at desc
  limit 1
  for update;

  if v_pack_id is null then
    raise exception 'Illinois state rule pack candidate not found';
  end if;

  with delta(source_id,old_hash,new_hash,byte_size) as (
    values
      ('f6f53e0a-eea9-4a93-aa28-72a997b255c8'::uuid,'a8b0ee71de8b8648194286022fcddd2f8cc8e59b310e84afcd303886145b0651','7645ef747d551c359a346435be670c7690e32988a52c99ae9dfac9e7da0f17dc',147683),
      ('c6f03806-5786-4d53-bffc-5c0903ed1bc1'::uuid,'e95655aa226fdd47c9b69de95f9294cfb2aab1bf3bec618c4dd51cbc7d1a7519','04c30052413195859b894b1cb885f026a250a8fc01bd99ae6e86c6742704d479',152595),
      ('4b933b51-9c24-4c19-8979-8dad3f54d896'::uuid,'39110746e4b6bb48fa47108838c9168691bd1dcbfcfc12d5f56f4e7113fd3c27','3a6afb4851782488d58830a27e7d98f144909288d991e31201cc49bbd0d36cc0',221332)
  ), updated as (
    update public.state_rule_source_candidates source
    set source_sha256 = delta.new_hash,
        retrieved_at = '2026-08-30T18:19:40.628176Z'::timestamptz,
        candidate_status = 'CAPTURED_EXACT_BYTES_PENDING_INDEPENDENT_VALIDATION',
        agent_verification_status = 'captured_unvalidated',
        exact_bytes_captured = true,
        compliance_activation_allowed = false,
        verification_evidence = coalesce(source.verification_evidence,'{}'::jsonb) || jsonb_build_object(
          'recrawl_kind','authority_page_snapshot',
          'recrawl_actor','codex_controlled_capture',
          'recrawl_completed_at','2026-08-30T18:19:40.628176Z',
          'prior_validated_sha256',delta.old_hash,
          'recrawl_sha256',delta.new_hash,
          'recrawl_byte_size',delta.byte_size,
          'recrawl_content_type','text/html; charset=UTF-8',
          'source_bytes_changed',true,
          'recrawl_two_consecutive_captures_match',true,
          'independent_validation_required',true,
          'independent_validation_completed',false,
          'compliance_activation_allowed',false
        ),
        updated_at = now()
    from delta
    where source.id = delta.source_id
      and source.state_code = 'IL'
      and source.source_sha256 = delta.old_hash
    returning source.id
  )
  select count(*) into v_changed from updated;

  if v_changed <> 3 and exists (
    select 1
    from (values
      ('f6f53e0a-eea9-4a93-aa28-72a997b255c8'::uuid,'7645ef747d551c359a346435be670c7690e32988a52c99ae9dfac9e7da0f17dc'),
      ('c6f03806-5786-4d53-bffc-5c0903ed1bc1'::uuid,'04c30052413195859b894b1cb885f026a250a8fc01bd99ae6e86c6742704d479'),
      ('4b933b51-9c24-4c19-8979-8dad3f54d896'::uuid,'3a6afb4851782488d58830a27e7d98f144909288d991e31201cc49bbd0d36cc0')
    ) expected(id,hash)
    where not exists (
      select 1 from public.state_rule_source_candidates source
      where source.id=expected.id and source.source_sha256=expected.hash
        and source.agent_verification_status='captured_unvalidated'
        and not source.compliance_activation_allowed
    )
  ) then
    raise exception 'Illinois authority-page reconciliation did not match the expected old or new hashes';
  end if;

  update public.state_rule_pack_candidates
  set status='agent_verification_in_progress',
      compliance_activation_allowed=false,
      updated_at=now()
  where id=v_pack_id;

  perform public.refresh_state_rule_pack_activation('IL',now());
  perform public.refresh_state_rule_release_work_item(v_pack_id);
end $$;
