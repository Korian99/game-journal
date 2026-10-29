create table public.notebooks (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  content text not null default '' check (char_length(content) <= 100000)
);

alter table public.notebooks enable row level security;
revoke all on public.notebooks from public, anon, authenticated;
grant select, insert, update on public.notebooks to authenticated;
grant all on public.notebooks to service_role;

create policy notebooks_owner on public.notebooks for all to authenticated
  using (private.is_member() and owner_id = (select auth.uid()))
  with check (private.is_member() and owner_id = (select auth.uid()));
