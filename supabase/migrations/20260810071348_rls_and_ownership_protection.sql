create function public.assert_owned_reference(
  owner_id uuid,
  reference_id uuid,
  reference_table regclass,
  reference_field text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  reference_owner_id uuid;
begin
  if reference_id is null then return; end if;
  execute format('select user_id from %s where id = $1', reference_table)
    into reference_owner_id using reference_id;
  if reference_owner_id is distinct from owner_id then
    raise exception '% must reference a record owned by the same user', reference_field
      using errcode = '23514';
  end if;
end;
$$;

create function public.validate_account_references()
returns trigger language plpgsql set search_path = '' as $$
declare linked_type public.account_type;
begin
  if new.type = 'DEBIT' then
    perform public.assert_owned_reference(new.user_id, new.linked_account_id, 'public.accounts', 'linked_account_id');
    select type into linked_type from public.accounts where id = new.linked_account_id;
    if linked_type <> 'BANK' then raise exception 'DEBIT linked_account_id must reference a BANK account' using errcode = '23514'; end if;
  end if;
  return new;
end; $$;

create function public.validate_credit_card_settings_references()
returns trigger language plpgsql set search_path = '' as $$
declare card_type public.account_type; payment_type public.account_type;
begin
  perform public.assert_owned_reference(new.user_id, new.account_id, 'public.accounts', 'account_id');
  perform public.assert_owned_reference(new.user_id, new.payment_account_id, 'public.accounts', 'payment_account_id');
  select type into card_type from public.accounts where id = new.account_id;
  select type into payment_type from public.accounts where id = new.payment_account_id;
  if card_type <> 'CREDIT_CARD' or payment_type <> 'BANK' then
    raise exception 'credit card settings require a CREDIT_CARD and BANK payment account' using errcode = '23514';
  end if;
  return new;
end; $$;

create function public.validate_transaction_references()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform public.assert_owned_reference(new.user_id, new.account_id, 'public.accounts', 'account_id');
  perform public.assert_owned_reference(new.user_id, new.from_account_id, 'public.accounts', 'from_account_id');
  perform public.assert_owned_reference(new.user_id, new.to_account_id, 'public.accounts', 'to_account_id');
  perform public.assert_owned_reference(new.user_id, new.category_id, 'public.categories', 'category_id');
  perform public.assert_owned_reference(new.user_id, new.recurring_rule_id, 'public.recurring_transactions', 'recurring_rule_id');
  perform public.assert_owned_reference(new.user_id, new.planned_transaction_id, 'public.planned_transactions', 'planned_transaction_id');
  return new;
end; $$;

create function public.validate_transaction_tag_references()
returns trigger language plpgsql set search_path = '' as $$
declare transaction_owner uuid; tag_owner uuid;
begin
  select user_id into transaction_owner from public.transactions where id = new.transaction_id;
  select user_id into tag_owner from public.tags where id = new.tag_id;
  if transaction_owner is null or transaction_owner is distinct from tag_owner then
    raise exception 'transaction and tag must belong to the same user' using errcode = '23514';
  end if;
  return new;
end; $$;

create function public.validate_user_owned_references()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'recurring_transactions' then
    perform public.assert_owned_reference(new.user_id, new.account_id, 'public.accounts', 'account_id');
    perform public.assert_owned_reference(new.user_id, new.category_id, 'public.categories', 'category_id');
  elsif tg_table_name = 'planned_transactions' then
    perform public.assert_owned_reference(new.user_id, new.account_id, 'public.accounts', 'account_id');
    perform public.assert_owned_reference(new.user_id, new.category_id, 'public.categories', 'category_id');
    perform public.assert_owned_reference(new.user_id, new.converted_transaction_id, 'public.transactions', 'converted_transaction_id');
  elsif tg_table_name = 'category_budgets' then
    perform public.assert_owned_reference(new.user_id, new.category_id, 'public.categories', 'category_id');
  elsif tg_table_name = 'savings_contributions' then
    perform public.assert_owned_reference(new.user_id, new.goal_id, 'public.savings_goals', 'goal_id');
    perform public.assert_owned_reference(new.user_id, new.transaction_id, 'public.transactions', 'transaction_id');
    perform public.assert_owned_reference(new.user_id, new.transfer_id, 'public.transactions', 'transfer_id');
  elsif tg_table_name = 'installment_plans' then
    perform public.assert_owned_reference(new.user_id, new.transaction_id, 'public.transactions', 'transaction_id');
  elsif tg_table_name = 'installment_payments' then
    perform public.assert_owned_reference(new.user_id, new.installment_plan_id, 'public.installment_plans', 'installment_plan_id');
    perform public.assert_owned_reference(new.user_id, new.settlement_transfer_id, 'public.transactions', 'settlement_transfer_id');
  end if;
  return new;
end; $$;

create trigger accounts_validate_references before insert or update on public.accounts for each row execute function public.validate_account_references();
create trigger credit_card_settings_validate_references before insert or update on public.credit_card_settings for each row execute function public.validate_credit_card_settings_references();
create trigger transactions_validate_references before insert or update on public.transactions for each row execute function public.validate_transaction_references();
create trigger transaction_tags_validate_references before insert or update on public.transaction_tags for each row execute function public.validate_transaction_tag_references();
create trigger recurring_transactions_validate_references before insert or update on public.recurring_transactions for each row execute function public.validate_user_owned_references();
create trigger planned_transactions_validate_references before insert or update on public.planned_transactions for each row execute function public.validate_user_owned_references();
create trigger category_budgets_validate_references before insert or update on public.category_budgets for each row execute function public.validate_user_owned_references();
create trigger savings_contributions_validate_references before insert or update on public.savings_contributions for each row execute function public.validate_user_owned_references();
create trigger installment_plans_validate_references before insert or update on public.installment_plans for each row execute function public.validate_user_owned_references();
create trigger installment_payments_validate_references before insert or update on public.installment_payments for each row execute function public.validate_user_owned_references();

create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'accounts', 'credit_card_settings', 'categories', 'tags', 'recurring_transactions',
    'planned_transactions', 'transactions', 'installment_plans', 'installment_payments',
    'monthly_budgets', 'category_budgets', 'savings_goals', 'savings_contributions', 'notifications'
  ] loop
    execute format('create policy user_owned_rows on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', table_name);
  end loop;
end;
$$;

create policy transaction_tags_select_own on public.transaction_tags for select to authenticated using (
  exists (select 1 from public.transactions t where t.id = transaction_id and t.user_id = auth.uid())
);
create policy transaction_tags_insert_own on public.transaction_tags for insert to authenticated with check (
  exists (select 1 from public.transactions t where t.id = transaction_id and t.user_id = auth.uid())
  and exists (select 1 from public.tags g where g.id = tag_id and g.user_id = auth.uid())
);
create policy transaction_tags_delete_own on public.transaction_tags for delete to authenticated using (
  exists (select 1 from public.transactions t where t.id = transaction_id and t.user_id = auth.uid())
);
