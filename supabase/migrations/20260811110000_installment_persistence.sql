create function public.create_installment_purchase(
  input_purchase jsonb,
  payment_schedule jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  card_account public.accounts%rowtype;
  purchase_amount numeric;
  installment_count integer;
  schedule_count integer;
  schedule_row jsonb;
  expected_sequence integer := 0;
  principal_sum numeric := 0;
  new_transaction_id uuid;
  new_plan_id uuid;
begin
  if current_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;

  select * into card_account
  from public.accounts
  where id = (input_purchase->>'account_id')::uuid and user_id = current_user_id;
  if not found or card_account.type <> 'CREDIT_CARD' or not card_account.is_active then
    raise exception 'installment purchase requires an owned active CREDIT_CARD account' using errcode = '23514';
  end if;

  purchase_amount := (input_purchase->>'amount')::numeric;
  installment_count := (input_purchase->>'installment_count')::integer;
  schedule_count := jsonb_array_length(payment_schedule);
  if installment_count <= 1 or schedule_count <> installment_count then
    raise exception 'installment schedule must contain installment_count contiguous rows' using errcode = '23514';
  end if;

  for schedule_row in select value from jsonb_array_elements(payment_schedule) with ordinality as elements(value, ordinality) order by ordinality
  loop
    expected_sequence := expected_sequence + 1;
    if (schedule_row->>'sequence')::integer <> expected_sequence then
      raise exception 'installment schedule must contain installment_count contiguous rows' using errcode = '23514';
    end if;
    principal_sum := principal_sum + (schedule_row->>'principal_amount')::numeric;
  end loop;
  if principal_sum <> purchase_amount then
    raise exception 'installment schedule principal must sum to the purchase amount' using errcode = '23514';
  end if;

  insert into public.transactions (
    user_id, type, status, transaction_at, amount, currency, base_amount, base_currency, category_id, account_id, memo
  ) values (
    current_user_id, 'EXPENSE', 'CONFIRMED', (input_purchase->>'transaction_at')::timestamptz, purchase_amount, 'KRW',
    purchase_amount, 'KRW', nullif(input_purchase->>'category_id', '')::uuid, card_account.id, input_purchase->>'memo'
  ) returning id into new_transaction_id;

  insert into public.installment_plans (
    user_id, transaction_id, total_amount, installment_count, interest_type, start_month
  ) values (
    current_user_id, new_transaction_id, purchase_amount, installment_count,
    input_purchase->>'interest_type', (input_purchase->>'start_month')::date
  ) returning id into new_plan_id;

  for schedule_row in select value from jsonb_array_elements(payment_schedule) with ordinality as elements(value, ordinality) order by ordinality
  loop
    insert into public.installment_payments (
      user_id, installment_plan_id, sequence, scheduled_date, principal_amount, fee_amount, status
    ) values (
      current_user_id, new_plan_id, (schedule_row->>'sequence')::integer, (schedule_row->>'scheduled_date')::date,
      (schedule_row->>'principal_amount')::numeric, coalesce((schedule_row->>'fee_amount')::numeric, 0), 'SCHEDULED'
    );
  end loop;

  return new_plan_id;
end;
$$;

revoke all on function public.create_installment_purchase(jsonb, jsonb) from public;
grant execute on function public.create_installment_purchase(jsonb, jsonb) to authenticated;

create function public.create_installment_settlement(
  input_payment_id uuid,
  input_payment_account_id uuid,
  input_transaction_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  payment public.installment_payments%rowtype;
  plan public.installment_plans%rowtype;
  card_account_id uuid;
  payment_account public.accounts%rowtype;
  transfer_amount numeric;
  new_transfer_id uuid;
begin
  if current_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;

  select * into payment
  from public.installment_payments
  where id = input_payment_id and user_id = current_user_id
  for update;
  if not found then raise exception 'installment payment not found' using errcode = 'P0002'; end if;
  if payment.status <> 'SCHEDULED' then
    raise exception 'installment payment already settled' using errcode = '23514';
  end if;

  select * into plan from public.installment_plans where id = payment.installment_plan_id and user_id = current_user_id;
  if not found then raise exception 'installment plan not found' using errcode = 'P0002'; end if;

  select account_id into card_account_id from public.transactions where id = plan.transaction_id and user_id = current_user_id;
  if card_account_id is null then raise exception 'installment purchase transaction not found' using errcode = 'P0002'; end if;

  select * into payment_account
  from public.accounts
  where id = input_payment_account_id and user_id = current_user_id;
  if not found or payment_account.type not in ('BANK', 'CASH') or not payment_account.is_active then
    raise exception 'installment settlement requires an owned active BANK or CASH account' using errcode = '23514';
  end if;

  transfer_amount := payment.principal_amount + payment.fee_amount;

  insert into public.transactions (
    user_id, type, status, transaction_at, amount, currency, base_amount, base_currency, from_account_id, to_account_id
  ) values (
    current_user_id, 'TRANSFER', 'CONFIRMED', input_transaction_at, transfer_amount, 'KRW',
    transfer_amount, 'KRW', payment_account.id, card_account_id
  ) returning id into new_transfer_id;

  update public.installment_payments
  set status = 'PAID', settlement_transfer_id = new_transfer_id
  where id = payment.id and user_id = current_user_id;

  return new_transfer_id;
end;
$$;

revoke all on function public.create_installment_settlement(uuid, uuid, timestamptz) from public;
grant execute on function public.create_installment_settlement(uuid, uuid, timestamptz) to authenticated;
