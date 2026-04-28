import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Queue, ConnectionOptions } from 'bullmq';
import { getConfig } from '../../lib/config';
import { logger } from '../../lib/logger';

export const TRANSCRIPTION_QUEUE_NAME = 'transcription';

export interface TranscriptionJobData {
  messageId: string;
}

@Injectable()
export class TranscriptionService implements OnApplicationShutdown {
  private queue: Queue<TranscriptionJobData> | null = null;
  private readonly log = logger.child({ component: 'TranscriptionService' });

  private getQueue(): Queue<TranscriptionJobData> | null {
    if (this.queue) return this.queue;
    const cfg = getConfig();
    if (!cfg.REDIS_URL) {
      this.log.warn('REDIS_URL não configurada, transcrição desabilitada');
      return null;
    }
    const connection: ConnectionOptions = { url: cfg.REDIS_URL };
    this.queue = new Queue<TranscriptionJobData>(TRANSCRIPTION_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 24 * 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600, count: 1000 },
      },
    });
    return this.queue;
  }

  /**
   * Enfileira um job de transcrição. Se Redis não estiver configurado,
   * silenciosamente ignora (transcrição opcional).
   */
  async enqueue(messageId: string): Promise<void> {
    const queue = this.getQueue();
    if (!queue) return;
    // BullMQ não aceita ':' em jobId customizado, usar '-' para idempotência
    try {
      await queue.add('transcribe', { messageId }, { jobId: `msg-${messageId}` });
    } catch (err) {
      this.log.warn({ err, messageId }, 'falha ao enfileirar transcrição');
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
  }
}
