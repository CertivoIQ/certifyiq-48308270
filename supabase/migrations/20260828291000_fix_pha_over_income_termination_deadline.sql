-- Correct the Public Housing over-income termination cap to measure from the 24-month notice date.
-- 24 CFR 960.507(d)(2): tenancy must terminate no more than six months after the 24-month notification.
create or replace function public.prepare_pha_ph_over_income_notice() returns trigger language plpgsql security invoker as $$
declare c public.pha_public_housing_over_income_cases%rowtype;
begin
 select * into c from public.pha_public_housing_over_income_cases where id=new.over_income_case_id;
 if not found then raise exception 'Public Housing over-income case not found'; end if;
 perform public.assert_pha_policy_overlay(c.acop_overlay_id,c.workspace_user_id,'public_housing','acop');
 new.notice_due_date:=new.income_examination_date + 30;
 new.hearing_right_included:=coalesce(new.hearing_right_included,false);
 if new.notice_issued_at is not null and new.notice_issued_at::date > new.notice_due_date then
   raise exception 'Public Housing over-income notice exceeds the 30-day federal notice deadline';
 end if;
 if new.notice_issued_at is not null and not new.hearing_right_included then
   raise exception 'Issued Public Housing over-income notice must include the Part 966 hearing right';
 end if;
 if new.notice_stage='twelve_month' and c.pha_post_24_policy='alternative_non_public_housing_rent' and new.alternative_rent_estimate is null then
   raise exception '12-month notice requires an alternative non-public housing rent estimate when applicable under PHA policy';
 end if;
 if new.notice_stage='twenty_four_month' then
   if c.pha_post_24_policy is null then raise exception '24-month notice requires the validated ACOP post-24-month action'; end if;
   new.post_24_action:=c.pha_post_24_policy;
   if new.post_24_action='terminate' then
     if new.planned_termination_date is null then raise exception 'Termination route requires the period before tenancy termination'; end if;
     if new.notice_issued_at is not null and new.planned_termination_date > (new.notice_issued_at::date + interval '6 months') then
       raise exception 'Termination date cannot exceed six months after the 24-month notice';
     end if;
     if coalesce(trim(new.state_local_termination_notice_reference),'')='' then raise exception 'Termination route requires State/local notice-to-vacate authority reference'; end if;
   else
     if not new.lease_presented then raise exception 'Alternative-rent route requires the new non-public housing lease to be presented with the 24-month notice'; end if;
   end if;
 end if;
 new.source_snapshot:=jsonb_build_object('authority','24 CFR 960.507','notice_stage',new.notice_stage,'income_examination_date',new.income_examination_date,'notice_due_date',new.notice_due_date,'notice_date',new.notice_issued_at::date,'post_24_action',new.post_24_action);
 new.updated_at:=now(); return new;
end; $$;
