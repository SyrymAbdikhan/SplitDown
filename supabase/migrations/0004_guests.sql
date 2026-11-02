-- Guests: people without an account, typed into a single expense. Each guest is a profile row with
-- no login and no handle, tied to that expense (guest_expense_id), so shares, payments and history
-- treat them like anyone else. Deleting or re-saving the expense removes its guests.

alter table public.profiles drop constraint profiles_id_fkey;
alter table public.profiles alter column id set default gen_random_uuid();
alter table public.profiles alter column handle drop not null;
alter table public.profiles add column guest_expense_id uuid references public.expenses on delete cascade;
alter table public.profiles add constraint guest_has_no_handle check ((guest_expense_id is null) = (handle is not null));
create index on public.profiles (guest_expense_id) where guest_expense_id is not null;

-- Profiles no longer cascade from auth.users through a foreign key, so do it with a trigger.
create function public.handle_deleted_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from profiles where id = old.id;
  return old;
end $$;
create trigger on_auth_user_deleted after delete on auth.users
  for each row execute function public.handle_deleted_user();

-- Guests are only visible to members of the expense's group.
drop policy "read profiles" on public.profiles;
create policy "read profiles" on public.profiles for select to authenticated using (
  guest_expense_id is null
  or exists (select 1 from expenses e where e.id = guest_expense_id and is_member(e.group_id))
);

drop function public.save_expense(uuid, uuid, text, bigint, text, uuid, timestamptz, uuid[]);

-- Same as before, plus p_guests: names of people without an account who share this expense.
create function public.save_expense(
  p_group uuid, p_id uuid, p_title text, p_amount_cents bigint, p_category text,
  p_paid_by uuid, p_spent_at timestamptz, p_participants uuid[], p_guests text[] default '{}'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  r text := assert_member(p_group);
  e expenses;
  eid uuid;
  guest_ids uuid[];
  n int;
begin
  perform 1 from groups where id = p_group for share; -- serialize against split_bill
  p_participants := array(select distinct unnest(p_participants));
  p_guests := array(select trim(g) from unnest(coalesce(p_guests, '{}')) g where trim(g) <> '');
  if cardinality(p_guests) > 20 then raise exception 'At most 20 guests per expense'; end if;
  if exists (select 1 from unnest(p_guests) g where length(g) > 50) then
    raise exception 'Guest names can be at most 50 characters';
  end if;
  n := cardinality(p_participants) + cardinality(p_guests);
  if n = 0 then raise exception 'Pick at least one participant'; end if;
  if exists (select 1 from unnest(p_participants || p_paid_by) u
             where not exists (select 1 from group_members where group_id = p_group and user_id = u)) then
    raise exception 'Payer and participants must be group members';
  end if;

  if p_id is null then
    insert into expenses (group_id, title, amount_cents, category, paid_by, created_by, spent_at)
    values (p_group, trim(p_title), p_amount_cents, p_category, p_paid_by, auth.uid(), coalesce(p_spent_at, now()))
    returning id into eid;
    perform log_activity(p_group, 'expense_added', jsonb_build_object('title', trim(p_title), 'amount', p_amount_cents));
  else
    select * into e from expenses where id = p_id and group_id = p_group for update;
    if not found then raise exception 'Expense not found'; end if;
    if e.settlement_id is not null then raise exception 'This expense is settled and locked'; end if;
    if e.created_by <> auth.uid() and r = 'member' then raise exception 'You can only edit your own expenses'; end if;
    update expenses set title = trim(p_title), amount_cents = p_amount_cents, category = p_category,
      paid_by = p_paid_by, spent_at = coalesce(p_spent_at, spent_at), updated_at = now()
    where id = p_id;
    delete from expense_participants where expense_id = p_id;
    delete from profiles where guest_expense_id = p_id; -- guests are re-created from p_guests
    eid := p_id;
    perform log_activity(p_group, 'expense_edited', jsonb_build_object(
      'title', trim(p_title), 'amount', p_amount_cents, 'old_amount', e.amount_cents));
  end if;

  with g as (
    insert into profiles (display_name, guest_expense_id) select name, eid from unnest(p_guests) name returning id
  ) select array_agg(id) into guest_ids from g;
  p_participants := p_participants || coalesce(guest_ids, '{}');

  insert into expense_participants (expense_id, user_id, share_cents)
  select eid, u, p_amount_cents / n + case when row_number() over (order by u) <= p_amount_cents % n then 1 else 0 end
  from unnest(p_participants) u;
  return eid;
end $$;

revoke execute on function public.save_expense(uuid, uuid, text, bigint, text, uuid, timestamptz, uuid[], text[]) from public, anon;
grant execute on function public.save_expense(uuid, uuid, text, bigint, text, uuid, timestamptz, uuid[], text[]) to authenticated;
revoke execute on function public.handle_deleted_user() from public, anon, authenticated;
