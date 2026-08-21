begin;

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_job_id uuid := gen_random_uuid();
  v_item_id uuid := gen_random_uuid();
  v_finding_id uuid := gen_random_uuid();
  v_approval_id uuid;
  v_revocation_id uuid;
begin
  insert into auth.users (id, email, aud, role, created_at, updated_at)
  values (
    v_user_id,
    'finding-review-append-only-test@example.invalid',
    'authenticated',
    'authenticated',
    now(),
    now()
  );

  insert into public.certification_import_jobs (id, user_id, created_by, source_name)
  values (v_job_id, v_user_id, v_user_id, 'finding-review-append-only-test');

  insert into public.certification_import_items (
    id, job_id, user_id, storage_path, original_file_name, mime_type, size_bytes
  )
  values (
    v_item_id,
    v_job_id,
    v_user_id,
    'finding-review-append-only-test/test.pdf',
    'test.pdf',
    'application/pdf',
    1
  );

  insert into public.compliance_findings (
    id, item_id, user_id, organization_id, rule_id, rule_version,
    rule_pack_id, rule_pack_version, jurisdiction, status, explanation, engine_build
  )
  values (
    v_finding_id,
    v_item_id,
    v_user_id,
    'finding-review-append-only-test',
    'APPEND-ONLY-' || v_finding_id::text,
    '1',
    'finding-review-append-only-test',
    '1',
    'TEST',
    'PASS',
    'Temporary rollback-only append-only integrity test finding.',
    'test'
  );

  insert into public.finding_reviews (
    finding_id, user_id, reviewer_id, decision, reason, manifest_sha256
  )
  values (
    v_finding_id,
    v_user_id,
    v_user_id,
    'approved',
    'original approval',
    'finding-review-append-only-test-manifest'
  )
  returning id into v_approval_id;

  begin
    update public.finding_reviews
       set reason = 'mutated approval'
     where id = v_approval_id;

    raise exception 'TEST_FAILED: existing finding review update was accepted.';
  exception
    when others then
      if sqlerrm not like '%finding_reviews is append-only%' then
        raise;
      end if;
  end;

  begin
    delete from public.finding_reviews
     where id = v_approval_id;

    raise exception 'TEST_FAILED: existing finding review delete was accepted.';
  exception
    when others then
      if sqlerrm not like '%finding_reviews is append-only%' then
        raise;
      end if;
  end;

  insert into public.finding_reviews (
    finding_id,
    user_id,
    reviewer_id,
    decision,
    reason,
    manifest_sha256,
    revoked_at,
    revoked_review_id
  )
  values (
    v_finding_id,
    v_user_id,
    v_user_id,
    'approved',
    'valid appended revocation',
    'finding-review-append-only-test-manifest',
    now(),
    v_approval_id
  )
  returning id into v_revocation_id;

  if v_revocation_id is null then
    raise exception 'TEST_FAILED: valid appended revocation was not created.';
  end if;

  raise notice 'PASS: finding review append-only database integrity regression';
end;
$$;

rollback;
