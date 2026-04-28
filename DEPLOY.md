# Guia de Deploy - WhatsApp4etc

Este documento descreve como colocar o sistema em produção.

## Visão geral da infraestrutura

| Componente   | Plataforma            | Região       | Plano sugerido    |
| ------------ | --------------------- | ------------ | ----------------- |
| Frontend     | Vercel                | Edge global  | Hobby (grátis)    |
| Backend      | Render Web Service    | São Paulo    | Starter US$ 7/mês |
| Redis        | Render Key Value      | São Paulo    | Free              |
| Banco/Auth   | Supabase Pro          | sa-east-1    | Pro US$ 25/mês    |
| Transcrição  | Groq Whisper Large v3 | API externa  | Free tier         |
| Notificações | Web Push (VAPID)      | Browser      | -                 |

---

## 1. Supabase (já configurado)

Projeto: `Whatsapp4etc` (`ioadobjuizywerkglqjy`).
URL: https://ioadobjuizywerkglqjy.supabase.co

### O que já foi feito automaticamente:

- 16 tabelas criadas com RLS ativada
- 8 tags padrão e 5 quick replies seedados
- Buckets `avatars` (público) e `media` (privado, signed URLs)
- Funções `is_admin()` e trigger `handle_new_user()`

### O que você precisa fazer:

1. **Criar primeiro usuário admin** (Supabase Dashboard → Authentication → Users → Add user):
   - Email: `admin@suaempresa.com.br`
   - Senha forte
   - Email confirmed: ✓

   O trigger `handle_new_user` vai criar automaticamente o registro em `public.users` com role `admin` (apenas o primeiro usuário vira admin).

