# WhatsApp4etc - Dashboard Multi-Número

Plataforma profissional de atendimento multi-número via WhatsApp não-oficial (Baileys),
com dashboard unificada, persistência total no Supabase, equipe de atendimento com
mecânica de assumir/liberar conversa, e suporte completo aos recursos do WhatsApp Web.

## Stack

| Camada | Tecnologia | Plataforma |
| --- | --- | --- |
| Frontend | React + Vite + TypeScript + Tailwind + Zustand + React Query + Zod | Vercel |
| Backend | Node.js + NestJS + TypeScript + Baileys + Pino + Socket.IO + BullMQ | Render (São Paulo) |
| Banco / Auth / Storage / Realtime | Supabase Pro (Postgres 17) | Supabase (sa-east-1) |
| Fila (transcrição) | Redis | Render Key Value |
| Transcrição | Groq Whisper Large v3 (free) + fallback OpenAI | API externa |
| Monitoramento | Sentry | Sentry |

## Estrutura

```
WhatsApp4etc/
├── web/      Frontend (Vercel)
├── api/      Backend Baileys + API (Render)
└── db/       Migrações SQL versionadas
```

## Setup local

```powershell
# Instalar dependências
cd web ; npm install ; cd ..
cd api ; npm install ; cd ..

# Copiar variáveis de ambiente
Copy-Item .env.example .env
# Preencher .env com as credenciais reais

# Frontend (porta 5173)
cd web ; npm run dev

# Backend (porta 3001)
cd api ; npm run start:dev
```

## Deploy

- **Frontend**: push para `main` -> Vercel deploy automático
- **Backend**: push para `main` -> Render deploy automático (Docker)
- **Migrations**: aplicadas via Supabase MCP / CLI

## Recursos principais

- Multi-número (até 5 instâncias simultâneas)
- Mecânica de "assumir/liberar conversa" (lock atômico)
- Sincronização bidirecional com celular do dono
- Transcrição automática de TODOS os áudios (Groq Whisper)
- Auto-sync de foto e nome dos contatos
- Notas no contato + notas na conversa
- Tags coloridas, custom fields, busca full-text PT-BR
- Indicadores de presença completos (digitando, online, lido)
- Outbox offline (envia ao reconectar)
- Dashboard de saúde + estatísticas
- Web Push notifications

## Licença

Uso interno comercial. Todos os direitos reservados.
