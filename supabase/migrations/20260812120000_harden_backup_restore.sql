alter function public.restore_backup(jsonb)
  rename to restore_backup_for_current_user;

revoke all on function public.restore_backup_for_current_user(jsonb) from public, authenticated;

create function public.restore_backup(target_user_id uuid, input_backup jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sorted_backup jsonb;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required' using errcode = '22004';
  end if;

  if input_backup is null or jsonb_typeof(input_backup) <> 'object' then
    raise exception 'input_backup must be an object' using errcode = '22023';
  end if;

  -- The current-user function's account trigger resolves a DEBIT parent during
  -- insert, so preserve every supplied row while placing all non-DEBIT parents first.
  select jsonb_set(
    input_backup,
    '{accounts}',
    coalesce(
      (
        select jsonb_agg(account order by case when account->>'type' = 'DEBIT' then 1 else 0 end)
        from jsonb_array_elements(coalesce(input_backup->'accounts', '[]'::jsonb)) as account
      ),
      '[]'::jsonb
    )
  ) into sorted_backup;

  -- Only the server's service-role client can invoke this wrapper. It supplies
  -- the authenticated route's already-validated target user, then executes the
  -- existing transactional routine with an internal auth context.
  perform set_config('request.jwt.claim.sub', target_user_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', target_user_id, 'role', 'authenticated')::text,
    true
  );
  perform public.restore_backup_for_current_user(sorted_backup);
end;
$$;

revoke all on function public.restore_backup(uuid, jsonb) from public, authenticated;
grant execute on function public.restore_backup(uuid, jsonb) to service_role;
