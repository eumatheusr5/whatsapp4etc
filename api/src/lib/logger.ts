import pino from 'pino';
import { getConfig } from './config';

const cfg = (() => {
  try {
    return getConfig();
  } catch {
    return { LOG_LEVEL: 'info', NODE_ENV: 'production' as const };
  }
})();

export const logger = pino({
  level: cfg.LOG_LEVEL,
  base: { service: 'whatsapp4etc-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(cfg.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname,service',
          },
        },
      }
    : {}),
});

export type AppLogger = typeof logger;
