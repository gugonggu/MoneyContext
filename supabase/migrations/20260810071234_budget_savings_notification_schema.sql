create table public.monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  year smallint not null,
  month smallint not null check (month between 1 and 12),
  total_budget numeric(18, 2) not null check (total_budget >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, year, month)
);

create table public.category_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  year smallint not null,
  month smallint not null check (month between 1 and 12),
  category_id uuid not null references public.categories(id),
  base_budget numeric(18, 2) not null check (base_budget >= 0),
  rollover_enabled boolean not null default false,
  rollover_amount numeric(18, 2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, year, month, category_id)
);

create index category_budgets_user_period_idx
  on public.category_budgets (user_id, year, month);

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  target_amount numeric(18, 2) not null check (target_amount > 0),
  target_date date not null,
  monthly_contribution_plan numeric(18, 2) not null default 0 check (monthly_contribution_plan >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index savings_goals_user_active_idx on public.savings_goals (user_id, is_active);

create table public.savings_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  amount numeric(18, 2) not null check (amount > 0),
  contribution_date date not null,
  transaction_id uuid references public.transactions(id),
  transfer_id uuid references public.transactions(id),
  created_at timestamptz not null default timezone('utc', now()),
  constraint savings_contributions_single_source check (
    transaction_id is null or transfer_id is null
  )
);

create unique index savings_contributions_goal_transaction_key
  on public.savings_contributions (goal_id, transaction_id)
  where transaction_id is not null;
create unique index savings_contributions_goal_transfer_key
  on public.savings_contributions (goal_id, transfer_id)
  where transfer_id is not null;
create index savings_contributions_user_goal_date_idx
  on public.savings_contributions (user_id, goal_id, contribution_date);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  message text not null,
  related_entity_type text,
  related_entity_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  read_at timestamptz
);

create index notifications_user_read_created_at_idx
  on public.notifications (user_id, is_read, created_at desc);

create trigger monthly_budgets_set_updated_at
before update on public.monthly_budgets
for each row execute function public.set_updated_at();

create trigger category_budgets_set_updated_at
before update on public.category_budgets
for each row execute function public.set_updated_at();

create trigger savings_goals_set_updated_at
before update on public.savings_goals
for each row execute function public.set_updated_at();

-- Task 6 adds the least-privilege policies. RLS prevents temporary exposure.
alter table public.monthly_budgets enable row level security;
alter table public.category_budgets enable row level security;
alter table public.savings_goals enable row level security;
alter table public.savings_contributions enable row level security;
alter table public.notifications enable row level security;
