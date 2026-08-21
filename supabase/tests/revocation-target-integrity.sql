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
  v_revocation_id uuid;
begin
  insert into auth.users (
    id,
    email,
    aud,
    role,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    'revocation-integrity-test@example.invalid',
    'authenticated',
    'authenticated',
    now(),
    now()
  );

  insert into public.certification_import_jobs (
    id,
    user_id,
    created_by,
    source_name
  )
  values (
    v_job_id,
    v_user_id,
    v_user_id,
    'revocation-integrity-test'
  );

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
    'revocation-integrity-test/test.pdf',
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
      'revocation-integrity-test',
      'REVOCATION-TARGET-A-' || v_finding_a::text,
      '1',
      'revocation-integrity-test',
      '1',
      'TEST',
      'PASS',
      'Temporary rollback-only integrity test finding A.',
      'test'
    ),
    (
      v_finding_b,
      v_item_id,
      v_user_id,
      'revocation-integrity-test',
      'REVOCATION-TARGET-B-' || v_finding_b::text,
      '1',
      'revocation-integrity-test',
      '1',
      'TEST',
      'PASS',
      'Temporary rollback-only integrity test finding B.',
      'test'
    );

  insert into public.finding_reviews (
    finding_id,
    user_id,
    reviewer_id,
    decision,
    manifest_sha256
  )
  values (
    v_finding_a,
    v_user_id,
    v_user_id,
    'approved',
    'revocation-integrity-test-manifest'
  )
  returning id into v_approval_id;

  insert into public.finding_reviews (
    finding_id,
    user_id,
    reviewer_id,
    decision,
    manifest_sha256
  )
  values (
    v_finding_a,
    v_user_id,
    v_user_id,
    'remediation_requested',
    'revocation-integrity-test-manifest'
  )
  returning id into v_nonapproval_id;

  begin
    insert into public.finding_reviews (
      finding_id,
      user_id,
      reviewer_id,
      decision,
      manifest_sha256,
      revoked_at,
      revoked_review_id
    )
    values (
      v_finding_b,
      v_user_id,
      v_user_id,
      'approved',
      'revocation-integrity-test-manifest',
      now(),
      v_approval_id
    );

    raise exception 'TEST_FAILED: cross-finding revocation was accepted.';
  exception
    when others then
      if sqlerrm not like '%same finding%' then
        raise;
      end if;
  end;

  begin
    insert into public.finding_reviews (
      finding_id,
      user_id,
      reviewer_id,
      decision,
      manifest_sha256,
      revoked_at,
      revoked_review_id
    )
    values (
      v_finding_a,
      v_user_id,
      v_user_id,
      'approved',
      'revocation-integrity-test-manifest',
      now(),
      v_nonapproval_id
    );

    raise exception 'TEST_FAILED: non-approved revocation target was accepted.';
  exception
    when others then
      if sqlerrm not like '%Only an approved review may be revoked%' then
        raise;
      end if;
  end;

  begin
    insert into public.finding_reviews (
      finding_id,
      user_id,
      reviewer_id,
      decision,
      manifest_sha256,
      revoked_review_id
    )
    values (
      v_finding_a,
      v_user_id,
      v_user_id,
      'approved',
      'revocation-integrity-test-manifest',
      v_approval_id
    );

    raise exception 'TEST_FAILED: revocation without revoked_at was accepted.';
  exception
    when others then
      if sqlerrm not like '%Revocation records must represent a revoked approval%' then
        raise;
      end if;
  end;

  insert into public.finding_reviews (
    finding_id,
    user_id,
    reviewer_id,
    decision,
    manifest_sha256,
    revoked_at,
    revoked_review_id
  )
  values (
    v_finding_a,
    v_user_id,
    v_user_id,
    'approved',
    'revocation-integrity-test-manifest',
    now(),
    v_approval_id
  )
  returning id into v_revocation_id;

  begin
    insert into public.finding_reviews (
      finding_id,
      user_id,
      reviewer_id,
      decision,
      manifest_sha256,
      revoked_at,
      revoked_review_id
    )
    values (
      v_finding_a,
      v_user_id,
      v_user_id,
      'approved',
      'revocation-integrity-test-manifest',
      now(),
      v_revocation_id
    );

    raise exception 'TEST_FAILED: revocation-of-revocation was accepted.';
  exception
    when others then
      if sqlerrm not like '%revocation record cannot itself be revoked%' then
        raise;
      end if;
  end;

  raise notice 'PASS: revocation target integrity database regression';
end
$$;

rollback;
