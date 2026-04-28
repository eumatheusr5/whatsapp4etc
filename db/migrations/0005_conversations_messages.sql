-- =========================================================================
-- 0005 - Conversas, mensagens, notas da conversa, respostas rápidas
-- =========================================================================

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.instances(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  assigned_to uuid references public.users(id) on delete set null,
  assigned_at timestamptz,
  last_message_at timestamptz,
  last_message_preview text,
  unread_count int not null default 0,
  archived boolean not null default false,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instance_id, contact_id)
);

create trigger conversations_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

create index conversations_assigned_idx on public.conversations (assigned_to, last_message_at desc);
create index conversations_last_message_idx on public.conversations (last_message_at desc nulls last);
create index conversations_archived_idx on public.conversations (archived);
create index conversations_unread_idx on public.conversations (unread_count) where unread_count > 0;

-- Mensagens
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  wa_message_id text not null,
  from_me boolean not null,
  sender_jid text,
  type text not null check (type in (
    'text','image','video','audio','ptt','document','sticker','location','contact','reaction','system'
  )),
  body text,
  media_url text,
  media_path text,
  media_mime text,
  media_size_bytes bigint,
  media_duration_seconds int,
  media_width int,
  media_height int,
  media_thumbnail_url text,
  reply_to_message_id uuid references public.messages(id) on delete set null,
  forwarded boolean not null default false,
  status text not null check (status in ('pending','sent','delivered','read','failed'))
    default 'pending',
  edited_at timestamptz,
  deleted_at timestamptz,
  reactions jsonb not null default '[]'::jsonb,
  sent_by_user_id uuid references public.users(id) on delete set null,
  sent_via text check (sent_via in ('dashboard','phone','outbox')),
  -- Transcrição de áudio
  transcript text,
  transcript_language text,
  transcript_status text not null check (transcript_status in (
    'pending','processing','done','failed','skipped'
  )) default 'skipped',
  transcript_provider text,
  transcript_at timestamptz,
  wa_timestamp timestamptz not null,
  created_at timestamptz not null default now(),
  unique (conversation_id, wa_message_id)
);

create index messages_conv_idx on public.messages (conversation_id, wa_timestamp desc);
create index messages_wa_id_idx on public.messages (wa_message_id);
-- Full-text search inclui body E transcript
create index messages_fts_idx on public.messages using gin (
  to_tsvector('portuguese', coalesce(body,'') || ' ' || coalesce(transcript,''))
);
create index messages_transcript_pending_idx on public.messages (transcript_status)
  where transcript_status in ('pending','processing','failed');

-- Notas internas DA CONVERSA
create table public.conversation_notes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.users(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index conversation_notes_idx on public.conversation_notes (conversation_id, created_at desc);

-- Respostas rápidas (com atalho /)
create table public.quick_replies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  shortcut text not null,
  body text not null,
  media_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Constraint: usuário+shortcut OU global+shortcut único
  unique (user_id, shortcut)
);

create trigger quick_replies_updated_at
  before update on public.quick_replies
  for each row execute function public.set_updated_at();

-- shortcut único quando user_id é null (global)
create unique index quick_replies_global_shortcut_idx
  on public.quick_replies (shortcut) where user_id is null;
