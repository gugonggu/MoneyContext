-- transaction_tags.tag_id had no ON DELETE action (default NO ACTION), while
-- transaction_tags.transaction_id already cascades. Deleting a user (or any
-- flow that cascades profiles -> tags) hits a live ordering bug: Postgres's
-- immediate FK check on tag_id can fire before the transactions -> cascade
-- path has removed the referencing transaction_tags row, raising
-- "still referenced from table transaction_tags" and aborting the delete.
-- Confirmed live against the shared Supabase project while cleaning up test
-- users ahead of Task 40 (production deploy) - every user who had ever
-- tagged a transaction could not be deleted, including via the real
-- POST /api/account/delete route.
alter table public.transaction_tags
  drop constraint transaction_tags_tag_id_fkey;

alter table public.transaction_tags
  add constraint transaction_tags_tag_id_fkey
  foreign key (tag_id) references public.tags(id) on delete cascade;
