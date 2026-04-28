-- =========================================================================
-- 0008 - Buckets de Storage (avatars, media)
-- =========================================================================
-- Estratégia:
-- - Bucket "avatars": fotos de perfil de contatos. Público (signed-by-default
--   não é necessário para fotos não-sensíveis). Cache forte.
-- - Bucket "media": mídia das mensagens (imagens, vídeos, áudios, docs).
--   Privado. Atendentes acessam via signed URLs geradas pelo backend.
-- =========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880,
    array['image/jpeg','image/png','image/webp','image/gif']),
  ('media', 'media', false, 104857600, null)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ===== Policies Storage =====
-- Avatares: leitura pública, escrita só pelo backend (service_role)
create policy avatars_public_read
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars');

-- Mídia: leitura para atendentes autenticados (mas backend gera signed URLs preferencialmente)
create policy media_authenticated_read
  on storage.objects for select to authenticated
  using (bucket_id = 'media');
