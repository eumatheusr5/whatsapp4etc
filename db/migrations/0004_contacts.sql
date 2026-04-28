-- =========================================================================
-- 0004 - Contatos (clientes), notas no contato, tags
-- =========================================================================

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null references public.instances(id) on delete cascade,
  jid text not null,
  push_name text,
  custom_name text,
  avatar_url text,
  avatar_updated_at timestamptz,
  phone_number text,
  custom_fields jsonb not null default '{}'::jsonb,
  presence text not null check (presence in ('available','unavailable','composing','recording','paused'))
    default 'unavailable',
  presence_updated_at timestamptz,
  last_seen_at timestamptz,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instance_id, jid)
);

create trigger contacts_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

create index contacts_phone_idx on public.contacts (phone_number);
create index contacts_pushname_trgm on public.contacts using gin (push_name gin_trgm_ops);
create index contacts_customname_trgm on public.contacts using gin (custom_name gin_trgm_ops);

-- Notas no contato (visíveis em qualquer conversa)
create table public.contact_notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  user_id uuid not null references public.users(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index contact_notes_idx on public.contact_notes (contact_id, created_at desc);

-- Tags
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#0ea5e9',
  created_at timestamptz not null default now()
);

create table public.contact_tags (
  contact_id uuid not null references public.contacts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_id, tag_id)
);

create index contact_tags_tag_idx on public.contact_tags (tag_id);
