create function public.complete_onboarding(
  input_display_name text,
  input_salary_cycle_day smallint,
  input_accounts jsonb,
  input_cards jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  account jsonb;
  card jsonb;
  account_ids jsonb := '{}'::jsonb;
  account_id uuid;
begin
  if current_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if char_length(btrim(input_display_name)) = 0 or input_salary_cycle_day not between 1 and 31 then
    raise exception 'invalid onboarding input' using errcode = '23514';
  end if;

  update public.profiles
    set display_name = btrim(input_display_name), salary_cycle_day = input_salary_cycle_day, onboarding_completed = true
    where id = current_user_id;
  if not found then raise exception 'profile not found' using errcode = 'P0002'; end if;

  for account in select value from jsonb_array_elements(input_accounts)
  loop
    if account->>'type' = 'DEBIT' then continue; end if;
    insert into public.accounts (user_id, name, type, initial_balance)
    values (current_user_id, account->>'name', (account->>'type')::public.account_type, (account->>'initial_balance')::numeric)
    returning id into account_id;
    account_ids := account_ids || jsonb_build_object(account->>'key', account_id);
  end loop;
  for account in select value from jsonb_array_elements(input_accounts)
  loop
    if account->>'type' <> 'DEBIT' then continue; end if;
    insert into public.accounts (user_id, name, type, initial_balance, linked_account_id)
    values (current_user_id, account->>'name', 'DEBIT', 0, (account_ids->>(account->>'linked_account_key'))::uuid)
    returning id into account_id;
    account_ids := account_ids || jsonb_build_object(account->>'key', account_id);
  end loop;
  for card in select value from jsonb_array_elements(input_cards)
  loop
    insert into public.credit_card_settings (user_id, account_id, payment_day, payment_account_id, credit_limit, billing_cycle_rule)
    values (current_user_id, (account_ids->>(card->>'account_key'))::uuid, (card->>'payment_day')::smallint,
      (account_ids->>(card->>'payment_account_key'))::uuid, nullif(card->>'credit_limit', '')::numeric, '{}'::jsonb);
  end loop;
  insert into public.categories (user_id, name, kind, is_system_default, sort_order)
  select current_user_id, name, kind, true, ordinality
  from unnest(array['급여','식비','교통','주거','생활','쇼핑','취미','구독','차량','여행','건강','교육','경조사','저축','기타'],
                    array['INCOME','EXPENSE','EXPENSE','EXPENSE','EXPENSE','EXPENSE','EXPENSE','EXPENSE','EXPENSE','EXPENSE','EXPENSE','EXPENSE','EXPENSE','EXPENSE','EXPENSE'])
       with ordinality as categories(name, kind, ordinality);
end;
$$;

revoke all on function public.complete_onboarding(text, smallint, jsonb, jsonb) from public;
grant execute on function public.complete_onboarding(text, smallint, jsonb, jsonb) to authenticated;
