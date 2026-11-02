-- Group icons are emoji, not text. Reset any text that slipped in, then enforce it.
update public.groups set emoji = '👥' where emoji ~ '[A-Za-z0-9]';
alter table public.groups add constraint emoji_not_text check (emoji !~ '[A-Za-z0-9]');
