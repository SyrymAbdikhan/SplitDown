#!/usr/bin/env bash
# Runs the migration against a throwaway Postgres (Supabase's auth bits stubbed)
# and checks the money logic. Usage: ./supabase/test.sh
set -euo pipefail
cd "$(dirname "$0")"
name=splitdown-dbtest
docker rm -f $name >/dev/null 2>&1 || true
docker run -d --name $name -e POSTGRES_PASSWORD=pw postgres:16-alpine >/dev/null
trap 'docker rm -f $name >/dev/null' EXIT
until docker exec $name pg_isready -U postgres >/dev/null 2>&1; do sleep 0.5; done
sleep 1

psql() { docker exec -i $name psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

psql <<'SQL'
create role anon; create role authenticated;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create publication supabase_realtime;
grant usage on schema auth to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1:cardinality(string_to_array(name, '/')) - 1] $$;
grant usage on schema storage to authenticated;
grant all on storage.objects to authenticated;
SQL
for f in migrations/*.sql; do psql < "$f"; done

psql <<'SQL'
\set A '''aaaaaaaa-0000-0000-0000-000000000000'''
\set B '''bbbbbbbb-0000-0000-0000-000000000000'''
\set C '''cccccccc-0000-0000-0000-000000000000'''
\set D '''dddddddd-0000-0000-0000-000000000000'''
create function pg_temp.as_user(u uuid) returns void language sql as
  $$ select set_config('request.jwt.claim.sub', u::text, false) $$;
create function pg_temp.fails(q text, msg text) returns void language plpgsql as $$
begin
  execute q;
  raise exception 'expected failure: %', q;
exception when others then
  if sqlerrm not like '%' || msg || '%' then raise exception 'wrong error for %: %', q, sqlerrm; end if;
end $$;

-- Profiles: handles are generated and unique
insert into auth.users values
  (:A, 'ann@x.com', '{"full_name":"Ann Lee"}'),
  (:B, 'ann@y.com', '{"full_name":"Bob"}'),
  (:C, 'cat@x.com', '{}'),
  (:D, null, '{}');
select handle from profiles order by id;
do $$ begin assert (select count(distinct handle) from profiles) = 4; end $$;

-- A creates group, B and C join by link
select pg_temp.as_user(:A);
select create_group('Trip', '🏔️', 'usd') as g \gset
select create_invite_link(:'g', 7) as tok \gset
select pg_temp.fails(format('select update_group(%L, ''Trip'', ''asdmpanf'')', :'g'), 'emoji_not_text');
select pg_temp.as_user(:B); select join_by_token(:'tok');
select pg_temp.as_user(:C); select join_by_token(:'tok');

-- A pays 100.00 for all three; B pays 30.00 for A and B
select pg_temp.as_user(:A);
select save_expense(:'g', null, 'Cabin', 10000, 'housing', :A, null, array[:A, :B, :C]::uuid[]) as e1 \gset
select pg_temp.as_user(:B);
select save_expense(:'g', null, 'Gas', 3000, 'transport', :B, null, array[:A, :B]::uuid[]) as e2 \gset
do $$ begin
  assert (select sum(share_cents) from expense_participants p join expenses e on e.id = p.expense_id where e.title = 'Cabin') = 10000;
  assert (select array_agg(share_cents order by user_id) from expense_participants p join expenses e on e.id = p.expense_id where e.title = 'Cabin') = '{3334,3333,3333}';
end $$;

-- B can't edit A's expense; D (outsider) can't see or add anything
select pg_temp.fails(format('select save_expense(%L, %L, ''x'', 1, ''other'', %L, null, array[%L]::uuid[])', :'g', :'e1', :B, :B), 'only edit your own');
select pg_temp.as_user(:D);
select pg_temp.fails(format('select compute_transfers(%L)', :'g'), 'not a member');

-- Transfers zero everyone out, with at most n-1 rows
select pg_temp.as_user(:C);
select * from compute_transfers(:'g');
do $$ declare g uuid := (select id from groups); begin
  assert (select count(*) from compute_transfers(g)) <= 2;
  assert not exists (
    select 1 from (
      select paid_by u, amount_cents v from expenses
      union all select user_id, -share_cents from expense_participants
      union all select from_user, amount_cents from compute_transfers(g)
      union all select to_user, -amount_cents from compute_transfers(g)
    ) x group by u having sum(v) <> 0);
end $$;

-- C can't leave with open expenses; C splits; everything locks
select pg_temp.fails(format('select remove_member(%L, %L)', :'g', :C), 'unsettled');
select split_bill(:'g') as s \gset
select pg_temp.fails(format('select split_bill(%L)', :'g'), 'Nothing to split');
select pg_temp.as_user(:A);
select pg_temp.fails(format('select delete_expense(%L)', :'e1'), 'locked');
do $$ begin
  assert (select count(*) from settlement_transfers) between 1 and 2;
  assert (select total_cents from settlements) = 13000;
end $$;

-- Reads go through RLS as the signed-in role: A sees the group and profiles, D sees neither group
select pg_temp.as_user(:A);
set role authenticated;
do $$ begin
  assert (select count(*) from groups) = 1, 'member cannot read own group';
  assert (select count(*) from profiles) = 4, 'cannot read profiles';
  assert (select count(*) from expenses) = 2, 'member cannot read expenses';
end $$;
update profiles set display_name = 'Ann L' where id = auth.uid();
-- Avatars: DiceBear or own upload only, and uploads only into your own folder
update profiles set avatar_url = 'https://api.dicebear.com/9.x/shapes/svg?seed=x' where id = auth.uid();
update profiles set avatar_url = 'https://p.supabase.co/storage/v1/object/public/avatars/' || auth.uid() || '/avatar?v=1' where id = auth.uid();
insert into storage.objects values ('avatars', 'aaaaaaaa-0000-0000-0000-000000000000/avatar');
reset role;
select pg_temp.fails(format('set role authenticated; update profiles set avatar_url = %L where id = auth.uid()', 'https://evil.com/pixel.png'), 'avatar_url_allowed');
reset role;
select pg_temp.fails(format('set role authenticated; update profiles set avatar_url = %L where id = auth.uid()', 'https://p.supabase.co/storage/v1/object/public/avatars/bbbbbbbb-0000-0000-0000-000000000000/avatar'), 'avatar_url_allowed');
reset role;
select pg_temp.fails('set role authenticated; insert into storage.objects values (''avatars'', ''bbbbbbbb-0000-0000-0000-000000000000/avatar'')', 'row-level security');
reset role;
do $$ begin assert (select avatar_url from profiles where handle = 'cat') is null, 'new users should start with generated avatar'; end $$;
select pg_temp.as_user(:D);
set role authenticated;
do $$ begin assert (select count(*) from groups) = 0, 'outsider can read group'; end $$;
reset role;

-- Payer marks paid; outsider-in-group (no role) can't touch someone else's transfer
select pg_temp.as_user(:C);
select set_transfer_paid(id, true) from settlement_transfers where from_user = :C;
do $$ begin assert (select paid_at is not null from settlement_transfers where from_user = 'cccccccc-0000-0000-0000-000000000000'); end $$;

-- New period is separate; C can now leave; owner can't
select pg_temp.as_user(:A);
select save_expense(:'g', null, 'Lunch', 1000, 'food', :A, null, array[:A, :B]::uuid[]);
select pg_temp.as_user(:C); select remove_member(:'g', :C);
select pg_temp.as_user(:A);
select pg_temp.fails(format('select remove_member(%L, %L)', :'g', :A), 'owner can''t leave');
select * from my_groups();
do $$ begin
  assert (select my_net_cents from my_groups()) = 500;
  assert (select open_total_cents from my_groups()) = 1000;
end $$;
-- Guests: per-expense people without accounts get their own share and settle up
select save_expense(:'g', null, 'Pizza', 3000, 'food', :A, null, array[:A]::uuid[], array['Dana', ' ']) as pz \gset
select id as dana from profiles where guest_expense_id = :'pz' \gset
do $$ begin
  assert (select count(*) from profiles where guest_expense_id is not null) = 1, 'blank guest names should be dropped';
  assert (select handle from profiles where display_name = 'Dana') is null;
end $$;
select share_cents from expense_participants where user_id = :'dana';
do $$ declare g uuid := (select id from groups); begin
  assert (select amount_cents from compute_transfers(g) t join profiles p on p.id = t.from_user where p.display_name = 'Dana') = 1500;
end $$;
select pg_temp.fails(format('select save_expense(%L, null, ''x'', 100, ''other'', %L, null, array[%L]::uuid[])', :'g', :'dana', :A), 'must be group members');
set role authenticated;
do $$ begin assert (select count(*) from profiles where display_name = 'Dana') = 1, 'member cannot see guest'; end $$;
reset role;
select pg_temp.as_user(:D);
set role authenticated;
do $$ begin assert (select count(*) from profiles where display_name = 'Dana') = 0, 'outsider can see guest'; end $$;
reset role;

-- group_page returns everything in one call, including guest profiles; outsiders are refused
select pg_temp.as_user(:A);
do $$ declare j jsonb := group_page((select id from groups)); begin
  assert jsonb_array_length(j->'expenses') = 2, 'expenses';
  assert jsonb_array_length(j->'settlements') = 1, 'settlements';
  assert jsonb_array_length(j->'transfers') = 2, 'transfers';
  assert exists (select 1 from jsonb_array_elements(j->'profiles') p where p->>'display_name' = 'Dana'), 'guest profile';
  assert exists (select 1 from jsonb_array_elements(j->'profiles') p where p->>'display_name' = 'cat'), 'former member profile';
  assert j->'group'->>'currency' = 'USD';
end $$;
select pg_temp.as_user(:D);
select pg_temp.fails(format('select group_page(%L)', :'g'), 'not a member');
select pg_temp.as_user(:A);

-- Editing re-creates guests; splitting includes them; deleting the group cleans them up
select pg_temp.as_user(:A);
select save_expense(:'g', :'pz', 'Pizza', 3000, 'food', :A, null, array[:A]::uuid[], array['Dana', 'Eli']);
do $$ begin
  assert (select count(*) from profiles where guest_expense_id is not null) = 2;
  assert (select array_agg(share_cents) from expense_participants p join expenses e on e.id = p.expense_id where e.title = 'Pizza') = '{1000,1000,1000}';
end $$;
select split_bill(:'g');
select set_transfer_paid(t.id, true) from settlement_transfers t join profiles p on p.id = t.from_user where p.display_name = 'Eli';
select delete_group(:'g');
do $$ begin
  assert (select count(*) from groups) = 0;
  assert (select count(*) from profiles where guest_expense_id is not null) = 0, 'guests left behind';
end $$;
-- Account deletion: blocked by open expenses and shared ownership; afterwards history stays intact
select pg_temp.as_user(:A);
select create_group('Flat', '🏠', 'usd') as g2 \gset
select create_invite_link(:'g2', 0) as tok2 \gset
select pg_temp.as_user(:B); select join_by_token(:'tok2');
select pg_temp.as_user(:A);
select save_expense(:'g2', null, 'Rent', 1000, 'housing', :A, null, array[:A, :B]::uuid[]);
select pg_temp.as_user(:B);
select pg_temp.fails('select delete_account()', 'open expenses in "Flat"');
select pg_temp.as_user(:A);
select pg_temp.fails('select delete_account()', 'You own "Flat"');
select split_bill(:'g2');
select pg_temp.as_user(:B);
select delete_account();
do $$ begin
  assert not exists (select 1 from auth.users where id = 'bbbbbbbb-0000-0000-0000-000000000000'), 'auth user still there';
  assert (select deleted and display_name = 'Deleted user' and handle like 'deleted_%' and avatar_url is null
          from profiles where id = 'bbbbbbbb-0000-0000-0000-000000000000'), 'profile not anonymized';
  assert not exists (select 1 from group_members where user_id = 'bbbbbbbb-0000-0000-0000-000000000000'), 'still a member';
  assert exists (select 1 from settlement_transfers where from_user = 'bbbbbbbb-0000-0000-0000-000000000000'), 'history lost';
end $$;
select pg_temp.as_user(:A);
select pg_temp.fails(format('select invite_member(%L, %L)', :'g2', :B), 'User not found');
select delete_account(); -- A is now alone in Flat, so the group goes too
do $$ begin
  assert not exists (select 1 from groups), 'solo group not deleted';
  assert (select deleted from profiles where id = 'aaaaaaaa-0000-0000-0000-000000000000');
end $$;
\echo ALL TESTS PASSED
SQL
