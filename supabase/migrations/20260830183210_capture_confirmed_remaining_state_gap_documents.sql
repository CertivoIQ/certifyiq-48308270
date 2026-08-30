-- Add exact-byte captures recovered from official state authority pages.
-- Every row remains captured_unvalidated and cannot activate a compliance pack.

do $$
declare
  v_inserted integer;
begin
  with captures as (
    select *
    from jsonb_to_recordset($captures$[
      {"state_code":"AL","authority_name":"Alabama Housing Finance Authority","official_domain":"ahfa.atl1.cdn.digitaloceanspaces.com","source_type":"COMPLIANCE_GUIDEBOOK","source_url":"https://ahfa.atl1.cdn.digitaloceanspaces.com/multifamily/compliance/compliance-manual.pdf","source_sha256":"900b5cdb74186de59ed96b04cfdb0ae5300e4b4525a312d7a5ca28d3fd7d49f3","retrieved_at":"2026-08-30T18:30:43.481Z","byte_size":712066,"content_type":"application/pdf","document_title":"AHFA Compliance Manual, revised 2025-11-17","document_families":["COMPLIANCE_GUIDEBOOK"],"discovery_url":"https://www.ahfa.com/programs/rental-housing/compliance"},
      {"state_code":"AL","authority_name":"Alabama Housing Finance Authority","official_domain":"ahfa.atl1.cdn.digitaloceanspaces.com","source_type":"INCOME_LIMITS_AND_RENT_LIMITS","source_url":"https://ahfa.atl1.cdn.digitaloceanspaces.com/multifamily/compliance/2026-home-program-income-limits-and-rent-limits.pdf","source_sha256":"ee6502120a041ec4d6d10720f1ae1a10499d8556bd3328d2347c2fe9243eb1b0","retrieved_at":"2026-08-30T18:30:43.635Z","byte_size":203998,"content_type":"application/pdf","document_title":"AHFA 2026 HOME Income Limits and Rent Limits","document_families":["INCOME_LIMITS","RENT_LIMITS"],"discovery_url":"https://www.ahfa.com/programs/rental-housing/compliance"},
      {"state_code":"AL","authority_name":"Alabama Housing Finance Authority","official_domain":"ahfa.atl1.cdn.digitaloceanspaces.com","source_type":"INCOME_LIMITS_AND_RENT_LIMITS","source_url":"https://ahfa.atl1.cdn.digitaloceanspaces.com/multifamily/compliance/non-metropolitan-county-income-limits-2026.pdf","source_sha256":"62df50558126d84d2129b7752918180c954ad61e1c8d55a370babe372d6b6f86","retrieved_at":"2026-08-30T18:30:43.744Z","byte_size":105747,"content_type":"application/pdf","document_title":"AHFA 2026 Non-Metropolitan Income/Rent Limits","document_families":["INCOME_LIMITS","RENT_LIMITS"],"discovery_url":"https://www.ahfa.com/programs/rental-housing/compliance"},
      {"state_code":"AL","authority_name":"Alabama Housing Finance Authority","official_domain":"ahfa.atl1.cdn.digitaloceanspaces.com","source_type":"COMPLIANCE_FORMS","source_url":"https://ahfa.atl1.cdn.digitaloceanspaces.com/multifamily/compliance/ncsha-recommended-tic.pdf","source_sha256":"8b6c953bf667302c7370f9a479b9dbd1af858bb988c8c40a86eb0e69186be3b2","retrieved_at":"2026-08-30T18:30:43.847Z","byte_size":214282,"content_type":"application/pdf","document_title":"AHFA Tenant Income Certification","document_families":["COMPLIANCE_FORMS"],"discovery_url":"https://www.ahfa.com/programs/rental-housing/compliance"},
      {"state_code":"ME","authority_name":"Maine State Housing Authority","official_domain":"mainehousing.org","source_type":"INCOME_LIMITS_AND_RENT_LIMITS","source_url":"https://www.mainehousing.org/docs/default-source/asset-management/rent-income-charts/2026-rent-income-charts---updated-fedhome-htf.pdf?sfvrsn=c3fd9a15_1","source_sha256":"bb95274167b28a91cf38888b9b45ab0da1b709faf0a42f1cd2fb7dfaebf71c6c","retrieved_at":"2026-08-30T18:30:44.835Z","byte_size":245560,"content_type":"application/pdf","document_title":"MaineHousing 2026 Rent and Income Charts","document_families":["INCOME_LIMITS","RENT_LIMITS"],"discovery_url":"https://www.mainehousing.org/charts/rent-income-charts"},
      {"state_code":"MO","authority_name":"Missouri Housing Development Commission","official_domain":"mhdc.com","source_type":"COMPLIANCE_GUIDEBOOK","source_url":"https://mhdc.com/media/vvep4skg/lihtc-tax-credit-manual.pdf","source_sha256":"b5709e17da0fc905a5885c2cdc94b6ba751c61e5a3a844cf19960498b95c8ff8","retrieved_at":"2026-08-30T18:30:46.374Z","byte_size":2579713,"content_type":"application/pdf","document_title":"MHDC Tax Credit Manual, revised July 2025","document_families":["COMPLIANCE_GUIDEBOOK"],"discovery_url":"https://mhdc.com/programs/asset-management/program-compliance/housing-programs/low-income-housing-tax-credit-lihtc-compliance/"},
      {"state_code":"OR","authority_name":"Oregon Housing and Community Services","official_domain":"oregon.gov","source_type":"COMPLIANCE_GUIDEBOOK","source_url":"https://www.oregon.gov/ohcs/compliance-monitoring/Documents/compliance/lihtc/LIHTC%20Compliance%20Manual%202025.pdf","source_sha256":"85d9949f92e2359da731a4a4ce3c38544abb3881e430b9bbbf920b652b7cb613","retrieved_at":"2026-08-30T18:30:47.433Z","byte_size":1985003,"content_type":"application/pdf","document_title":"OHCS LIHTC Compliance Manual 2025","document_families":["COMPLIANCE_GUIDEBOOK"],"discovery_url":"https://www.oregon.gov/ohcs/compliance-monitoring/Pages/compliance-lihtc-program.aspx/1000"},
      {"state_code":"OR","authority_name":"Oregon Housing and Community Services","official_domain":"oregon.gov","source_type":"INCOME_LIMITS_AND_RENT_LIMITS","source_url":"https://www.oregon.gov/ohcs/compliance-monitoring/Pages/rent-income-limits.aspx","source_sha256":"2a93d0d2f6b32e81bb3ba7335f0d4f33748759feaee26aad5f31297a6f01dffe","retrieved_at":"2026-08-30T18:30:48.101Z","byte_size":94339,"content_type":"text/html; charset=utf-8","document_title":"OHCS 2026 Income and Rent Limits","document_families":["INCOME_LIMITS","RENT_LIMITS"],"discovery_url":"https://www.oregon.gov/ohcs/compliance-monitoring/Pages/rent-income-limits.aspx"},
      {"state_code":"OR","authority_name":"Oregon Housing and Community Services","official_domain":"oregon.gov","source_type":"UTILITY_ALLOWANCE","source_url":"https://www.oregon.gov/ohcs/compliance-monitoring/pages/utility-allowances-for-owners-and-agents.aspx","source_sha256":"764da88555b18045e6cbf30a34b89a1aed1c792c2efdf3f230a75647fb7f508a","retrieved_at":"2026-08-30T18:30:48.676Z","byte_size":114490,"content_type":"text/html; charset=utf-8","document_title":"OHCS Utility Allowance Guide for Owners and Agents","document_families":["UTILITY_ALLOWANCE"],"discovery_url":"https://www.oregon.gov/ohcs/compliance-monitoring/pages/utility-allowances-for-owners-and-agents.aspx"}
    ]$captures$::jsonb) as c(
      state_code text,authority_name text,official_domain text,source_type text,source_url text,
      source_sha256 text,retrieved_at timestamptz,byte_size integer,content_type text,
      document_title text,document_families jsonb,discovery_url text
    )
  ), latest_pack as (
    select distinct on(state_code) state_code,inventory_generated_at
    from public.state_rule_pack_candidates
    where state_code in('AL','ME','MO','OR')
    order by state_code,inventory_generated_at desc
  ), inserted as (
    insert into public.state_rule_source_candidates(
      state_code,inventory_generated_at,scope,authority_name,official_domain,origin_file,program,
      source_type,source_url,candidate_status,agent_verification_status,exact_bytes_captured,
      compliance_activation_allowed,source_sha256,retrieved_at,verification_evidence
    )
    select c.state_code,p.inventory_generated_at,'STATEWIDE',c.authority_name,c.official_domain,
      'confirmed-official-gap-document-capture-2026-08-30.json','LIHTC',c.source_type,c.source_url,
      'CAPTURED_EXACT_BYTES_PENDING_INDEPENDENT_VALIDATION','captured_unvalidated',true,false,
      c.source_sha256,c.retrieved_at,jsonb_build_object(
        'capture_kind','controlled_document','capture_actor','codex_controlled_capture',
        'capture_run','confirmed_official_gap_document_capture_2026_08_30',
        'document_title',c.document_title,'document_families',c.document_families,
        'discovery_url',c.discovery_url,'content_type',c.content_type,'captured_byte_size',c.byte_size,
        'two_consecutive_captures_match',true,'source_sha256',c.source_sha256,
        'independent_validation_required',true,'independent_validation_completed',false,
        'compliance_activation_allowed',false
      )
    from captures c join latest_pack p using(state_code)
    on conflict(state_code,inventory_generated_at,scope,source_url) do nothing
    returning 1
  )
  select count(*) into v_inserted from inserted;

  update public.state_rule_pack_candidates p
  set source_candidate_count=x.source_count,
      blocked_source_count=x.blocked_count,
      candidate_manifest=coalesce(p.candidate_manifest,'{}'::jsonb) || jsonb_build_object(
        'source_count',x.source_count,
        'required_document_family_gaps',coalesce((
          select jsonb_agg(gap order by gap)
          from jsonb_array_elements_text(coalesce(p.candidate_manifest->'required_document_family_gaps','[]'::jsonb)) g(gap)
          where not(
            (p.state_code='AL' and gap in('COMPLIANCE_GUIDEBOOK','INCOME_LIMITS','RENT_LIMITS','COMPLIANCE_FORMS')) or
            (p.state_code='ME' and gap in('INCOME_LIMITS','RENT_LIMITS')) or
            (p.state_code='MO' and gap='COMPLIANCE_GUIDEBOOK') or
            (p.state_code='OR' and gap in('COMPLIANCE_GUIDEBOOK','INCOME_LIMITS','RENT_LIMITS','UTILITY_ALLOWANCE'))
          )
        ),'[]'::jsonb),
        'last_controlled_source_capture','2026-08-30T18:30:48.676Z',
        'compliance_activation_allowed',false
      ),
      status='agent_verification_in_progress',
      compliance_activation_allowed=false,
      updated_at=now()
  from (
    select state_code,inventory_generated_at,count(*)::integer source_count,
      count(*) filter(where candidate_status like 'BLOCKED%' or agent_verification_status in('blocked','rejected'))::integer blocked_count
    from public.state_rule_source_candidates
    where state_code in('AL','ME','MO','OR')
    group by state_code,inventory_generated_at
  ) x
  where p.state_code=x.state_code and p.inventory_generated_at=x.inventory_generated_at;

  perform public.refresh_state_rule_release_work_item(id)
  from public.state_rule_pack_candidates
  where state_code in('AL','ME','MO','OR');
end $$;
