create function public.generate_due_recurring_transactions(input_today date)
returns table (
  rule_id uuid,
  occurrence_date date,
  transaction_status public.transaction_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  recurring_rule public.recurring_transactions%rowtype;
  due_date date;
  following_date date;
  target_month date;
  generated_status public.transaction_status;
  inserted_occurrence boolean;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if input_today is null then
    raise exception 'input_today is required' using errcode = '22004';
  end if;

  for recurring_rule in
    select recurring.*
    from public.recurring_transactions as recurring
    where recurring.user_id = current_user_id
      and recurring.is_active
      and recurring.next_run_date <= input_today
    order by recurring.next_run_date, recurring.id
    for update
  loop
    due_date := recurring_rule.next_run_date;

    while due_date <= input_today
      and (recurring_rule.end_date is null or due_date <= recurring_rule.end_date)
    loop
      generated_status := case recurring_rule.confirmation_mode
        when 'AUTO_CONFIRM' then 'CONFIRMED'::public.transaction_status
        when 'REQUIRE_CONFIRMATION' then 'PENDING'::public.transaction_status
      end;
      inserted_occurrence := true;

      begin
        insert into public.transactions (
          user_id,
          type,
          status,
          transaction_at,
          amount,
          currency,
          base_amount,
          base_currency,
          category_id,
          account_id,
          memo,
          recurring_rule_id,
          recurring_occurrence_date
        ) values (
          current_user_id,
          recurring_rule.type,
          generated_status,
          due_date::timestamp at time zone 'Asia/Seoul',
          recurring_rule.amount,
          'KRW',
          recurring_rule.amount,
          'KRW',
          recurring_rule.category_id,
          recurring_rule.account_id,
          recurring_rule.memo,
          recurring_rule.id,
          due_date
        );
      exception
        when unique_violation then
          inserted_occurrence := false;
      end;

      if recurring_rule.frequency = 'DAILY' then
        following_date := due_date + recurring_rule.interval_count;
      elsif recurring_rule.frequency = 'WEEKLY' then
        following_date := due_date + (recurring_rule.interval_count * 7);
      elsif recurring_rule.frequency = 'MONTHLY' then
        if recurring_rule.day_of_month is null then
          raise exception 'monthly recurring rule requires day_of_month' using errcode = '23514';
        end if;

        target_month := (
          date_trunc('month', due_date)::date
          + make_interval(months => recurring_rule.interval_count)
        )::date;
        following_date := target_month + (
          least(
            recurring_rule.day_of_month::integer,
            extract(day from (target_month + interval '1 month - 1 day'))::integer
          ) - 1
        );
      else
        raise exception 'unsupported recurring frequency: %', recurring_rule.frequency using errcode = '23514';
      end if;

      update public.recurring_transactions
      set next_run_date = following_date
      where id = recurring_rule.id
        and user_id = current_user_id;

      if inserted_occurrence then
        rule_id := recurring_rule.id;
        occurrence_date := due_date;
        transaction_status := generated_status;
        return next;
      end if;

      due_date := following_date;
    end loop;
  end loop;
end;
$$;

revoke all on function public.generate_due_recurring_transactions(date) from public;
grant execute on function public.generate_due_recurring_transactions(date) to authenticated;
