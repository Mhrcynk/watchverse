-- WatchVerse veritabanı. Her çalıştırmada güvenle yeniden uygulanır.

-- 1) Kullanıcı verisi: her hesap için tek kayıt (izlediklerin, puanların, notların, kütüphanen)
create table if not exists public.user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  rev bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.user_state enable row level security;

drop policy if exists "own row read" on public.user_state;
create policy "own row read" on public.user_state for select to authenticated using (user_id = auth.uid());

-- Yazma yalnızca save_state ile yapılır (sürüm kontrolü için)
revoke insert, update, delete on public.user_state from anon, authenticated;

-- Additive protocol migration: older clients may read, but cannot overwrite a v3 snapshot.
alter table public.user_state add column if not exists min_writer integer not null default 2;
grant select on public.user_state to authenticated;

create or replace function public.save_state_internal(p_data jsonb, p_base bigint, p_writer integer)
returns bigint language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); cur bigint; required integer;
begin
  if uid is null then raise exception 'giris gerekli'; end if;
  if pg_column_size(p_data) > 2000000 then raise exception 'esitleme boyut siniri'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'gecersiz veri';
  end if;
  if p_base is null or p_base < 0 then raise exception 'surum gerekli'; end if;
  -- Serialize even the first write; SELECT FOR UPDATE cannot lock a missing row.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  select rev, min_writer into cur, required from public.user_state where user_id = uid for update;
  if cur is null then
    if p_base <> 0 then raise exception 'kayit bulunamadi'; end if;
    insert into public.user_state(user_id, data, rev, min_writer) values(uid, p_data, 1, p_writer);
    return 1;
  end if;
  if p_writer < required then raise exception 'uygulama guncellemesi gerekli'; end if;
  if p_base <> cur then return -cur; end if;
  update public.user_state set data=p_data, rev=cur+1, min_writer=greatest(required,p_writer), updated_at=now() where user_id=uid;
  return cur+1;
end;
$$;
revoke all on function public.save_state_internal(jsonb,bigint,integer) from public,anon,authenticated;

create or replace function public.save_state(p_data jsonb,p_base bigint)
returns bigint language sql security definer set search_path = '' as $$
  select public.save_state_internal(p_data,p_base,2);
$$;
create or replace function public.save_state_v3(p_data jsonb,p_base bigint)
returns bigint language sql security definer set search_path = '' as $$
  select public.save_state_internal(p_data,p_base,3);
$$;
revoke all on function public.save_state(jsonb,bigint) from public,anon;
revoke all on function public.save_state_v3(jsonb,bigint) from public,anon;
grant execute on function public.save_state(jsonb,bigint) to authenticated;
grant execute on function public.save_state_v3(jsonb,bigint) to authenticated;

-- Bind writes to the account that initiated them, even if client credentials change in flight.
create or replace function public.save_state_v4(p_data jsonb,p_base bigint,p_owner uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
begin
  if p_owner is null or auth.uid() is null or p_owner <> auth.uid() then
    raise exception 'oturum degisti';
  end if;
  return public.save_state_internal(p_data,p_base,4);
end;
$$;
revoke all on function public.save_state_v4(jsonb,bigint,uuid) from public,anon;
grant execute on function public.save_state_v4(jsonb,bigint,uuid) to authenticated;

create or replace function public.save_state_v5(p_data jsonb,p_base bigint,p_owner uuid)
returns bigint language plpgsql security definer set search_path = '' as $$
begin
  if p_owner is null or auth.uid() is null or p_owner <> auth.uid() then raise exception 'oturum degisti'; end if;
  if p_data->'replica'->>'version' is distinct from '1' then raise exception 'gecersiz esitleme protokolu'; end if;
  return public.save_state_internal(p_data,p_base,5);
end;
$$;
revoke all on function public.save_state_v5(jsonb,bigint,uuid) from public,anon;
grant execute on function public.save_state_v5(jsonb,bigint,uuid) to authenticated;

-- 2) Hesabı silme: kullanıcı kendi hesabını ve tüm verisini kalıcı olarak siler
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'giris gerekli'; end if;
  delete from public.user_state where user_id = uid;
  delete from public.shared_lists where owner = uid;
  delete from public.friendships where a = uid or b = uid;
  delete from public.profiles where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

