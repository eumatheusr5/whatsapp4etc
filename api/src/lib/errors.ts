import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Erro padrão do app: { code, message, detail }
 */
export class AppException extends HttpException {
  constructor(
    code: string,
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    detail?: Record<string, unknown>,
  ) {
    super({ code, message, detail: detail ?? {} }, statusCode);
  }
}

export const ErrCodes = {
  UNAUTHORIZED: 'ERR_UNAUTHORIZED',
  FORBIDDEN: 'ERR_FORBIDDEN',
  NOT_FOUND: 'ERR_NOT_FOUND',
  VALIDATION: 'ERR_VALIDATION',
  CONFLICT: 'ERR_CONFLICT',
  INSTANCE_NOT_CONNECTED: 'ERR_INSTANCE_NOT_CONNECTED',
  INSTANCE_BANNED: 'ERR_INSTANCE_BANNED',
  CONVERSATION_LOCKED: 'ERR_CONVERSATION_LOCKED',
  INTERNAL: 'ERR_INTERNAL',
  RATE_LIMITED: 'ERR_RATE_LIMITED',
  WHATSAPP_SEND_FAILED: 'ERR_WHATSAPP_SEND_FAILED',
} as const;
