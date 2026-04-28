# Deploy do backend no Fly.io (região `gru` — São Paulo)

Latência ponta-a-ponta esperada: **<30ms** entre frontend BR ↔ backend Fly `gru` ↔ Supabase `sa-east-1`.

Após este setup, todo `git push origin main` que toque em `api/**` dispara deploy automático via GitHub Actions.

---

## 1) Pré-requisitos

- Conta no [fly.io](https://fly.io) (já tem)
- `flyctl` instalado localmente (só pra criar app + secrets uma vez)
  - **Windows (PowerShell):** `iwr https://fly.io/install.ps1 -useb | iex`
  - depois reabra o terminal

```powershell
fly version
fly auth whoami
```

## 2) Criar o app no Fly.io

A partir da raiz do repo:

```powershell
cd api
fly apps create whatsapp4etc-api --org personal
```

> Se o nome `whatsapp4etc-api` estiver em uso globalmente no Fly, escolha outro
> (ex.: `whatsapp4etc-api-eumatheusr5`) e atualize o campo `app` em `api/fly.toml`
> e qualquer referência no `WEB_ORIGIN` futuro.

## 3) Provisionar Redis (Upstash gerenciado pelo Fly, free tier)

```powershell
fly redis create --org personal --region gru --no-replicas --plan Free --name whatsapp4etc-redis
```

No final ele imprime uma URL `redis://default:...@fly-whatsapp4etc-redis.upstash.io:6379`.
Copie essa URL — vai como secret `REDIS_URL` no próximo passo.

> O free tier Upstash via Fly dá 256MB de storage e 10k comandos/dia, sobra
> bastante pra outbox + fila de transcrição.

## 4) Setar todos os secrets de uma vez

```powershell
fly secrets set `
  SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvYWRvYmp1aXp5d2Vya2dscWp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTM3NzUsImV4cCI6MjA5Mjk2OTc3NX0.O5UC47yP74vudC9rSGGzK64DPbtvXWT6QS2upDdT_8I" `
  SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvYWRvYmp1aXp5d2Vya2dscWp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM5Mzc3NSwiZXhwIjoyMDkyOTY5Nzc1fQ.vWyZtrPPbrzHgRXx3NdYIJSCKB4tlomv1SO3SDEhC8w" `
  SUPABASE_JWT_SECRET="pmwd000WBjD4xc6vL/Bl03bE86WEn4TUko/qsORaOlT4rh1/0JP59Dc0depo8y+cCuBVlfbvTD8VWdIZodb6uQ==" `
  WEB_ORIGIN="https://whatsapp4etc.vercel.app" `
  REDIS_URL="redis://default:SENHA@fly-whatsapp4etc-redis.upstash.io:6379" `
  GROQ_API_KEY="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" `
  OPENAI_API_KEY="" `
  VAPID_PUBLIC_KEY="BEronBrlH3xIz_dzWAlziFUrtXcQzZdbm17eKA9mV1xUPhPsUC9jiI2bsT30m9IPR0_LFD3EwknDixBWEV1gSwo" `
  VAPID_PRIVATE_KEY="0GH2PzHW8NA_7Pl-jDQdt94RS9lY2iA1iFs2c9yh_ns" `
  VAPID_SUBJECT="mailto:contato@whatsapp4etc.com.br" `
  SENTRY_DSN_BACKEND=""
```

> Substitua `REDIS_URL` pela URL real impressa no passo 3.
> O `WEB_ORIGIN` ajustamos depois com a URL real do Vercel.

## 5) Primeiro deploy manual

```powershell
fly deploy --remote-only --wait-timeout 600
```

O Fly faz o build Docker remotamente em `gru` (~5 min). Ao final imprime a URL pública, ex.:

```
https://whatsapp4etc-api.fly.dev
```

Teste o healthcheck:

```powershell
curl https://whatsapp4etc-api.fly.dev/health
# {"status":"ok","timestamp":"..."}
```

## 6) Configurar deploy automático via GitHub Actions

Gere um token de deploy:

```powershell
fly tokens create deploy --expiry 8760h
```

Copie o token (começa com `FlyV1 fm2_...`) e adicione como secret no GitHub:

🔗 https://github.com/eumatheusr5/whatsapp4etc/settings/secrets/actions/new

- **Name:** `FLY_API_TOKEN`
- **Secret:** *(cole o token completo)*

Pronto: `git push origin main` com qualquer mudança em `api/**` agora dispara o workflow `.github/workflows/fly-deploy.yml` que faz `fly deploy` automático.

## 7) Frontend no Vercel

🔗 https://vercel.com/new → importa `eumatheusr5/whatsapp4etc`

- **Root Directory:** `web`
- **Framework Preset:** Vite (auto)
- **Environment Variables:**

  ```env
  VITE_SUPABASE_URL=https://ioadobjuizywerkglqjy.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvYWRvYmp1aXp5d2Vya2dscWp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTM3NzUsImV4cCI6MjA5Mjk2OTc3NX0.O5UC47yP74vudC9rSGGzK64DPbtvXWT6QS2upDdT_8I
  VITE_API_URL=https://whatsapp4etc-api.fly.dev
  VITE_SOCKET_URL=https://whatsapp4etc-api.fly.dev
  VITE_VAPID_PUBLIC_KEY=BEronBrlH3xIz_dzWAlziFUrtXcQzZdbm17eKA9mV1xUPhPsUC9jiI2bsT30m9IPR0_LFD3EwknDixBWEV1gSwo
  ```

Deploy → anota a URL final (ex.: `https://whatsapp4etc.vercel.app`).

## 8) Atualizar `WEB_ORIGIN` no Fly

```powershell
cd api
fly secrets set WEB_ORIGIN="https://whatsapp4etc.vercel.app"
```

Isso dispara redeploy automático em ~30s. Libera o CORS e Socket.IO pro domínio do Vercel.

## 9) Criar primeiro admin

No Supabase Dashboard → **Authentication → Users → Add user** (Email + Password, marca *Auto Confirm User*).

Em seguida, no **SQL Editor**:

```sql
update public.users
set role = 'admin', full_name = 'Seu Nome'
where email = 'seu@email.com';
```

## 10) Login + 1ª instância WhatsApp

1. Acessa a URL do Vercel
2. Faz login com o admin criado
3. **Instâncias → Nova** → escolhe nome
4. **Conectar** → escaneia o QR no celular (WhatsApp → Aparelhos conectados)
5. Conversas começam a sincronizar e ficam persistidas no Supabase mesmo se a instância cair.

---

## Comandos úteis no dia-a-dia

```powershell
# Ver logs em tempo real
cd api
fly logs

# Status das máquinas
fly status

# Reiniciar (sem rebuild)
fly machine restart

# Listar secrets configurados
fly secrets list

# Escalar memória (se Baileys precisar mais)
fly scale memory 2048

# Forçar deploy manual fora do GitHub Actions
fly deploy --remote-only

# Acessar console SSH na máquina
fly ssh console
```

## Custos estimados (mensal)

| Item | Plano | Custo |
|---|---|---|
| Fly.io VM `shared-cpu-1x@1024MB` | Hobby pay-as-you-go | ~$5.70 |
| Fly.io Upstash Redis (256MB) | Free tier | $0 |
| Vercel | Hobby | $0 |
| Supabase | Pro | $25 |
| Groq Whisper | Free tier | $0 |
| **Total** | | **~$31/mês** |

---

## Troubleshooting

- **Build falha por capacidade em `gru`** → docs do Fly avisam que `gru` pode estar lotado. Solução: `fly deploy --remote-only` tenta de novo (geralmente abre vaga em poucos minutos), ou rode em outra região temporariamente alterando `primary_region` no `fly.toml` para `eze` (Buenos Aires) ou `iad` (Virginia).
- **WebSocket cai a cada minuto** → confira que `auto_stop_machines = "off"` no `fly.toml`. Se a máquina dorme, mata o Baileys.
- **Erro 401 ao fazer login** → confira que `SUPABASE_JWT_SECRET` foi colado completo (inclui o `==` no final).
- **CORS bloqueado no browser** → `WEB_ORIGIN` precisa bater EXATAMENTE com o domínio do Vercel (sem barra final).
