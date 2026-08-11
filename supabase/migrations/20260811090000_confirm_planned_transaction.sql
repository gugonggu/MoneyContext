create function public.confirm_planned_transaction(input_planned_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare current_user_id uuid := auth.uid(); p public.planned_transactions; transaction_id uuid;
begin
 if current_user_id is null then raise exception 'authentication required' using errcode='28000'; end if;
 select * into p from public.planned_transactions where id=input_planned_id and user_id=current_user_id for update;
 if not found then raise exception 'planned transaction not found' using errcode='P0002'; end if;
 if p.status <> 'PLANNED' then raise exception 'planned transaction already confirmed or cancelled' using errcode='23514'; end if;
 insert into public.transactions(user_id,type,status,transaction_at,amount,currency,base_amount,base_currency,exchange_rate,category_id,account_id,memo,planned_transaction_id)
 values(current_user_id,p.type,'CONFIRMED',p.scheduled_date::timestamptz,p.amount,p.currency,coalesce(p.base_amount,p.amount),p.base_currency,p.exchange_rate,p.category_id,p.account_id,p.memo,p.id) returning id into transaction_id;
 update public.planned_transactions set status='CONFIRMED',converted_transaction_id=transaction_id where id=p.id;
 return transaction_id;
end; $$;
revoke all on function public.confirm_planned_transaction(uuid) from public;
grant execute on function public.confirm_planned_transaction(uuid) to authenticated;
