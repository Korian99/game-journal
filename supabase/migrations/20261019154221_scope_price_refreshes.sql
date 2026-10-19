-- Both scheduled and manual workers claim from this queue.
-- Existing links/prices stay saved when a game moves out of these lists.
create or replace function public.claim_offers(member_id uuid default null)
returns setof public.offers
language sql security definer set search_path = '' as $$
  update public.offers o
  set lease_until = now() + interval '3 minutes'
  where o.id in (
    select x.id
    from public.offers x
    join public.members m on m.id = x.owner_id and m.active
    where (member_id is null or x.owner_id = member_id)
      and exists (
        select 1 from public.playthroughs p
        where p.game_id = x.game_id and p.owner_id = x.owner_id
          and p.data->>'status' in ('wishlist', 'upcoming')
      )
      and (x.lease_until is null or x.lease_until < now())
      and (x.checked_at is null or x.checked_at < now() -
        case when member_id is null then interval '170 minutes' else interval '5 minutes' end)
    order by x.checked_at nulls first
    for update of x skip locked limit 8
  )
  returning o.*;
$$;
revoke all on function public.claim_offers(uuid) from public, anon, authenticated;
grant execute on function public.claim_offers(uuid) to service_role;
