create or replace function public.restore_backup_for_current_user(input_backup jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  perform 1
  from public.profiles
  where id = current_user_id
  for update;
  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  update public.profiles
  set
    display_name = input_backup #>> '{profile,display_name}',
    base_currency = input_backup #>> '{profile,base_currency}',
    salary_cycle_day = (input_backup #>> '{profile,salary_cycle_day}')::smallint,
    timezone = input_backup #>> '{profile,timezone}',
    onboarding_completed = (input_backup #>> '{profile,onboarding_completed}')::boolean
  where id = current_user_id;

  delete from public.transaction_tags
  where transaction_id in (select id from public.transactions where user_id = current_user_id);
  delete from public.savings_contributions where user_id = current_user_id;
  delete from public.installment_payments where user_id = current_user_id;
  delete from public.installment_plans where user_id = current_user_id;
  update public.planned_transactions set converted_transaction_id = null where user_id = current_user_id;
  update public.transactions
  set recurring_rule_id = null, planned_transaction_id = null
  where user_id = current_user_id;
  delete from public.transactions where user_id = current_user_id;
  delete from public.recurring_transactions where user_id = current_user_id;
  delete from public.planned_transactions where user_id = current_user_id;
  delete from public.credit_card_settings where user_id = current_user_id;
  delete from public.category_budgets where user_id = current_user_id;
  delete from public.monthly_budgets where user_id = current_user_id;
  delete from public.savings_goals where user_id = current_user_id;
  delete from public.accounts where user_id = current_user_id;
  delete from public.categories where user_id = current_user_id;
  delete from public.tags where user_id = current_user_id;

  insert into public.accounts (id, user_id, name, type, initial_balance, linked_account_id, is_active, sort_order)
  select row.id, current_user_id, row.name, row.type, row.initial_balance, row.linked_account_id, row.is_active, row.sort_order
  from jsonb_to_recordset(input_backup -> 'accounts') as row(
    id uuid, name text, type public.account_type, initial_balance numeric, linked_account_id uuid, is_active boolean, sort_order integer
  );

  insert into public.categories (id, user_id, name, kind, is_system_default, is_active, sort_order)
  select row.id, current_user_id, row.name, row.kind, row.is_system_default, row.is_active, row.sort_order
  from jsonb_to_recordset(input_backup -> 'categories') as row(
    id uuid, name text, kind text, is_system_default boolean, is_active boolean, sort_order integer
  );

  insert into public.tags (id, user_id, name, is_active)
  select row.id, current_user_id, row.name, row.is_active
  from jsonb_to_recordset(input_backup -> 'tags') as row(id uuid, name text, is_active boolean);

  insert into public.credit_card_settings (
    id, user_id, account_id, payment_day, payment_account_id, credit_limit,
    billing_cycle_start_offset, billing_cycle_end_offset, billing_cycle_rule
  )
  select row.id, current_user_id, row.account_id, row.payment_day, row.payment_account_id, row.credit_limit,
    row.billing_cycle_start_offset, row.billing_cycle_end_offset, row.billing_cycle_rule
  from jsonb_to_recordset(input_backup -> 'credit_card_settings') as row(
    id uuid, account_id uuid, payment_day smallint, payment_account_id uuid, credit_limit numeric,
    billing_cycle_start_offset integer, billing_cycle_end_offset integer, billing_cycle_rule jsonb
  );

  insert into public.recurring_transactions (
    id, user_id, type, amount, currency, account_id, category_id, memo, frequency, interval_count,
    day_of_month, start_date, end_date, next_run_date, confirmation_mode, is_active
  )
  select row.id, current_user_id, row.type, row.amount, row.currency, row.account_id, row.category_id, row.memo,
    row.frequency, row.interval_count, row.day_of_month, row.start_date, row.end_date, row.next_run_date,
    row.confirmation_mode, row.is_active
  from jsonb_to_recordset(input_backup -> 'recurring_transactions') as row(
    id uuid, type public.transaction_type, amount numeric, currency char(3), account_id uuid, category_id uuid,
    memo text, frequency text, interval_count integer, day_of_month smallint, start_date date, end_date date,
    next_run_date date, confirmation_mode public.confirmation_mode, is_active boolean
  );

  insert into public.planned_transactions (
    id, user_id, type, status, scheduled_date, amount, currency, base_amount, base_currency,
    exchange_rate, account_id, category_id, memo
  )
  select row.id, current_user_id, row.type, row.status, row.scheduled_date, row.amount, row.currency,
    row.base_amount, row.base_currency, row.exchange_rate, row.account_id, row.category_id, row.memo
  from jsonb_to_recordset(input_backup -> 'planned_transactions') as row(
    id uuid, type public.transaction_type, status public.planned_status, scheduled_date date, amount numeric,
    currency char(3), base_amount numeric, base_currency char(3), exchange_rate numeric, account_id uuid,
    category_id uuid, memo text
  );

  insert into public.transactions (
    id, user_id, type, status, transaction_at, amount, currency, base_amount, base_currency, exchange_rate,
    category_id, account_id, from_account_id, to_account_id, memo, recurring_rule_id,
    recurring_occurrence_date, planned_transaction_id
  )
  select row.id, current_user_id, row.type, row.status, row.transaction_at, row.amount, row.currency,
    row.base_amount, row.base_currency, row.exchange_rate, row.category_id, row.account_id,
    row.from_account_id, row.to_account_id, row.memo, row.recurring_rule_id,
    row.recurring_occurrence_date, row.planned_transaction_id
  from jsonb_to_recordset(input_backup -> 'transactions') as row(
    id uuid, type public.transaction_type, status public.transaction_status, transaction_at timestamptz,
    amount numeric, currency char(3), base_amount numeric, base_currency char(3), exchange_rate numeric,
    category_id uuid, account_id uuid, from_account_id uuid, to_account_id uuid, memo text,
    recurring_rule_id uuid, recurring_occurrence_date date, planned_transaction_id uuid
  );

  update public.planned_transactions as planned
  set converted_transaction_id = row.converted_transaction_id
  from jsonb_to_recordset(input_backup -> 'planned_transactions') as row(id uuid, converted_transaction_id uuid)
  where planned.id = row.id and planned.user_id = current_user_id;

  insert into public.transaction_tags (transaction_id, tag_id)
  select row.transaction_id, row.tag_id
  from jsonb_to_recordset(input_backup -> 'transaction_tags') as row(transaction_id uuid, tag_id uuid);

  insert into public.installment_plans (id, user_id, transaction_id, total_amount, installment_count, interest_type, start_month)
  select row.id, current_user_id, row.transaction_id, row.total_amount, row.installment_count, row.interest_type, row.start_month
  from jsonb_to_recordset(input_backup -> 'installment_plans') as row(
    id uuid, transaction_id uuid, total_amount numeric, installment_count integer, interest_type text, start_month date
  );

  insert into public.installment_payments (
    id, user_id, installment_plan_id, sequence, scheduled_date, principal_amount, fee_amount, status, settlement_transfer_id
  )
  select row.id, current_user_id, row.installment_plan_id, row.sequence, row.scheduled_date,
    row.principal_amount, row.fee_amount, row.status, row.settlement_transfer_id
  from jsonb_to_recordset(input_backup -> 'installment_payments') as row(
    id uuid, installment_plan_id uuid, sequence integer, scheduled_date date, principal_amount numeric,
    fee_amount numeric, status public.installment_status, settlement_transfer_id uuid
  );

  insert into public.monthly_budgets (id, user_id, year, month, total_budget)
  select row.id, current_user_id, row.year, row.month, row.total_budget
  from jsonb_to_recordset(input_backup -> 'monthly_budgets') as row(id uuid, year smallint, month smallint, total_budget numeric);

  insert into public.category_budgets (
    id, user_id, year, month, category_id, base_budget, rollover_enabled, rollover_amount
  )
  select row.id, current_user_id, row.year, row.month, row.category_id, row.base_budget, row.rollover_enabled, row.rollover_amount
  from jsonb_to_recordset(input_backup -> 'category_budgets') as row(
    id uuid, year smallint, month smallint, category_id uuid, base_budget numeric, rollover_enabled boolean, rollover_amount numeric
  );

  insert into public.savings_goals (id, user_id, name, target_amount, target_date, monthly_contribution_plan, is_active)
  select row.id, current_user_id, row.name, row.target_amount, row.target_date, row.monthly_contribution_plan, row.is_active
  from jsonb_to_recordset(input_backup -> 'savings_goals') as row(
    id uuid, name text, target_amount numeric, target_date date, monthly_contribution_plan numeric, is_active boolean
  );

  insert into public.savings_contributions (
    id, user_id, goal_id, amount, contribution_date, transaction_id, transfer_id
  )
  select row.id, current_user_id, row.goal_id, row.amount, row.contribution_date, row.transaction_id, row.transfer_id
  from jsonb_to_recordset(input_backup -> 'savings_contributions') as row(
    id uuid, goal_id uuid, amount numeric, contribution_date date, transaction_id uuid, transfer_id uuid
  );
end;
$$;

revoke all on function public.restore_backup_for_current_user(jsonb) from public, authenticated;
