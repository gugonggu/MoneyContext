-- A TRANSFER used to require both a source and a destination account owned by
-- the user, modeling only "money moving between my own accounts" (net-worth
-- neutral). Money sent to or received from someone outside the tracked
-- accounts (e.g. paying a friend back) only has one real side; the other side
-- is external and isn't tracked here. Relax the constraint so a TRANSFER may
-- have just one of from_account_id/to_account_id, while still requiring at
-- least one and forbidding a transfer to itself.

alter table public.transactions
  drop constraint transactions_type_fields;

alter table public.transactions
  add constraint transactions_type_fields check (
    (type in ('INCOME', 'EXPENSE', 'ADJUSTMENT')
      and account_id is not null
      and from_account_id is null
      and to_account_id is null)
    or (type = 'TRANSFER'
      and account_id is null
      and (from_account_id is not null or to_account_id is not null)
      and (from_account_id is null or to_account_id is null or from_account_id <> to_account_id))
  );
