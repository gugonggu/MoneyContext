alter table public.notifications
  add column dedupe_key text,
  add column dedupe_day date;

update public.notifications
set
  dedupe_key = concat('legacy:', id),
  dedupe_day = (created_at at time zone 'Asia/Seoul')::date
where dedupe_key is null or dedupe_day is null;

alter table public.notifications
  alter column dedupe_key set not null,
  alter column dedupe_day set not null,
  add constraint notifications_dedupe_key_not_blank check (char_length(btrim(dedupe_key)) > 0),
  add constraint notifications_user_dedupe_key_day_key unique (user_id, dedupe_key, dedupe_day);
