-- Guarda o nome do PERFIL PROPRIO de cada instancia (empresa) para nunca
-- contaminar o push_name dos contatos quando o pushName recebido for o
-- da propria instancia (ex: status de pedido enviado por sistema externo).
ALTER TABLE public.instances
  ADD COLUMN IF NOT EXISTS self_push_name text,
  ADD COLUMN IF NOT EXISTS self_verified_name text;

COMMENT ON COLUMN public.instances.self_push_name IS
  'Nome do perfil proprio (sock.user.name). Usado para descartar pushName de proprias mensagens.';
COMMENT ON COLUMN public.instances.self_verified_name IS
  'verifiedName do WhatsApp Business da instancia, se houver.';
