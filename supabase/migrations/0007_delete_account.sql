-- Account deletion. The login, email, name and photo go away; the profile row stays as an anonymous
-- "Deleted user" so the expenses and payments other people share with it still add up.

alter table public.profiles add column deleted boolean not null default false;

-- Deleting an auth user (from the app or the dashboard) now anonymizes the profile instead of removing it.
create or replace function public.handle_deleted_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update profiles
  set deleted = true, display_name = 'Deleted user', avatar_url = null,
      handle = 'deleted_' || left(replace(old.id::text, '-', ''), 12)
  where id = old.id;
  delete from group_invites where invitee_id = old.id or inviter_id = old.id;
  return old;
end $$;

-- Same rules as leaving: groups you own alone are deleted, groups you own with others must change
-- owner first, and you can't have open (unsplit) expenses anywhere.
create function public.delete_account() returns void
language plpgsql security definer set search_path = public as $$
declare g record;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  for g in select gr.id, gr.name, m.role, (select count(*) from group_members x where x.group_id = gr.id) as n
           from groups gr join group_members m on m.group_id = gr.id
           where m.user_id = auth.uid() loop
    if g.role = 'owner' and g.n > 1 then
      raise exception 'You own "%". Make someone else the owner or delete that group first', g.name;
    end if;
    if exists (select 1 from expenses e where e.group_id = g.id and e.settlement_id is null
               and (e.paid_by = auth.uid() or exists (select 1 from expense_participants p
                                                      where p.expense_id = e.id and p.user_id = auth.uid()))) then
      raise exception 'You still have open expenses in "%". Split the bill there first', g.name;
    end if;
  end loop;

  delete from groups where id in (select group_id from group_members where user_id = auth.uid() and role = 'owner');
  for g in select group_id from group_members where user_id = auth.uid() loop
    perform remove_member(g.group_id, auth.uid());
  end loop;
  delete from auth.users where id = auth.uid(); -- the trigger above anonymizes the profile
end $$;

-- Only real, active users can be invited (not guests or deleted accounts).
create or replace function public.invite_member(p_group uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin(p_group);
  if not exists (select 1 from profiles where id = p_user and handle is not null and not deleted) then
    raise exception 'User not found';
  end if;
  if exists (select 1 from group_members where group_id = p_group and user_id = p_user) then
    raise exception 'Already a member';
  end if;
  insert into group_invites (group_id, invitee_id, inviter_id) values (p_group, p_user, auth.uid())
  on conflict (group_id, invitee_id) do nothing;
  perform log_activity(p_group, 'member_invited', jsonb_build_object('user', p_user));
end $$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
revoke execute on function public.handle_deleted_user() from public, anon, authenticated;