2. **Pegar as credenciais** (Settings → API):
   - `URL` → copiar para `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - `anon public` (legacy) → copiar para `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`
   - `service_role` → copiar para `SUPABASE_SERVICE_ROLE_KEY` (somente backend!)
   - `JWT Secret` → copiar para `SUPABASE_JWT_SECRET` (somente backend!)

3. **Criar atendentes** (mesma tela, Add user). Eles entrarão automaticamente como `atendente`.

---

## 2. Render (Backend + Redis)

### Opção A — Via Blueprint (recomendado)

1. Suba o repositório para GitHub.
2. Acesse https://dashboard.render.com → **New** → **Blueprint**.
3. Aponte para o repositório, branch `main`. O Render vai detectar `api/render.yaml`.
4. Confirme criação do `whatsapp4etc-api` (Web Service, Docker, Starter, São Paulo) + `whatsapp4etc-redis` (Key Value, Free, São Paulo).
5. No serviço `whatsapp4etc-api`, edite **Environment** e preencha:
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_JWT_SECRET`
   - `WEB_ORIGIN` = URL do Vercel (ex: `https://whatsapp4etc.vercel.app`)
   - `GROQ_API_KEY` (https://console.groq.com → API Keys → Create)
   - `OPENAI_API_KEY` (opcional, fallback)
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (gere com `npx web-push generate-vapid-keys`)
   - `SENTRY_DSN_BACKEND` (opcional)
6. **Manual Deploy** → Deploy latest commit.
7. Após deploy bem-sucedido, copie a URL pública (ex: `https://whatsapp4etc-api.onrender.com`).

### Opção B — Manual

1. **New → Web Service**:
   - Source: GitHub
   - Root Directory: `api`
   - Runtime: Docker
   - Region: São Paulo
   - Plan: Starter
   - Health Check Path: `/health`
2. **New → Key Value**:
   - Region: São Paulo
   - Plan: Free
   - Maxmemory Policy: noeviction
3. Configure as ENV no Web Service (mesmas listadas acima).

### ⚠️ Por que Starter (paid)?

Plano Free do Render coloca o serviço em **sleep** após 15 min de inatividade. Como o backend mantém WebSockets persistentes com WhatsApp via Baileys, ele precisa estar 24/7 ativo. Se cair, todas as instâncias desconectam e você precisa de novo QR.

---

## 3. Vercel (Frontend)

1. Suba o repositório para GitHub.
2. https://vercel.com → **Add New Project** → importar o repo.
3. Configurar:
   - **Framework Preset**: Vite
   - **Root Directory**: `web`
   - **Build Command**: `npm run build` (auto-detectado)
   - **Output**: `dist` (auto-detectado)
4. **Environment Variables**:
   - `VITE_SUPABASE_URL` = `https://ioadobjuizywerkglqjy.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (anon key do Supabase)
   - `VITE_API_URL` = URL do Render (ex: `https://whatsapp4etc-api.onrender.com`)
   - `VITE_VAPID_PUBLIC_KEY` = (mesma chave pública usada no backend)
   - `VITE_SENTRY_DSN` (opcional)
5. **Deploy**.

Após deploy, **volte ao Render** e atualize `WEB_ORIGIN` com a URL final do Vercel (ou domínio customizado).

---

## 4. Domínio customizado (opcional)

- **Vercel**: Settings → Domains → Add → seguir instruções DNS.
- **Render**: Settings → Custom Domains → adicionar (ex: `api.suaempresa.com.br`).

Atualize `WEB_ORIGIN` (Render) e `VITE_API_URL` (Vercel) após apontar os domínios.

---

## 5. Verificações pós-deploy

1. Acessar `https://[seu-dominio]/login` → fazer login com admin.
2. Ir em **Números** → criar instância → conectar → escanear QR no WhatsApp.
3. Enviar mensagem de teste de outro WhatsApp para o número conectado.
4. Verificar:
   - ✓ Mensagem aparece na lista de conversas
   - ✓ Foto e nome do contato sincronizam
   - ✓ Áudios aparecem com transcrição (após alguns segundos)
   - ✓ Indicador "digitando..." aparece quando o cliente digita
   - ✓ Reabrir o navegador → instâncias permanecem conectadas (sem novo QR)

---

## 6. Manutenção e custos

### Custos mensais estimados

- Render Starter: **US$ 7,00**
- Render Redis Free: **US$ 0**
- Supabase Pro: **US$ 25,00**
- Vercel Hobby: **US$ 0**
- Groq Whisper: **US$ 0** (free tier ~14.400 transcrições/dia, mais que suficiente para 5 números)
- OpenAI Whisper (fallback): **< US$ 5** (só dispara se Groq falhar)

**Total: ~US$ 32-37/mês**

### Logs e monitoramento

- **Render**: aba Logs do serviço (live tail)
- **Vercel**: aba Logs / Runtime Logs
- **Supabase**: Logs Explorer
- **Sentry**: dashboard com erros agregados

### Atualizar / fazer deploy de novas versões

- Push para `main` → Vercel + Render fazem deploy automático.
- Migrations futuras: criar em `db/migrations/000X_name.sql` e aplicar via Supabase MCP/Dashboard.

---

## 7. Troubleshooting

### "Instância fica em `connecting` infinitamente"

- Verificar logs do Render (aba Logs).
- Confirmar que `SUPABASE_SERVICE_ROLE_KEY` está correto.
- Pode ser banimento temporário do número (logar de outro IP).

### "Frontend não carrega conversas"

- Verificar se `VITE_API_URL` aponta para o Render correto.
- Verificar `WEB_ORIGIN` no Render (CORS).
- Abrir DevTools → Network → ver se requisições retornam 401 (token inválido) ou 0 (CORS).

### "Áudios não transcrevem"

- Verificar logs do worker BullMQ no Render.
- Confirmar `GROQ_API_KEY` válida em https://console.groq.com.
- Verificar se Redis está conectado (`REDIS_URL` no Render).

### "Push notifications não funcionam"

- Confirmar que VAPID_PUBLIC e VAPID_PRIVATE estão setadas (mesma key pair entre back e front).
- Browser precisa permissão de notificação concedida.
- HTTPS obrigatório (não funciona em http://).

---

## 8. Backup e recuperação

- **Banco**: Supabase Pro tem PITR (Point-in-Time Recovery) incluso.
- **Mídias**: Storage Supabase replicado.
- **Sessões Baileys**: persistidas no banco (`instance_auth_state`). Backup do banco = backup das sessões.

Se precisar reinstalar o backend do zero:

1. Render: Manual Deploy.
2. Tudo volta no ar com as instâncias automaticamente reconectando (sem QR).
