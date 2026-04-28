-- =========================================================================
-- 0002 - Atendentes (mirror do auth.users)
-- =========================================================================

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null check (role in ('admin','atendente')) default 'atendente',
  avatar_url text,
  is_online boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create index users_role_idx on public.users (role);
create index users_online_idx on public.users (is_online) where is_online = true;

-- Trigger: quando alguém se cadastra via Supabase Auth, criar registro em public.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when (select count(*) from public.users) = 0 then 'admin' else 'atendente' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
