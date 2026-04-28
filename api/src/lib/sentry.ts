import * as Sentry from '@sentry/node';
import { getConfig } from './config';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const cfg = getConfig();
  if (!cfg.SENTRY_DSN_BACKEND) return;

  Sentry.init({
    dsn: cfg.SENTRY_DSN_BACKEND,
    environment: cfg.NODE_ENV,
    tracesSampleRate: cfg.NODE_ENV === 'production' ? 0.1 : 1.0,
  });

  initialized = true;
}

export { Sentry };
