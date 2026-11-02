-- Everything the group page needs in one round trip (was 7 requests in 2 waves).
create function public.group_page(p_group uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare res jsonb;
begin
  perform assert_member(p_group);
  with
  g as (select id, name, emoji, currency, created_by from groups where id = p_group),
  m as (select user_id, role, joined_at from group_members where group_id = p_group),
  e as (
    select x.id, x.title, x.amount_cents, x.category, x.paid_by, x.created_by, x.spent_at, x.settlement_id,
      coalesce((select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'share_cents', p.share_cents))
                from expense_participants p where p.expense_id = x.id), '[]') as expense_participants
    from expenses x where x.group_id = p_group and x.settlement_id is null
  ),
  s as (
    select x.id, x.created_by, x.created_at, x.total_cents, x.expense_count,
      coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'from_user', t.from_user, 'to_user', t.to_user,
                                                    'amount_cents', t.amount_cents, 'paid_at', t.paid_at)
                                 order by t.amount_cents desc)
                from settlement_transfers t where t.settlement_id = x.id), '[]') as settlement_transfers
    from settlements x where x.group_id = p_group
  ),
  a as (select id, actor_id, action, details, created_at from activity where group_id = p_group order by id desc limit 100),
  tr as (select * from compute_transfers(p_group)),
  -- Everyone referenced on the page, including guests and former members.
  ids as (
    select user_id as id from m
    union select paid_by from e
    union select created_by from e
    union select (p->>'user_id')::uuid from e, jsonb_array_elements(e.expense_participants) p
    union select created_by from s
    union select (t->>'from_user')::uuid from s, jsonb_array_elements(s.settlement_transfers) t
    union select (t->>'to_user')::uuid from s, jsonb_array_elements(s.settlement_transfers) t
    union select actor_id from a
    union select (a.details->>k)::uuid from a, unnest(array['user', 'from', 'to']) k where a.details ? k
  )
  select jsonb_build_object(
    'group', (select to_jsonb(g) from g),
    'members', coalesce((select jsonb_agg(to_jsonb(m) order by m.joined_at) from m), '[]'),
    'expenses', coalesce((select jsonb_agg(to_jsonb(e) order by e.spent_at desc) from e), '[]'),
    'settlements', coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc) from s), '[]'),
    'activity', coalesce((select jsonb_agg(to_jsonb(a) order by a.id desc) from a), '[]'),
    'transfers', coalesce((select jsonb_agg(to_jsonb(tr)) from tr), '[]'),
    'profiles', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'handle', p.handle,
                                                              'display_name', p.display_name, 'avatar_url', p.avatar_url))
                          from profiles p where p.id in (select id from ids)), '[]')
  ) into res;
  return res;
end $$;

revoke execute on function public.group_page(uuid) from public, anon;
grant execute on function public.group_page(uuid) to authenticated;
