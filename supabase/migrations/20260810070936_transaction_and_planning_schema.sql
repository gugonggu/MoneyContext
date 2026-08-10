create table public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.transaction_type not null check (type in ('INCOME', 'EXPENSE')),
  amount numeric(18, 2) not null check (amount >= 0),
  currency char(3) not null,
  account_id uuid not null references public.accounts(id),
  category_id uuid references public.categories(id),
  memo text,
  frequency text not null,
  interval_count integer not null default 1 check (interval_count > 0),
  day_of_month smallint check (day_of_month between 1 and 31),
  start_date date not null,
  end_date date,
  next_run_date date not null,
  confirmation_mode public.confirmation_mode not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint recurring_transactions_date_range check (end_date is null or end_date >= start_date)
);

create index recurring_transactions_user_active_next_run_idx
  on public.recurring_transactions (user_id, is_active, next_run_date);

create table public.planned_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.transaction_type not null check (type in ('INCOME', 'EXPENSE')),
  status public.planned_status not null default 'PLANNED',
  scheduled_date date not null,
  amount numeric(18, 2) not null check (amount >= 0),
  currency char(3) not null,
  base_amount numeric(18, 2),
  base_currency char(3) not null default 'KRW',
  exchange_rate numeric(24, 10),
  account_id uuid references public.accounts(id),
  category_id uuid references public.categories(id),
  memo text,
  converted_transaction_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint planned_transactions_base_amount_nonnegative check (
    base_amount is null or base_amount >= 0
  ),
  constraint planned_transactions_exchange_rate_positive check (
    exchange_rate is null or exchange_rate > 0
  )
);

create index planned_transactions_user_status_scheduled_date_idx
  on public.planned_transactions (user_id, status, scheduled_date);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.transaction_type not null,
  status public.transaction_status not null default 'CONFIRMED',
  transaction_at timestamptz not null,
  amount numeric(18, 2) not null check (amount >= 0),
  currency char(3) not null default 'KRW',
  base_amount numeric(18, 2) not null check (base_amount >= 0),
  base_currency char(3) not null default 'KRW',
  exchange_rate numeric(24, 10),
  category_id uuid references public.categories(id),
  account_id uuid references public.accounts(id),
  from_account_id uuid references public.accounts(id),
  to_account_id uuid references public.accounts(id),
  memo text,
  recurring_rule_id uuid references public.recurring_transactions(id),
  recurring_occurrence_date date,
  planned_transaction_id uuid references public.planned_transactions(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint transactions_exchange_rate_positive check (
    exchange_rate is null or exchange_rate > 0
  ),
  constraint transactions_type_fields check (
    (type in ('INCOME', 'EXPENSE', 'ADJUSTMENT')
      and account_id is not null
      and from_account_id is null
      and to_account_id is null)
    or (type = 'TRANSFER'
      and account_id is null
      and from_account_id is not null
      and to_account_id is not null
      and from_account_id <> to_account_id)
  )
);

create unique index transactions_recurring_occurrence_key
  on public.transactions (user_id, recurring_rule_id, recurring_occurrence_date)
  where recurring_rule_id is not null;
create index transactions_user_transaction_at_idx
  on public.transactions (user_id, transaction_at desc);
create index transactions_user_type_transaction_at_idx
  on public.transactions (user_id, type, transaction_at desc);
create index transactions_user_account_transaction_at_idx
  on public.transactions (user_id, account_id, transaction_at desc);
create index transactions_user_category_transaction_at_idx
  on public.transactions (user_id, category_id, transaction_at desc);

alter table public.planned_transactions
  add constraint planned_transactions_converted_transaction_fk
  foreign key (converted_transaction_id) references public.transactions(id);

create unique index planned_transactions_converted_transaction_key
  on public.planned_transactions (converted_transaction_id)
  where converted_transaction_id is not null;
create unique index transactions_planned_transaction_key
  on public.transactions (planned_transaction_id)
  where planned_transaction_id is not null;

create table public.transaction_tags (
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  tag_id uuid not null references public.tags(id),
  primary key (transaction_id, tag_id)
);

create index transaction_tags_tag_id_idx on public.transaction_tags (tag_id);

create table public.installment_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  transaction_id uuid not null unique references public.transactions(id) on delete cascade,
  total_amount numeric(18, 2) not null check (total_amount > 0),
  installment_count integer not null check (installment_count > 1),
  interest_type text not null check (interest_type in ('INTEREST_FREE', 'INTEREST_BEARING')),
  start_month date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index installment_plans_user_id_idx on public.installment_plans (user_id);

create table public.installment_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  installment_plan_id uuid not null references public.installment_plans(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  scheduled_date date not null,
  principal_amount numeric(18, 2) not null check (principal_amount >= 0),
  fee_amount numeric(18, 2) not null default 0 check (fee_amount >= 0),
  status public.installment_status not null default 'SCHEDULED',
  settlement_transfer_id uuid references public.transactions(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (installment_plan_id, sequence)
);

create index installment_payments_user_scheduled_date_idx
  on public.installment_payments (user_id, scheduled_date);

create trigger recurring_transactions_set_updated_at
before update on public.recurring_transactions
for each row execute function public.set_updated_at();

create trigger planned_transactions_set_updated_at
before update on public.planned_transactions
for each row execute function public.set_updated_at();

create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

create trigger installment_plans_set_updated_at
before update on public.installment_plans
for each row execute function public.set_updated_at();

create trigger installment_payments_set_updated_at
before update on public.installment_payments
for each row execute function public.set_updated_at();

-- Policies are introduced in Task 6. Default-deny RLS is enabled now so this
-- remote schema never exposes finance data between task boundaries.
alter table public.recurring_transactions enable row level security;
alter table public.planned_transactions enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_tags enable row level security;
alter table public.installment_plans enable row level security;
alter table public.installment_payments enable row level security;
