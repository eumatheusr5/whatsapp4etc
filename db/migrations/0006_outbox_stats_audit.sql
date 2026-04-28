-- =========================================================================
-- 0006 - Outbox (envios offline), estatísticas, auditoria
-- =========================================================================

-- Outbox: mensagens com instância desconectada
create table public.message_outbox (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.users(id),
  payload jsonb not null,
  status text not null check (status in ('queued','sending','sent','failed'))
    default 'queued',
  attempts int not null default 0,
  last_error text,
  scheduled_at timestamptz not null default now(),
  sent_message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger message_outbox_updated_at
  before update on public.message_outbox
  for each row execute function public.set_updated_at();

create index message_outbox_status_idx on public.message_outbox (status, scheduled_at);
create index message_outbox_conv_idx on public.message_outbox (conversation_id, created_at);

-- Estatísticas diárias
create table public.daily_stats (
  date date not null,
  user_id uuid references public.users(id) on delete cascade,
  instance_id uuid references public.instances(id) on delete cascade,
  messages_sent int not null default 0,
  messages_received int not null default 0,
  conversations_handled int not null default 0,
  avg_response_seconds int,
  primary key (date, user_id, instance_id)
);

create index daily_stats_date_idx on public.daily_stats (date desc);

-- Auditoria
create table public.audit_log (
  id bigserial primary key,
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity text,
  entity_id text,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_user_idx on public.audit_log (user_id, created_at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);

-- Web Push subscriptions
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
