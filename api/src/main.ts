import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Server, ServerOptions } from 'socket.io';
import { AppModule } from './app.module';
import { getConfig } from './lib/config';
import { logger } from './lib/logger';
import { initSentry } from './lib/sentry';

class CorsIoAdapter extends IoAdapter {
  constructor(app: any, private readonly origin: string) {
    super(app);
  }
  override createIOServer(port: number, options?: ServerOptions): Server {
    const server: Server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: [this.origin, /\.vercel\.app$/, 'http://localhost:5173'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });
    return server;
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

  app.enableCors({
    origin: [cfg.WEB_ORIGIN, /\.vercel\.app$/, 'http://localhost:5173'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  app.useWebSocketAdapter(new CorsIoAdapter(app, cfg.WEB_ORIGIN));

  app.enableShutdownHooks();

  await app.listen(cfg.PORT, '0.0.0.0');
  logger.info({ port: cfg.PORT, env: cfg.NODE_ENV }, 'API up');
}

bootstrap().catch((err) => {
  logger.error({ err }, 'fatal bootstrap error');
  process.exit(1);
});
