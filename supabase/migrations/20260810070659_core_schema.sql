create type public.user_role as enum ('USER', 'ADMIN');
create type public.account_type as enum ('BANK', 'CASH', 'DEBIT', 'CREDIT_CARD', 'LIABILITY');
create type public.transaction_type as enum ('INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT');
create type public.transaction_status as enum ('PENDING', 'CONFIRMED', 'CANCELLED');
create type public.confirmation_mode as enum ('AUTO_CONFIRM', 'REQUIRE_CONFIRMATION');
create type public.planned_status as enum ('PLANNED', 'CONFIRMED', 'CANCELLED');
create type public.installment_status as enum ('SCHEDULED', 'PAID', 'CANCELLED');
create type public.notification_type as enum (
  'RECURRING_CONFIRMATION',
  'PLANNED_DUE',
  'CARD_PAYMENT_DUE',
  'BUDGET_THRESHOLD',
  'SAVINGS_RISK',
  'SYSTEM'
);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role public.user_role not null default 'USER',
  base_currency char(3) not null default 'KRW',
  salary_cycle_day smallint not null check (salary_cycle_day between 1 and 31),
  timezone text not null default 'Asia/Seoul',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  invite_code_hash text not null,
  signup_enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  type public.account_type not null,
  initial_balance numeric(18, 2) not null default 0,
  linked_account_id uuid references public.accounts(id),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint accounts_debit_link_requirement check (
    (type = 'DEBIT' and linked_account_id is not null)
    or (type <> 'DEBIT' and linked_account_id is null)
  ),
  constraint accounts_no_self_link check (id is distinct from linked_account_id)
);

create index accounts_user_active_sort_order_idx
  on public.accounts (user_id, is_active, sort_order);
create index accounts_user_type_idx on public.accounts (user_id, type);

create table public.credit_card_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null unique references public.accounts(id) on delete cascade,
  payment_day smallint not null check (payment_day between 1 and 31),
  payment_account_id uuid not null references public.accounts(id),
  credit_limit numeric(18, 2),
  billing_cycle_start_offset integer,
  billing_cycle_end_offset integer,
  billing_cycle_rule jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint credit_card_settings_credit_limit_nonnegative check (
    credit_limit is null or credit_limit >= 0
  )
);

create index credit_card_settings_user_id_idx on public.credit_card_settings (user_id);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  kind text not null check (kind in ('INCOME', 'EXPENSE', 'BOTH')),
  is_system_default boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index categories_user_name_ci_key
  on public.categories (user_id, lower(name));

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index tags_user_name_ci_key on public.tags (user_id, lower(name));

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_updated_at();

create trigger accounts_set_updated_at
before update on public.accounts
for each row execute function public.set_updated_at();

create trigger credit_card_settings_set_updated_at
before update on public.credit_card_settings
for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger tags_set_updated_at
before update on public.tags
for each row execute function public.set_updated_at();

-- Keep newly created financial tables closed until Task 6 adds least-privilege
-- policies. This prevents an unsafe interval between schema deployment and RLS.
alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.accounts enable row level security;
alter table public.credit_card_settings enable row level security;
alter table public.categories enable row level security;
alter table public.tags enable row level security;
