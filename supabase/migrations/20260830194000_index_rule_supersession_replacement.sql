-- Cover the replacement-rule foreign key used by supersession evidence joins.
create index if not exists state_rule_supersession_replacement_idx
  on public.state_rule_supersession_events(replacement_rule_id);

