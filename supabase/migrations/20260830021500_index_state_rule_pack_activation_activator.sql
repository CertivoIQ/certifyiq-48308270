-- Cover the activation evidence audit foreign key used by reporting and reviewer history.
create index if not exists state_rule_pack_activation_events_activator_idx
  on public.state_rule_pack_activation_events (activator_id);
