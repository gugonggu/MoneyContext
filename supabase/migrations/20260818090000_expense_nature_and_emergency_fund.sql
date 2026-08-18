create type public.transaction_expense_nature as enum (
  'RECURRING', 'ONE_TIME', 'IRREGULAR', 'EXCEPTIONAL', 'UNKNOWN'
);

alter table public.transactions
  add column expense_nature_user public.transaction_expense_nature,
  add column expense_nature_source text not null default 'UNSET'
    check (expense_nature_source in ('UNSET', 'MANUAL', 'SUGGESTED'));

-- UNSET은 값이 없어야 하고, MANUAL/SUGGESTED는 값이 있어야 한다.
alter table public.transactions
  add constraint transactions_expense_nature_source_consistency check (
    (expense_nature_source = 'UNSET' and expense_nature_user is null)
    or (expense_nature_source <> 'UNSET' and expense_nature_user is not null)
  );

alter table public.profiles
  add column emergency_fund_amount numeric(18, 2)
    constraint profiles_emergency_fund_amount_nonnegative check (
      emergency_fund_amount is null or emergency_fund_amount >= 0
    );
