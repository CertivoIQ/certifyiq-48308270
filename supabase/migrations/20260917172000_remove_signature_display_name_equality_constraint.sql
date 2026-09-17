-- Remove the obsolete equality requirement between the final-review display name
-- and the typed legal/full signature. The existing independent length checks for
-- responsible_party_name, responsible_party_position, and signature_text remain.
alter table public.certification_final_review_confirmations
  drop constraint if exists certification_final_review_confirmations_check;
