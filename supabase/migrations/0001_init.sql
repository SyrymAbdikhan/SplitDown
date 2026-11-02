-- SplitDown schema.
-- Tables are read-only through RLS; every write goes through a security-definer
-- function below, which checks permissions and writes the activity log.
-- Money is stored as integer minor units (cents).

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (length(trim(display_name)) between 1 and 50),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 60),
  emoji text not null default '👥' check (length(emoji) between 1 and 16),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  created_by uuid not null references public.profiles,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index on public.group_members (user_id);
create unique index one_owner_per_group on public.group_members (group_id) where role = 'owner';

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  invitee_id uuid not null references public.profiles on delete cascade,
  inviter_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, invitee_id)
);
create index on public.group_invites (invitee_id);

-- One active link per group; regenerating replaces the token.
create table public.group_invite_links (
  group_id uuid primary key references public.groups on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  expires_at timestamptz,
  created_by uuid not null references public.profiles,
  created_at timestamptz not null default now()
);

-- A closed period. Created by split_bill; its expenses are locked forever.
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  created_by uuid not null references public.profiles,
  total_cents bigint not null,
  expense_count int not null,
  created_at timestamptz not null default now()
);
create index on public.settlements (group_id, created_at desc);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  title text not null check (length(trim(title)) between 1 and 80),
  amount_cents bigint not null check (amount_cents between 1 and 100000000000),
  category text not null default 'other' check (category in
    ('food', 'groceries', 'transport', 'housing', 'utilities', 'entertainment', 'travel', 'shopping', 'health', 'other')),
  paid_by uuid not null references public.profiles,
  created_by uuid not null references public.profiles,
  spent_at timestamptz not null default now(),
  settlement_id uuid references public.settlements on delete cascade, -- null = current period
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.expenses (group_id, settlement_id, spent_at desc);

create table public.expense_participants (
  expense_id uuid not null references public.expenses on delete cascade,
  user_id uuid not null references public.profiles,
  share_cents bigint not null check (share_cents >= 0),
  primary key (expense_id, user_id)
);
create index on public.expense_participants (user_id);

create table public.settlement_transfers (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references public.settlements on delete cascade,
  from_user uuid not null references public.profiles,
  to_user uuid not null references public.profiles,
  amount_cents bigint not null check (amount_cents > 0),
  paid_at timestamptz,
  paid_marked_by uuid references public.profiles
);
create index on public.settlement_transfers (settlement_id);

