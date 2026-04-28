import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as mime from 'mime-types';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import { getSupabaseAdmin } from '../../lib/supabase-admin';
import { logger } from '../../lib/logger';

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath as unknown as string);
}

const MEDIA_BUCKET = 'media';
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24; // 24h

interface UploadResult {
  path: string;
  url: string;
  size: number;
  mime: string;
}

@Injectable()
export class MediaService {
  private readonly log = logger.child({ component: 'MediaService' });

  /**
   * Faz upload de um buffer no bucket "media" e retorna URL assinada.
   * O caminho é organizado: {instanceId}/{yyyy-mm}/{messageId}.{ext}
   */
  async upload(opts: {
    instanceId: string;
    messageId?: string;
    buffer: Buffer;
    mimeType?: string;
    extension?: string;
  }): Promise<UploadResult> {
    const supabase = getSupabaseAdmin();
    const id = opts.messageId ?? uuid();
    const ext = (
      opts.extension ||
      (opts.mimeType ? mime.extension(opts.mimeType) || 'bin' : 'bin')
    )
      .toString()
      .replace(/^\./, '');
    const ym = new Date().toISOString().slice(0, 7);
    const fileName = `${id}.${ext}`;
    const storagePath = `${opts.instanceId}/${ym}/${fileName}`;

    const { error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(storagePath, opts.buffer, {
        contentType: opts.mimeType ?? 'application/octet-stream',
        upsert: true,
        cacheControl: '604800',
      });
    if (error) {
      this.log.error({ err: error, storagePath }, 'falha no upload de mídia');
      throw error;
    }

    const url = await this.signedUrl(storagePath);
    return {
      path: storagePath,
      url,
      size: opts.buffer.length,
      mime: opts.mimeType ?? 'application/octet-stream',
    };
  }

  async signedUrl(storagePath: string): Promise<string> {
    const { data, error } = await getSupabaseAdmin()
      .storage.from(MEDIA_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    if (error || !data) throw error ?? new Error('signed url empty');
    return data.signedUrl;
  }

  async download(storagePath: string): Promise<Buffer> {
    const { data, error } = await getSupabaseAdmin()
      .storage.from(MEDIA_BUCKET)
      .download(storagePath);
    if (error || !data) throw error ?? new Error('download falhou');
    const arr = await data.arrayBuffer();
    return Buffer.from(arr);
  }

  /**
   * Converte qualquer áudio para OGG/Opus mono 16kHz (formato esperado WhatsApp PTT).
   */
  async toOggOpus(input: Buffer): Promise<Buffer> {
    const tmp = os.tmpdir();
    const inFile = path.join(tmp, `${uuid()}.in`);
    const outFile = path.join(tmp, `${uuid()}.ogg`);
    try {
      await fs.writeFile(inFile, input);
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inFile)
          .audioCodec('libopus')
          .audioFrequency(16000)
          .audioChannels(1)
          .audioBitrate('64k')
          .outputOptions(['-avoid_negative_ts', 'make_zero'])
          .toFormat('ogg')
          .on('error', reject)
          .on('end', () => resolve())
          .save(outFile);
      });
      return await fs.readFile(outFile);
    } finally {
      await Promise.all([
        fs.unlink(inFile).catch(() => undefined),
        fs.unlink(outFile).catch(() => undefined),
      ]);
    }
  }

  /**
   * Cria sticker WebP 512x512 a partir de uma imagem.
   */
  async makeSticker(input: Buffer): Promise<Buffer> {
    return await sharp(input, { animated: true })
      .resize({
        width: 512,
        height: 512,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 90 })
      .toBuffer();
  }
}
