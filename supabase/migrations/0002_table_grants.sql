-- Newer Supabase projects don't auto-grant table access to API roles.
-- Signed-in users get read access; RLS policies decide which rows they see.
-- (Profile column updates were already granted in 0001; all other writes go through functions.)
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
