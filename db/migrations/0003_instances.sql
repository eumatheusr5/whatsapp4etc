-- =========================================================================
-- 0003 - Instâncias (números WhatsApp), estado de auth Baileys e saúde
-- =========================================================================

create table public.instances (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone_number text,
  status text not null check (status in ('disconnected','connecting','qr','connected','banned'))
    default 'disconnected',
  last_qr text,
  last_qr_at timestamptz,
  last_connected_at timestamptz,
  last_disconnected_at timestamptz,
  disconnect_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger instances_updated_at
  before update on public.instances
  for each row execute function public.set_updated_at();

create index instances_status_idx on public.instances (status);

-- Estado Baileys persistido (creds + keys)
create table public.instance_auth_state (
  instance_id uuid primary key references public.instances(id) on delete cascade,
  creds jsonb not null default '{}'::jsonb,
  keys jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger instance_auth_state_updated_at
  before update on public.instance_auth_state
  for each row execute function public.set_updated_at();

-- Eventos de saúde (timeline)
create table public.instance_health_events (
  id bigserial primary key,
  instance_id uuid not null references public.instances(id) on delete cascade,
  event_type text not null check (event_type in (
    'connected','disconnected','qr_generated','reconnecting','banned','error','session_loaded'
  )),
  detail jsonb,
  created_at timestamptz not null default now()
);

create index instance_health_events_idx on public.instance_health_events (instance_id, created_at desc);
