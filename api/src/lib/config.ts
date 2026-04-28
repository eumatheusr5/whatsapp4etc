import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce.number().default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),

  WEB_ORIGIN: z.string().default('http://localhost:5173'),

  REDIS_URL: z.string().optional(),

  GROQ_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:admin@example.com'),

  SENTRY_DSN_BACKEND: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getConfig(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const formatted = parsed.error.flatten().fieldErrors;
    console.error('[CONFIG] Variáveis de ambiente inválidas:', formatted);
    throw new Error('Configuração inválida. Verifique .env');
  }
  cached = parsed.data;
  return cached;
}

export const config = new Proxy({} as Env, {
  get: (_, prop: string) => getConfig()[prop as keyof Env],
});
