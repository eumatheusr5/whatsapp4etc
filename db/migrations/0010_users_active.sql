-- =========================================================================
-- 0010 - Coluna is_active em public.users (soft delete)
-- =========================================================================

alter table public.users
  add column if not exists is_active boolean not null default true;

create index if not exists users_active_idx on public.users (is_active);

-- Garante que o cleanup de auth.users também aceite usuários desativados
-- (o auth.admin.deleteUser pode ser usado para remoção definitiva).