create table public.activity (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.groups on delete cascade,
  actor_id uuid references public.profiles,
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.activity (group_id, id desc);

-- ─── Helpers ─────────────────────────────────────────────────────────────────

create function public.my_role(g uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from group_members where group_id = g and user_id = auth.uid()
$$;

create function public.is_member(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select my_role(g) is not null
$$;

create function public.is_admin(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_role(g) in ('owner', 'admin'), false)
$$;

create function public.log_activity(g uuid, act text, det jsonb default '{}') returns void
language sql security definer set search_path = public as $$
  insert into activity (group_id, actor_id, action, details) values (g, auth.uid(), act, det)
$$;

create function public.assert_member(g uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare r text := my_role(g);
begin
  if r is null then raise exception 'You are not a member of this group'; end if;
  return r;
end $$;

create function public.assert_admin(g uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare r text := assert_member(g);
begin
  if r not in ('owner', 'admin') then raise exception 'Only group admins can do that'; end if;
  return r;
end $$;

-- ─── Profiles ────────────────────────────────────────────────────────────────

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}');
  v_name text := coalesce(nullif(meta->>'full_name', ''), nullif(meta->>'name', ''),
                          nullif(meta->>'user_name', ''), nullif(split_part(new.email, '@', 1), ''), 'User');
  base text := left(regexp_replace(lower(coalesce(nullif(meta->>'user_name', ''),
                    nullif(split_part(new.email, '@', 1), ''), v_name)), '[^a-z0-9_]', '', 'g'), 15);
  h text;
begin
  if length(base) < 3 then base := 'user' || base; end if;
  h := base;
  while exists (select 1 from profiles where handle = h) loop
    h := base || (1000 + floor(random() * 9000))::int;
  end loop;
  insert into profiles (id, handle, display_name, avatar_url)
  values (new.id, h, left(v_name, 50), coalesce(meta->>'avatar_url', meta->>'picture'));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Groups ──────────────────────────────────────────────────────────────────

create function public.create_group(p_name text, p_emoji text, p_currency text) returns uuid
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into groups (name, emoji, currency, created_by)
  values (trim(p_name), coalesce(nullif(trim(p_emoji), ''), '👥'), upper(p_currency), auth.uid())
  returning id into g;
  insert into group_members (group_id, user_id, role) values (g, auth.uid(), 'owner');
  perform log_activity(g, 'group_created', jsonb_build_object('name', trim(p_name)));
  return g;
end $$;

create function public.update_group(p_group uuid, p_name text, p_emoji text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin(p_group);
  update groups set name = trim(p_name), emoji = coalesce(nullif(trim(p_emoji), ''), emoji) where id = p_group;
  perform log_activity(p_group, 'group_updated', jsonb_build_object('name', trim(p_name)));
end $$;

create function public.delete_group(p_group uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_role(p_group) is distinct from 'owner' then raise exception 'Only the owner can delete the group'; end if;
  delete from groups where id = p_group;
end $$;

-- Dashboard rows: my groups with my balance in the current period and unpaid settle-ups.
create function public.my_groups()
returns table (id uuid, name text, emoji text, currency text, role text, member_count bigint,
               open_total_cents bigint, my_net_cents bigint, unpaid_net_cents bigint, last_activity timestamptz)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.emoji, g.currency, m.role,
    (select count(*) from group_members x where x.group_id = g.id),
    coalesce((select sum(e.amount_cents) from expenses e where e.group_id = g.id and e.settlement_id is null), 0)::bigint,
    (coalesce((select sum(e.amount_cents) from expenses e
               where e.group_id = g.id and e.settlement_id is null and e.paid_by = auth.uid()), 0)
     - coalesce((select sum(p.share_cents) from expense_participants p join expenses e on e.id = p.expense_id
                 where e.group_id = g.id and e.settlement_id is null and p.user_id = auth.uid()), 0))::bigint,
    coalesce((select sum(case when t.to_user = auth.uid() then t.amount_cents else -t.amount_cents end)
              from settlement_transfers t join settlements s on s.id = t.settlement_id
              where s.group_id = g.id and t.paid_at is null
                and auth.uid() in (t.from_user, t.to_user)), 0)::bigint,
    (select max(a.created_at) from activity a where a.group_id = g.id)
  from group_members m join groups g on g.id = m.group_id
  where m.user_id = auth.uid()
  order by 10 desc nulls last
$$;

-- ─── Expenses ────────────────────────────────────────────────────────────────

-- Insert (p_id null) or update an expense. Shares are an equal split; leftover
-- cents go one each to the first participants by user id, so shares always sum to the amount.
create function public.save_expense(
  p_group uuid, p_id uuid, p_title text, p_amount_cents bigint, p_category text,
  p_paid_by uuid, p_spent_at timestamptz, p_participants uuid[]
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  r text := assert_member(p_group);
  e expenses;
  eid uuid;
  n int;
begin
  perform 1 from groups where id = p_group for share; -- serialize against split_bill
  p_participants := array(select distinct unnest(p_participants));
  n := cardinality(p_participants);
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
    eid := p_id;
    perform log_activity(p_group, 'expense_edited', jsonb_build_object(
      'title', trim(p_title), 'amount', p_amount_cents, 'old_amount', e.amount_cents));
  end if;

  insert into expense_participants (expense_id, user_id, share_cents)
  select eid, u, p_amount_cents / n + case when row_number() over (order by u) <= p_amount_cents % n then 1 else 0 end
  from unnest(p_participants) u;
  return eid;
end $$;

create function public.delete_expense(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare e expenses; r text;
begin
  select * into e from expenses where id = p_id;
  if not found then raise exception 'Expense not found'; end if;
  r := assert_member(e.group_id);
  perform 1 from groups where id = e.group_id for share;
  if e.settlement_id is not null then raise exception 'This expense is settled and locked'; end if;
  if e.created_by <> auth.uid() and r = 'member' then raise exception 'You can only delete your own expenses'; end if;
  delete from expenses where id = p_id;
  perform log_activity(e.group_id, 'expense_deleted', jsonb_build_object('title', e.title, 'amount', e.amount_cents));
end $$;

-- ─── Splitting ───────────────────────────────────────────────────────────────

-- Fewest-transfers settle-up for the current period: repeatedly the biggest debtor
-- pays the biggest creditor. Produces at most (people - 1) transfers.
create function public.compute_transfers(p_group uuid)
returns table (from_user uuid, to_user uuid, amount_cents bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  ids uuid[];
  nets bigint[];
  i int; d int; c int; amt bigint;
begin
  perform assert_member(p_group);
  select array_agg(b.user_id order by b.user_id), array_agg(b.net order by b.user_id) into ids, nets
  from (
    select x.user_id, sum(x.v)::bigint as net from (
      select e.paid_by as user_id, e.amount_cents as v
      from expenses e where e.group_id = p_group and e.settlement_id is null
      union all
      select p.user_id, -p.share_cents
      from expense_participants p join expenses e on e.id = p.expense_id
      where e.group_id = p_group and e.settlement_id is null
    ) x group by x.user_id having sum(x.v) <> 0
  ) b;
  if ids is null then return; end if;
  loop
    d := null; c := null;
    for i in 1 .. cardinality(ids) loop
      if nets[i] < 0 and (d is null or nets[i] < nets[d]) then d := i; end if;
      if nets[i] > 0 and (c is null or nets[i] > nets[c]) then c := i; end if;
    end loop;
    exit when d is null or c is null;
    amt := least(-nets[d], nets[c]);
    from_user := ids[d]; to_user := ids[c]; amount_cents := amt;
    return next;
    nets[d] := nets[d] + amt;
    nets[c] := nets[c] - amt;
  end loop;
end $$;

-- Close the current period: snapshot transfers and lock its expenses.
create function public.split_bill(p_group uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid; total bigint; cnt int;
begin
  perform assert_member(p_group);
  perform 1 from groups where id = p_group for update;
  select coalesce(sum(amount_cents), 0), count(*) into total, cnt
  from expenses where group_id = p_group and settlement_id is null;
  if cnt = 0 then raise exception 'Nothing to split yet'; end if;

  insert into settlements (group_id, created_by, total_cents, expense_count)
  values (p_group, auth.uid(), total, cnt) returning id into sid;
  insert into settlement_transfers (settlement_id, from_user, to_user, amount_cents)
  select sid, t.from_user, t.to_user, t.amount_cents from compute_transfers(p_group) t;
  update expenses set settlement_id = sid where group_id = p_group and settlement_id is null;
  perform log_activity(p_group, 'bill_split', jsonb_build_object('total', total, 'count', cnt));
  return sid;
end $$;

create function public.set_transfer_paid(p_transfer uuid, p_paid boolean) returns void
language plpgsql security definer set search_path = public as $$
declare t settlement_transfers; g uuid;
begin
  select * into t from settlement_transfers where id = p_transfer;
  if not found then raise exception 'Transfer not found'; end if;
  select group_id into g from settlements where id = t.settlement_id;
  if auth.uid() not in (t.from_user, t.to_user) and not is_admin(g) then
    raise exception 'Only the payer, the receiver or an admin can update this';
  end if;
  update settlement_transfers
  set paid_at = case when p_paid then now() end, paid_marked_by = case when p_paid then auth.uid() end
  where id = p_transfer;
  perform log_activity(g, 'transfer_paid', jsonb_build_object(
    'from', t.from_user, 'to', t.to_user, 'amount', t.amount_cents, 'paid', p_paid));
end $$;

-- ─── Membership ──────────────────────────────────────────────────────────────

create function public.invite_member(p_group uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin(p_group);
  if exists (select 1 from group_members where group_id = p_group and user_id = p_user) then
    raise exception 'Already a member';
  end if;
  insert into group_invites (group_id, invitee_id, inviter_id) values (p_group, p_user, auth.uid())
  on conflict (group_id, invitee_id) do nothing;
  perform log_activity(p_group, 'member_invited', jsonb_build_object('user', p_user));
end $$;

create function public.cancel_invite(p_invite uuid) returns void
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  select group_id into g from group_invites where id = p_invite;
  if g is null then return; end if;
  perform assert_admin(g);
  delete from group_invites where id = p_invite;
end $$;

create function public.respond_invite(p_invite uuid, p_accept boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare i group_invites;
begin
  select * into i from group_invites where id = p_invite and invitee_id = auth.uid();
  if not found then raise exception 'Invite not found'; end if;
  delete from group_invites where id = p_invite;
  if p_accept then
    insert into group_members (group_id, user_id) values (i.group_id, auth.uid()) on conflict do nothing;
    perform log_activity(i.group_id, 'member_joined', jsonb_build_object('via', 'invite'));
  end if;
  return i.group_id;
end $$;

-- Pending invites for the signed-in user, with group name and inviter.
create function public.my_invites()
returns table (id uuid, group_id uuid, group_name text, group_emoji text, inviter_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, g.id, g.name, g.emoji, p.display_name, i.created_at
  from group_invites i join groups g on g.id = i.group_id join profiles p on p.id = i.inviter_id
  where i.invitee_id = auth.uid()
  order by i.created_at desc
$$;

create function public.create_invite_link(p_group uuid, p_expires_days int) returns text
language plpgsql security definer set search_path = public as $$
declare tok text;
begin
  perform assert_admin(p_group);
  insert into group_invite_links (group_id, expires_at, created_by)
  values (p_group, case when p_expires_days > 0 then now() + make_interval(days => p_expires_days) end, auth.uid())
  on conflict (group_id) do update
    set token = replace(gen_random_uuid()::text, '-', ''), expires_at = excluded.expires_at,
        created_by = excluded.created_by, created_at = now()
  returning token into tok;
  return tok;
end $$;

create function public.revoke_invite_link(p_group uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_admin(p_group);
  delete from group_invite_links where group_id = p_group;
end $$;

create function public.invite_preview(p_token text)
returns table (group_id uuid, name text, emoji text, member_count bigint, already_member boolean)
language sql stable security definer set search_path = public as $$
  select g.id, g.name, g.emoji,
    (select count(*) from group_members m where m.group_id = g.id),
    exists (select 1 from group_members m where m.group_id = g.id and m.user_id = auth.uid())
  from group_invite_links l join groups g on g.id = l.group_id
  where l.token = p_token and (l.expires_at is null or l.expires_at > now()) and auth.uid() is not null
$$;

create function public.join_by_token(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare g uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select group_id into g from group_invite_links
  where token = p_token and (expires_at is null or expires_at > now());
  if g is null then raise exception 'This invite link is invalid or has expired'; end if;
  if not is_member(g) then
    insert into group_members (group_id, user_id) values (g, auth.uid());
    delete from group_invites where group_id = g and invitee_id = auth.uid();
    perform log_activity(g, 'member_joined', jsonb_build_object('via', 'link'));
  end if;
  return g;
end $$;

create function public.set_member_role(p_group uuid, p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_role(p_group) is distinct from 'owner' then raise exception 'Only the owner can change roles'; end if;
  if p_role not in ('admin', 'member') then raise exception 'Invalid role'; end if;
  if p_user = auth.uid() then raise exception 'Transfer ownership instead'; end if;
  update group_members set role = p_role where group_id = p_group and user_id = p_user;
  if not found then raise exception 'Not a member'; end if;
  perform log_activity(p_group, 'role_changed', jsonb_build_object('user', p_user, 'role', p_role));
end $$;

create function public.transfer_ownership(p_group uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_role(p_group) is distinct from 'owner' then raise exception 'Only the owner can transfer ownership'; end if;
  if not exists (select 1 from group_members where group_id = p_group and user_id = p_user) then
    raise exception 'Not a member';
  end if;
  update group_members set role = 'admin' where group_id = p_group and user_id = auth.uid();
  update group_members set role = 'owner' where group_id = p_group and user_id = p_user;
  perform log_activity(p_group, 'ownership_transferred', jsonb_build_object('user', p_user));
end $$;

-- Leave (p_user = me) or remove someone. Blocked while they're in unsettled expenses.
create function public.remove_member(p_group uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me text := assert_member(p_group); them text;
begin
  select role into them from group_members where group_id = p_group and user_id = p_user;
  if them is null then raise exception 'Not a member'; end if;
  if them = 'owner' then
    raise exception 'The owner can''t leave. Transfer ownership or delete the group first';
  end if;
  if p_user <> auth.uid() and not (me = 'owner' or (me = 'admin' and them = 'member')) then
    raise exception 'You don''t have permission to remove this member';
  end if;
  perform 1 from groups where id = p_group for share;
  if exists (select 1 from expenses e where e.group_id = p_group and e.settlement_id is null
             and (e.paid_by = p_user or exists (select 1 from expense_participants p
                                                where p.expense_id = e.id and p.user_id = p_user))) then
    raise exception 'They still have unsettled expenses. Split the bill first';
  end if;
  delete from group_members where group_id = p_group and user_id = p_user;
  perform log_activity(p_group, case when p_user = auth.uid() then 'member_left' else 'member_removed' end,
                       jsonb_build_object('user', p_user));
end $$;

-- ─── Row level security (reads only) ────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.group_invite_links enable row level security;
alter table public.settlements enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_participants enable row level security;
alter table public.settlement_transfers enable row level security;
alter table public.activity enable row level security;

-- Profiles hold no private data (no email), so any signed-in user can find others by handle.
create policy "read profiles" on public.profiles for select to authenticated using (true);
create policy "update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (handle, display_name, avatar_url) on public.profiles to authenticated;

create policy "members read" on public.groups for select to authenticated using (is_member(id));
create policy "members read" on public.group_members for select to authenticated using (is_member(group_id));
create policy "invitee or admin read" on public.group_invites for select to authenticated
  using (invitee_id = auth.uid() or is_admin(group_id));
create policy "admins read" on public.group_invite_links for select to authenticated using (is_admin(group_id));
create policy "members read" on public.settlements for select to authenticated using (is_member(group_id));
create policy "members read" on public.expenses for select to authenticated using (is_member(group_id));
create policy "members read" on public.expense_participants for select to authenticated
  using (exists (select 1 from expenses e where e.id = expense_id and is_member(e.group_id)));
create policy "members read" on public.settlement_transfers for select to authenticated
  using (exists (select 1 from settlements s where s.id = settlement_id and is_member(s.group_id)));
create policy "members read" on public.activity for select to authenticated using (is_member(group_id));

-- Internal helpers are not callable over the API; nothing is callable anonymously.
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.log_activity(uuid, text, jsonb), public.handle_new_user() from authenticated;

-- Every write logs an activity row, so clients subscribe to this one table for live updates.
alter publication supabase_realtime add table public.activity;
