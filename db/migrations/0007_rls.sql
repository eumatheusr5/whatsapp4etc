-- =========================================================================
-- 0007 - RLS (Row Level Security) - Zero Trust
-- =========================================================================
-- Estratégia:
-- - Atendentes autenticados (qualquer usuário em public.users) podem LER
--   praticamente tudo (são uma equipe interna pequena, todos veem tudo).
-- - Escritas críticas (mensagens, sessão Baileys, contatos vindos do WhatsApp)
--   são feitas pelo backend Render usando service_role_key (bypass RLS).
-- - Algumas escritas controladas pelo frontend: notas, tags, quick replies,
--   marcar conversa como assumida/liberada — sempre via policies.
-- =========================================================================

-- Ativa RLS em todas as tabelas
alter table public.users               enable row level security;
alter table public.instances           enable row level security;
alter table public.instance_auth_state enable row level security;
alter table public.instance_health_events enable row level security;
alter table public.contacts            enable row level security;
alter table public.contact_notes       enable row level security;
alter table public.tags                enable row level security;
alter table public.contact_tags        enable row level security;
alter table public.conversations       enable row level security;
alter table public.messages            enable row level security;
alter table public.conversation_notes  enable row level security;
alter table public.quick_replies       enable row level security;
alter table public.message_outbox      enable row level security;
alter table public.daily_stats         enable row level security;
alter table public.audit_log           enable row level security;
alter table public.push_subscriptions  enable row level security;

-- ===== USERS =====
create policy users_select_authenticated
  on public.users for select to authenticated
  using (true);

create policy users_update_self
  on public.users for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy users_admin_all
  on public.users for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ===== INSTANCES =====
create policy instances_select_authenticated
  on public.instances for select to authenticated
  using (true);

create policy instances_admin_all
  on public.instances for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ===== INSTANCE_AUTH_STATE =====
-- Apenas service_role acessa (sem policies para authenticated = nenhum acesso)

-- ===== INSTANCE_HEALTH_EVENTS =====
create policy ihe_select_authenticated
  on public.instance_health_events for select to authenticated
  using (true);

-- ===== CONTACTS =====
create policy contacts_select_authenticated
  on public.contacts for select to authenticated
  using (true);

create policy contacts_update_authenticated
  on public.contacts for update to authenticated
  using (true)
  with check (true);

-- ===== CONTACT_NOTES =====
create policy contact_notes_select_authenticated
  on public.contact_notes for select to authenticated
  using (true);

create policy contact_notes_insert_self
  on public.contact_notes for insert to authenticated
  with check (user_id = auth.uid());

create policy contact_notes_delete_own_or_admin
  on public.contact_notes for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ===== TAGS =====
create policy tags_select_authenticated
  on public.tags for select to authenticated
  using (true);

create policy tags_admin_write
  on public.tags for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ===== CONTACT_TAGS =====
create policy contact_tags_select_authenticated
  on public.contact_tags for select to authenticated
  using (true);

create policy contact_tags_write_authenticated
  on public.contact_tags for all to authenticated
  using (true)
  with check (true);

-- ===== CONVERSATIONS =====
create policy conversations_select_authenticated
  on public.conversations for select to authenticated
  using (true);

create policy conversations_update_authenticated
  on public.conversations for update to authenticated
  using (true)
  with check (true);

-- ===== MESSAGES =====
create policy messages_select_authenticated
  on public.messages for select to authenticated
  using (true);

-- Inserção direta de mensagens é feita pelo backend (service_role).
-- Frontend usa POST /messages no backend.

-- ===== CONVERSATION_NOTES =====
create policy conv_notes_select_authenticated
  on public.conversation_notes for select to authenticated
  using (true);

create policy conv_notes_insert_self
  on public.conversation_notes for insert to authenticated
  with check (user_id = auth.uid());

create policy conv_notes_delete_own_or_admin
  on public.conversation_notes for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ===== QUICK_REPLIES =====
create policy quick_replies_select_authenticated
  on public.quick_replies for select to authenticated
  using (user_id is null or user_id = auth.uid() or public.is_admin());

create policy quick_replies_insert_self_or_admin
  on public.quick_replies for insert to authenticated
  with check (user_id = auth.uid() or (user_id is null and public.is_admin()));

create policy quick_replies_update_self_or_admin
  on public.quick_replies for update to authenticated
  using (user_id = auth.uid() or (user_id is null and public.is_admin()))
  with check (user_id = auth.uid() or (user_id is null and public.is_admin()));

create policy quick_replies_delete_self_or_admin
  on public.quick_replies for delete to authenticated
  using (user_id = auth.uid() or (user_id is null and public.is_admin()));

-- ===== MESSAGE_OUTBOX =====
create policy outbox_select_authenticated
  on public.message_outbox for select to authenticated
  using (true);

-- ===== DAILY_STATS =====
create policy stats_select_authenticated
  on public.daily_stats for select to authenticated
  using (true);

-- ===== AUDIT_LOG =====
create policy audit_select_admin
  on public.audit_log for select to authenticated
  using (public.is_admin());

-- ===== PUSH_SUBSCRIPTIONS =====
create policy push_select_self
  on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());

create policy push_insert_self
  on public.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid());

create policy push_delete_self
  on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());
