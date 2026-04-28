import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Worker, ConnectionOptions, Job } from 'bullmq';
import axios, { AxiosError } from 'axios';
import FormData from 'form-data';
import { getConfig } from '../../lib/config';
import { getSupabaseAdmin } from '../../lib/supabase-admin';
import { logger } from '../../lib/logger';
import { MediaService } from '../media/media.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TRANSCRIPTION_QUEUE_NAME, TranscriptionJobData } from './transcription.service';

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const OPENAI_URL = 'https://api.openai.com/v1/audio/transcriptions';

@Injectable()
export class TranscriptionWorker implements OnApplicationBootstrap, OnApplicationShutdown {
  private worker: Worker<TranscriptionJobData> | null = null;
  private readonly log = logger.child({ component: 'TranscriptionWorker' });

  constructor(
    private readonly media: MediaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  onApplicationBootstrap(): void {
    const cfg = getConfig();
    if (!cfg.REDIS_URL) {
      this.log.warn('REDIS_URL ausente, worker de transcrição desabilitado');
      return;
    }
    if (!cfg.GROQ_API_KEY && !cfg.OPENAI_API_KEY) {
      this.log.warn('Nenhuma chave de transcrição configurada (Groq ou OpenAI)');
      return;
    }

    const connection: ConnectionOptions = { url: cfg.REDIS_URL };
    this.worker = new Worker<TranscriptionJobData>(
      TRANSCRIPTION_QUEUE_NAME,
      (job) => this.process(job),
      {
        connection,
        concurrency: 5,
        limiter: { max: 18, duration: 60_000 },
      },
    );
    this.worker.on('failed', (job, err) => {
      this.log.warn({ err, jobId: job?.id, messageId: job?.data?.messageId }, 'transcrição falhou');
    });
    this.worker.on('completed', (job) => {
      this.log.debug({ jobId: job.id, messageId: job.data.messageId }, 'transcrição concluída');
    });
    this.log.info('worker de transcrição iniciado');
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
    this.worker = null;
  }

  private async process(job: Job<TranscriptionJobData>): Promise<void> {
    const { messageId } = job.data;
    const supabase = getSupabaseAdmin();

    const { data: msg, error } = await supabase
      .from('messages')
      .select('id, conversation_id, type, media_path, transcript_status')
      .eq('id', messageId)
      .maybeSingle();

    if (error || !msg) throw error ?? new Error('mensagem não encontrada');
    if (!['audio', 'ptt'].includes(msg.type)) {
      await supabase
        .from('messages')
        .update({ transcript_status: 'skipped' })
        .eq('id', messageId);
      return;
    }
    if (!msg.media_path) {
      await supabase
        .from('messages')
        .update({ transcript_status: 'failed' })
        .eq('id', messageId);
      return;
    }

    await supabase
      .from('messages')
      .update({ transcript_status: 'processing' })
      .eq('id', messageId);

    const buffer = await this.media.download(msg.media_path);
    const cfg = getConfig();

    let transcript: string | null = null;
    let language: string | null = null;
    let provider: 'groq' | 'openai' | null = null;

    if (cfg.GROQ_API_KEY) {
      try {
        const result = await this.callGroq(buffer, cfg.GROQ_API_KEY);
        transcript = result.text;
        language = result.language ?? 'pt';
        provider = 'groq';
      } catch (err) {
        const ax = err as AxiosError;
        const status = ax.response?.status;
        this.log.warn({ status, messageId }, 'Groq falhou, tentando fallback');
        if (!cfg.OPENAI_API_KEY) {
          throw err;
        }
      }
    }

    if (!transcript && cfg.OPENAI_API_KEY) {
      const result = await this.callOpenAI(buffer, cfg.OPENAI_API_KEY);
      transcript = result.text;
      language = result.language ?? 'pt';
      provider = 'openai';
    }

    if (!transcript) {
      throw new Error('Nenhum provedor de transcrição configurado');
    }

    await supabase
      .from('messages')
      .update({
        transcript: transcript.trim(),
        transcript_language: language,
        transcript_status: 'done',
        transcript_provider: provider,
        transcript_at: new Date().toISOString(),
      })
      .eq('id', messageId);

    this.realtime.emitAll('message:transcript_done', {
      messageId,
      conversationId: msg.conversation_id,
      transcript: transcript.trim(),
      provider,
    });
  }

  private async callGroq(
    buffer: Buffer,
    apiKey: string,
  ): Promise<{ text: string; language?: string }> {
    const form = new FormData();
    form.append('file', buffer, { filename: 'audio.ogg', contentType: 'audio/ogg' });
    form.append('model', 'whisper-large-v3');
    form.append('language', 'pt');
    form.append('response_format', 'verbose_json');
    form.append('temperature', '0');

    const res = await axios.post(GROQ_URL, form, {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${apiKey}` },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 120_000,
    });
    const data = res.data as { text: string; language?: string };
    return { text: data.text, language: data.language };
  }

  private async callOpenAI(
    buffer: Buffer,
    apiKey: string,
  ): Promise<{ text: string; language?: string }> {
    const form = new FormData();
    form.append('file', buffer, { filename: 'audio.ogg', contentType: 'audio/ogg' });
    form.append('model', 'whisper-1');
    form.append('language', 'pt');
    form.append('response_format', 'verbose_json');
    form.append('temperature', '0');

    const res = await axios.post(OPENAI_URL, form, {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${apiKey}` },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 180_000,
    });
    const data = res.data as { text: string; language?: string };
    return { text: data.text, language: data.language };
  }
}
