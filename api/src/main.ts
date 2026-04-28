import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions } from 'socket.io';
import { AppModule } from './app.module';
import { getConfig } from './lib/config';
import { logger } from './lib/logger';
import { initSentry } from './lib/sentry';

type CorsCallback = (err: Error | null, allow?: boolean) => void;

function buildOriginValidator(webOrigin: string) {
  const allowedExact = new Set<string>([
    webOrigin,
    'http://localhost:5173',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
  ]);
  const allowedPatterns = [
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/i,
    /^https:\/\/[a-z0-9-]+\.onrender\.com$/i,
  ];
  return (origin: string | undefined, cb: CorsCallback) => {
    if (!origin) return cb(null, true);
    if (allowedExact.has(origin)) return cb(null, true);
    if (allowedPatterns.some((p) => p.test(origin))) return cb(null, true);
    logger.warn({ origin }, 'CORS bloqueado para origin');
    cb(new Error(`Origin não permitido: ${origin}`));
  };
}

class CorsIoAdapter extends IoAdapter {
  private readonly validator: ReturnType<typeof buildOriginValidator>;

  constructor(app: unknown, validator: ReturnType<typeof buildOriginValidator>) {
    super(app as never);
    this.validator = validator;
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    const opts = {
      ...options,
      cors: {
        origin: this.validator,
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 30_000,
      pingInterval: 25_000,
    } as ServerOptions;
    return super.createIOServer(port, opts) as Server;
  }
}

async function bootstrap() {
  initSentry();
  const cfg = getConfig();

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    bufferLogs: true,
    bodyParser: true,
  });

  const validator = buildOriginValidator(cfg.WEB_ORIGIN);

  app.enableCors({
    origin: validator,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'X-Requested-With'],
    maxAge: 86400,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  app.useWebSocketAdapter(new CorsIoAdapter(app, validator));

  app.enableShutdownHooks();

  await app.listen(cfg.PORT, '0.0.0.0');
  logger.info({ port: cfg.PORT, env: cfg.NODE_ENV, webOrigin: cfg.WEB_ORIGIN }, 'API up');
}

bootstrap().catch((err) => {
  logger.error({ err }, 'fatal bootstrap error');
  process.exit(1);
});
