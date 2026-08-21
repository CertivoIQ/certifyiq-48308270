begin;

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_job_id uuid := gen_random_uuid();
  v_item_id uuid := gen_random_uuid();
  v_finding_a uuid := gen_random_uuid();
  v_finding_b uuid := gen_random_uuid();
  v_approval_id uuid;
  v_nonapproval_id uuid;
  v_update_row_id uuid;
  v_valid_update_row_id uuid;
begin
  insert into auth.users (id, email, aud, role, created_at, updated_at)
  values (
    v_user_id,
    'revocation-update-integrity-test@example.invalid',
    'authenticated',
    'authenticated',
    now(),
    now()
  );

  insert into public.certification_import_jobs (id, user_id, created_by, source_name)
  values (v_job_id, v_user_id, v_user_id, 'revocation-update-integrity-test');

  insert into public.certification_import_items (
    id,
    job_id,
    user_id,
    storage_path,
    original_file_name,
    mime_type,
    size_bytes
  )
  values (
    v_item_id,
    v_job_id,
    v_user_id,
    'revocation-update-integrity-test/test.pdf',
    'test.pdf',
    'application/pdf',
    1
  );

  insert into public.compliance_findings (
    id,
    item_id,
    user_id,
    organization_id,
    rule_id,
    rule_version,
    rule_pack_id,
    rule_pack_version,
    jurisdiction,
    status,
    explanation,
    engine_build
  )
  values
    (
      v_finding_a,
      v_item_id,
      v_user_id,
      'revocation-update-integrity-test',
      'REVOCATION-UPDATE-A-' || v_finding_a::text,
      '1',
      'revocation-update-integrity-test',
      '1',
      'TEST',
      'PASS',
      'Temporary rollback-only update integrity finding A.',
      'test'
    ),
    (
      v_finding_b,
      v_item_id,
      v_user_id,
      'revocation-update-integrity-test',
      'REVOCATION-UPDATE-B-' || v_finding_b::text,
      '1',
      'revocation-update-integrity-test',
      '1',
      'TEST',
      'PASS',
      'Temporary rollback-only update integrity finding B.',
      'test'
    );

  insert into public.finding_reviews (
    finding_id,
    user_id,
    reviewer_id,
    decision,
    manifest_sha256
  )
  values (v_finding_a, v_user_id, v_user_id, 'approved', 'revocation-update-integrity-test-manifest')
  returning id into v_approval_id;

  insert into public.finding_reviews (
    finding_id,
    user_id,
    reviewer_id,
    decision,
    manifest_sha256
  )
  values (v_finding_a, v_user_id, v_user_id, 'remediation_requested', 'revocation-update-integrity-test-manifest')
  returning id into v_nonapproval_id;

  insert into public.finding_reviews (
    finding_id,
    user_id,
    reviewer_id,
    decision,
    manifest_sha256
  )
  values (v_finding_b, v_user_id, v_user_id, 'approved', 'revocation-update-integrity-test-manifest')
  returning id into v_update_row_id;

  begin
    update public.finding_reviews
       set revoked_at = now(),
           revoked_review_id = v_approval_id
     where id = v_update_row_id;

    raise exception 'TEST_FAILED: cross-finding revocation update was accepted.';
  exception
    when others then
      if sqlerrm not like '%same finding%' then
        raise;
      end if;
  end;

  insert into public.finding_reviews (
    finding_id,
    user_id,
    reviewer_id,
    decision,
    manifest_sha256
  )
  values (v_finding_a, v_user_id, v_user_id, 'approved', 'revocation-update-integrity-test-manifest')
  returning id into v_valid_update_row_id;

  begin
    update public.finding_reviews
       set revoked_at = now(),
           revoked_review_id = v_nonapproval_id
     where id = v_valid_update_row_id;

    raise exception 'TEST_FAILED: non-approved revocation target update was accepted.';
  exception
    when others then
      if sqlerrm not like '%Only an approved review may be revoked%' then
        raise;
      end if;
  end;

  update public.finding_reviews
     set revoked_at = now(),
         revoked_review_id = v_approval_id
   where id = v_valid_update_row_id;

  if not exists (
    select 1
      from public.finding_reviews
     where id = v_valid_update_row_id
       and revoked_review_id = v_approval_id
       and revoked_at is not null
  ) then
    raise exception 'TEST_FAILED: valid revocation update was not persisted.';
  end if;

  raise notice 'PASS: revocation update integrity database regression';
end;
$$;

rollback;
