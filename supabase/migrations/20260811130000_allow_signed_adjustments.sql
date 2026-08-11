alter table public.transactions
  drop constraint transactions_amount_check,
  drop constraint transactions_base_amount_check;

alter table public.transactions
  add constraint transactions_amount_by_type_check
    check (type = 'ADJUSTMENT' or amount >= 0),
  add constraint transactions_base_amount_by_type_check
    check (type = 'ADJUSTMENT' or base_amount >= 0);
