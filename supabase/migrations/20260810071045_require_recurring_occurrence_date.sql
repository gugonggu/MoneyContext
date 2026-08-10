alter table public.transactions
  add constraint transactions_recurring_occurrence_date_required
  check (recurring_rule_id is null or recurring_occurrence_date is not null);