create or replace function public.delete_my_account_v2(p_owner uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_owner is null or auth.uid() is null or p_owner <> auth.uid() then
    raise exception 'oturum degisti';
  end if;
  perform public.delete_my_account();
end;
$$;
revoke all on function public.delete_my_account_v2(uuid) from public,anon;
grant execute on function public.delete_my_account_v2(uuid) to authenticated;

-- 3) Paylaşılan listeler: bağlantıyı bilen herkes görebilir, yalnızca sahibi değiştirebilir (kullanıcı başı maks. 50 liste)
create table if not exists public.shared_lists (
  slug text primary key check (slug ~ '^[a-z0-9]{8,24}$'),
  owner uuid not null references auth.users (id) on delete cascade,
  name text not null check (length(name) <= 60),
  owner_name text check (length(owner_name) <= 40),
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.shared_lists enable row level security;
revoke all on public.shared_lists from anon, authenticated;

create or replace function public.share_list(p_slug text, p_name text, p_items jsonb, p_owner_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid(); cur uuid; cnt int;
begin
  if uid is null then raise exception 'giris gerekli'; end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]{8,24}$' then raise exception 'gecersiz baglanti'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 1000 or pg_column_size(p_items) > 400000 then raise exception 'liste cok buyuk'; end if;
  perform pg_advisory_xact_lock(hashtextextended('share-owner:' || uid::text,0));
  perform pg_advisory_xact_lock(hashtextextended('share-slug:' || p_slug,0));
  select owner into cur from public.shared_lists where slug = p_slug;
  if cur is not null and cur <> uid then raise exception 'izin yok'; end if;
  if cur is null then
    select count(*) into cnt from public.shared_lists where owner = uid;
    if cnt >= 50 then raise exception 'liste siniri asildi'; end if;
  end if;
  insert into public.shared_lists (slug, owner, name, owner_name, items, updated_at)
  values (p_slug, uid, left(p_name, 60), left(nullif(p_owner_name, ''), 40), p_items, now())
  on conflict (slug) do update set name = excluded.name, owner_name = excluded.owner_name, items = excluded.items, updated_at = now()
  where shared_lists.owner = uid;
  if not found then raise exception 'izin yok'; end if;
end;
$$;
revoke all on function public.share_list(text, text, jsonb, text) from public, anon;
grant execute on function public.share_list(text, text, jsonb, text) to authenticated;

create or replace function public.unshare_list(p_slug text)
returns void
language sql
security definer
set search_path = ''
as $$ delete from public.shared_lists where slug = p_slug and owner = auth.uid(); $$;
revoke all on function public.unshare_list(text) from public, anon;
grant execute on function public.unshare_list(text) to authenticated;

create or replace function public.get_shared_list(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$ select jsonb_build_object('name', name, 'owner', owner_name, 'items', items, 'updated', updated_at) from public.shared_lists where slug = p_slug; $$;
revoke all on function public.get_shared_list(text) from public;
grant execute on function public.get_shared_list(text) to anon, authenticated;

-- 4) Arkadaşlar: davet bağlantısıyla eklenir; arkadaşlar birbirinin son izlediklerini görür (maks. 200 arkadaş)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (length(display_name) <= 40),
  invite_code text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 12),
  share_activity boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;

create table if not exists public.friendships (
  a uuid not null references auth.users (id) on delete cascade,
  b uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a <> b)
);
alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;

