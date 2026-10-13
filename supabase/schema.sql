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

-- Kaydet: başka cihaz araya girdiyse kaydetmez, güncel sürümü eksi işaretle döndürür
create or replace function public.save_state(p_data jsonb, p_base bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cur bigint;
begin
  if uid is null then raise exception 'giris gerekli'; end if;
  if pg_column_size(p_data) > 2000000 then raise exception 'veri cok buyuk'; end if;
  select rev into cur from public.user_state where user_id = uid for update;
  if cur is null then
    insert into public.user_state (user_id, data, rev) values (uid, p_data, 1);
    return 1;
  end if;
  if p_base is not null and p_base <> cur then return -cur; end if;
  update public.user_state set data = p_data, rev = cur + 1, updated_at = now() where user_id = uid;
  return cur + 1;
end;
$$;
revoke all on function public.save_state(jsonb, bigint) from public, anon;
grant execute on function public.save_state(jsonb, bigint) to authenticated;

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
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- 3) Hata kayıtları: kimlik bilgisi tutulmaz, yalnızca hata metni
create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  message text not null check (length(message) <= 500),
  stack text check (length(stack) <= 4000),
  screen text check (length(screen) <= 200),
  version text check (length(version) <= 40),
  platform text check (length(platform) <= 200)
);
alter table public.app_errors enable row level security;
drop policy if exists "anyone can report" on public.app_errors;
create policy "anyone can report" on public.app_errors for insert to anon, authenticated with check (true);
grant insert on public.app_errors to anon, authenticated;

-- 60 günden eski hata kayıtlarını temizle
delete from public.app_errors where at < now() - interval '60 days';
