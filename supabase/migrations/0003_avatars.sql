-- Avatars: a generated geometric DiceBear image by default (avatar_url null → seeded by user id),
-- a re-rolled DiceBear URL, or a photo uploaded to the "avatars" bucket under the user's own folder.

-- New users start with the generated avatar instead of their provider photo.
create or replace function public.handle_new_user() returns trigger
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
  insert into profiles (id, handle, display_name) values (new.id, h, left(v_name, 50));
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Users can only point their avatar at DiceBear or their own uploaded file (no arbitrary tracking URLs).
update public.profiles set avatar_url = null;
alter table public.profiles add constraint avatar_url_allowed check (
  avatar_url is null
  or avatar_url like 'https://api.dicebear.com/%'
  or avatar_url like '%/storage/v1/object/public/avatars/' || id::text || '/%'
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

-- Public bucket: anyone can view by URL. Writes only inside "<your user id>/".
create policy "avatars own read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