create or replace function public.my_profile(p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid(); r public.profiles;
begin
  if uid is null then raise exception 'giris gerekli'; end if;
  insert into public.profiles (user_id, display_name) values (uid, left(coalesce(p_name, ''), 40))
  on conflict (user_id) do update set display_name = case when coalesce(p_name, '') = '' then public.profiles.display_name else left(p_name, 40) end, updated_at = now()
  returning * into r;
  return jsonb_build_object('code', r.invite_code, 'name', r.display_name, 'share', r.share_activity);
end;
$$;

create or replace function public.reset_invite()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare code text := substr(md5(random()::text || clock_timestamp()::text), 1, 12);
begin
  if auth.uid() is null then raise exception 'giris gerekli'; end if;
  update public.profiles set invite_code = code, updated_at = now() where user_id = auth.uid();
  return code;
end;
$$;

create or replace function public.set_sharing(p_on boolean)
returns void
language sql
security definer
set search_path = ''
as $$ update public.profiles set share_activity = p_on, updated_at = now() where user_id = auth.uid(); $$;

create or replace function public.invite_info(p_code text)
returns text
language sql
stable
security definer
set search_path = ''
as $$ select coalesce(display_name, '') from public.profiles where invite_code = p_code; $$;

create or replace function public.accept_invite(p_code text, p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid(); other uuid; oname text; cnt int;
begin
  if uid is null then raise exception 'giris gerekli'; end if;
  select user_id, display_name into other, oname from public.profiles where invite_code = p_code;
  if other is null then raise exception 'davet gecersiz'; end if;
  if other = uid then raise exception 'kendi davetin'; end if;
  perform pg_advisory_xact_lock(hashtextextended('friend:' || least(uid,other)::text,0));
  perform pg_advisory_xact_lock(hashtextextended('friend:' || greatest(uid,other)::text,0));
  if not exists(select 1 from public.friendships where a=uid and b=other) then
    if (select count(*) from public.friendships where a=uid)>=200 or (select count(*) from public.friendships where a=other)>=200 then raise exception 'arkadas siniri asildi'; end if;
  end if;
  insert into public.profiles (user_id, display_name) values (uid, left(coalesce(p_name, ''), 40)) on conflict (user_id) do nothing;
  insert into public.friendships (a, b) values (uid, other), (other, uid) on conflict do nothing;
  return coalesce(nullif(oname, ''), 'Arkadaşın');
end;
$$;

create or replace function public.remove_friend(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$ delete from public.friendships where (a = auth.uid() and b = p_id) or (a = p_id and b = auth.uid()); $$;

create or replace function public.friend_feed()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(f order by f->>'name'), '[]'::jsonb) from (
    select jsonb_build_object(
      'id', p.user_id,
      'name', coalesce(nullif(p.display_name, ''), 'Arkadaşın'),
      'share', p.share_activity,
      'items', case when p.share_activity then coalesce((
        select jsonb_agg(jsonb_build_object(
          'k', t.key, 'at', t.value::bigint,
          'w', (s.data->'watched') ? t.key,
          'e', coalesce(jsonb_array_length(s.data->'episodes'->t.key), 0),
          'r', s.data->'ratings'->t.key,
          't', s.data->'lib'->t.key->>'title',
          'p', s.data->'lib'->t.key->>'p',
          'y', s.data->'lib'->t.key->>'year'
        ) order by t.value::bigint desc)
        from (select key, value from jsonb_each_text(coalesce(s.data->'touched', '{}'::jsonb)) where value ~ '^\d+$' order by value::bigint desc limit 30) t
      ), '[]'::jsonb) else '[]'::jsonb end
    ) as f
    from public.friendships fr
    join public.profiles p on p.user_id = fr.b
    left join public.user_state s on s.user_id = fr.b
    where fr.a = auth.uid()
  ) x;
$$;

revoke all on function public.my_profile(text), public.reset_invite(), public.set_sharing(boolean), public.accept_invite(text, text), public.remove_friend(uuid), public.friend_feed() from public, anon;
grant execute on function public.my_profile(text), public.reset_invite(), public.set_sharing(boolean), public.accept_invite(text, text), public.remove_friend(uuid), public.friend_feed() to authenticated;
revoke all on function public.invite_info(text) from public;
grant execute on function public.invite_info(text) to anon, authenticated;

-- 5) Hata kayıtları: spam/kota aşımına karşı saatlik limit korumalı
create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  message text not null check (length(message) > 0 and length(message) <= 500),
  stack text check (length(stack) <= 4000),
  screen text check (length(screen) <= 200),
  version text check (length(version) <= 40),
  platform text check (length(platform) <= 200)
);
alter table public.app_errors enable row level security;
drop policy if exists "anyone can report" on public.app_errors;
-- RLS cannot count rows hidden from the caller. A private, atomic quota is enforced by a trigger.
create policy "anyone can report" on public.app_errors
  for insert to anon, authenticated with check (length(message) > 0);
