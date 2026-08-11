create unique index savings_contributions_transfer_id_key
  on public.savings_contributions (transfer_id)
  where transfer_id is not null;

create function public.validate_savings_contribution_transfer()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  linked_transfer public.transactions%rowtype;
begin
  if new.transaction_id is not null then
    raise exception 'savings contributions cannot link transaction_id'
      using errcode = '23514';
  end if;

  if new.transfer_id is not null then
    select * into linked_transfer
    from public.transactions
    where id = new.transfer_id;

    if not found or linked_transfer.user_id is distinct from new.user_id then
      raise exception 'transfer_id must reference a transaction owned by the contribution user'
        using errcode = '23514';
    end if;

    if linked_transfer.type <> 'TRANSFER' then
      raise exception 'transfer_id must reference a TRANSFER transaction'
        using errcode = '23514';
    end if;

    if linked_transfer.status <> 'CONFIRMED' then
      raise exception 'transfer_id must reference a CONFIRMED transaction'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger savings_contributions_validate_transfer
before insert or update on public.savings_contributions
for each row execute function public.validate_savings_contribution_transfer();