revoke all on public.app_errors from public, anon, authenticated;
grant insert (message, stack, screen, version, platform) on public.app_errors to anon, authenticated;
create table if not exists public.error_quota (
  singleton boolean primary key default true check (singleton),
  window_start timestamptz not null,
  n integer not null
);
alter table public.error_quota enable row level security;
revoke all on public.error_quota from public, anon, authenticated;
insert into public.error_quota values (true, now(), 0) on conflict do nothing;
create or replace function public.limit_error_reports()
returns trigger language plpgsql security definer set search_path = '' as $$
declare used integer;
begin
  update public.error_quota set
    n = case when window_start <= clock_timestamp() - interval '1 hour' then 1 else n + 1 end,
    window_start = case when window_start <= clock_timestamp() - interval '1 hour' then clock_timestamp() else window_start end
  where singleton and (n < 300 or window_start <= clock_timestamp() - interval '1 hour')
  returning n into used;
  if used is null then raise exception 'hata kaydi siniri asildi'; end if;
  new.at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.limit_error_reports() from public, anon, authenticated;
drop trigger if exists limit_error_reports on public.app_errors;
create trigger limit_error_reports before insert on public.app_errors
  for each row execute function public.limit_error_reports();

-- 60 günden eski hata kayıtlarını temizle
delete from public.app_errors where at < now() - interval '60 days';

-- 6) Native push devices. No anonymous writes and no caller-supplied owner.
create table if not exists public.native_devices (
  id text primary key check (id ~ '^[a-f0-9-]{16,64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text unique not null check (token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'),
  follow jsonb not null default '[]', tv jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
alter table public.native_devices enable row level security;
revoke all on public.native_devices from public,anon,authenticated;
grant select,delete on public.native_devices to authenticated;
grant all on public.native_devices to service_role;
drop policy if exists "own devices" on public.native_devices;
create policy "own devices" on public.native_devices to authenticated using(user_id=auth.uid());
create or replace function public.register_native_device(p_id text,p_token text,p_follow jsonb,p_tv jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); owner uuid;
begin
  if uid is null then raise exception 'giris gerekli'; end if;
  if p_follow is null or p_tv is null or jsonb_typeof(p_follow)<>'array' or jsonb_typeof(p_tv)<>'array' then raise exception 'gecersiz liste'; end if;
  if jsonb_array_length(p_follow)>40 or jsonb_array_length(p_tv)>600 or pg_column_size(p_follow)+pg_column_size(p_tv)>60000 then raise exception 'liste cok buyuk'; end if;
  perform pg_advisory_xact_lock(hashtextextended('device:' || p_id,0));
  if exists(select 1 from public.revoked_native_devices where id=p_id and user_id=auth.uid()) then raise exception 'cihaz iptal edildi'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select user_id into owner from public.native_devices where id=p_id for update;
  if owner is not null and owner<>uid then raise exception 'izin yok'; end if;
  if owner is null and (select count(*) from public.native_devices where user_id=uid)>=10 then raise exception 'cihaz siniri'; end if;
  insert into public.native_devices(id,user_id,token,follow,tv) values(p_id,uid,p_token,p_follow,p_tv)
  on conflict(id) do update set token=excluded.token,follow=excluded.follow,tv=excluded.tv,updated_at=now()
  where native_devices.user_id=uid;
  if not found then raise exception 'izin yok'; end if;
end;
$$;
revoke all on function public.register_native_device(text,text,jsonb,jsonb) from public,anon;
grant execute on function public.register_native_device(text,text,jsonb,jsonb) to authenticated;

-- Revocation tombstones prevent a delayed registration from recreating a logged-out device.
create table if not exists public.revoked_native_devices (
 id text not null, user_id uuid not null references auth.users(id) on delete cascade,
 primary key(id,user_id),
 revoked_at timestamptz not null default now()
);
alter table public.revoked_native_devices enable row level security;
revoke all on public.revoked_native_devices from public,anon,authenticated;
create or replace function public.unregister_native_device(p_id text,p_owner uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_owner is null or auth.uid() is distinct from p_owner then raise exception 'oturum degisti'; end if;
 if p_id is null or p_id !~ '^[a-f0-9-]{16,64}$' then raise exception 'gecersiz cihaz'; end if;
 perform pg_advisory_xact_lock(hashtextextended('device:' || p_id,0));
 if exists(select 1 from public.native_devices where id=p_id and user_id<>auth.uid()) then raise exception 'izin yok'; end if;
 insert into public.revoked_native_devices(id,user_id) values(p_id,auth.uid()) on conflict(id,user_id) do nothing;
 delete from public.native_devices where id=p_id and user_id=auth.uid();
end;
$$;
create or replace function public.register_native_device_v2(p_id text,p_token text,p_follow jsonb,p_tv jsonb,p_owner uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_owner is null or auth.uid() is distinct from p_owner then raise exception 'oturum degisti'; end if;
 perform pg_advisory_xact_lock(hashtextextended('device:' || p_id,0));
 if exists(select 1 from public.revoked_native_devices where id=p_id and user_id=auth.uid()) then raise exception 'cihaz iptal edildi'; end if;
 perform public.register_native_device(p_id,p_token,p_follow,p_tv);
end;
$$;
revoke all on function public.unregister_native_device(text,uuid),public.register_native_device_v2(text,text,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.unregister_native_device(text,uuid),public.register_native_device_v2(text,text,jsonb,jsonb,uuid) to authenticated;

create or replace function public.share_list_v2(p_slug text,p_name text,p_items jsonb,p_owner_name text,p_owner uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_owner is null or auth.uid() is distinct from p_owner then raise exception 'oturum degisti'; end if;
 perform public.share_list(p_slug,p_name,p_items,p_owner_name);
end;
$$;
revoke all on function public.share_list_v2(text,text,jsonb,text,uuid) from public,anon;
grant execute on function public.share_list_v2(text,text,jsonb,text,uuid) to authenticated;

create or replace function public.unshare_list_v2(p_slug text,p_owner uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_owner is null or auth.uid() is distinct from p_owner then raise exception 'oturum degisti'; end if;
 perform public.unshare_list(p_slug);
end;
$$;
revoke all on function public.unshare_list_v2(text,uuid) from public,anon;
grant execute on function public.unshare_list_v2(text,uuid) to authenticated;

create or replace function public.my_profile_v2(p_name text,p_owner uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_owner is null or auth.uid() is distinct from p_owner then raise exception 'oturum degisti'; end if;
 return public.my_profile(p_name);
end;
$$;
revoke all on function public.my_profile_v2(text,uuid) from public,anon;
grant execute on function public.my_profile_v2(text,uuid) to authenticated;

create or replace function public.reset_invite_v2(p_owner uuid)
returns text language plpgsql security definer set search_path='' as $$
begin
 if p_owner is null or auth.uid() is distinct from p_owner then raise exception 'oturum degisti'; end if;
 return public.reset_invite();
end;
$$;
revoke all on function public.reset_invite_v2(uuid) from public,anon;
grant execute on function public.reset_invite_v2(uuid) to authenticated;

create or replace function public.set_sharing_v2(p_on boolean,p_owner uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_owner is null or auth.uid() is distinct from p_owner then raise exception 'oturum degisti'; end if;
 perform public.set_sharing(p_on);
end;
$$;
revoke all on function public.set_sharing_v2(boolean,uuid) from public,anon;
grant execute on function public.set_sharing_v2(boolean,uuid) to authenticated;

create or replace function public.accept_invite_v2(p_code text,p_name text,p_owner uuid)
returns text language plpgsql security definer set search_path='' as $$
begin
 if p_owner is null or auth.uid() is distinct from p_owner then raise exception 'oturum degisti'; end if;
 return public.accept_invite(p_code,p_name);
end;
$$;
revoke all on function public.accept_invite_v2(text,text,uuid) from public,anon;
grant execute on function public.accept_invite_v2(text,text,uuid) to authenticated;

create or replace function public.remove_friend_v2(p_id uuid,p_owner uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_owner is null or auth.uid() is distinct from p_owner then raise exception 'oturum degisti'; end if;
 perform public.remove_friend(p_id);
end;
$$;
revoke all on function public.remove_friend_v2(uuid,uuid) from public,anon;
grant execute on function public.remove_friend_v2(uuid,uuid) to authenticated;

create or replace function public.friend_feed_v2(p_owner uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_owner is null or auth.uid() is distinct from p_owner then raise exception 'oturum degisti'; end if;
 return public.friend_feed();
end;
$$;
revoke all on function public.friend_feed_v2(uuid) from public,anon;
grant execute on function public.friend_feed_v2(uuid) to authenticated;
