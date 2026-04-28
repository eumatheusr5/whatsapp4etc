import { Injectable, HttpStatus } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { createRemoteJWKSet, jwtVerify, decodeProtectedHeader } from 'jose';
import { getConfig } from '../../lib/config';
import { AppException, ErrCodes } from '../../lib/errors';

export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
}

@Injectable()
export class JwtAuthService {
  private readonly hsSecret: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly issuer: string;

  constructor() {
    const config = getConfig();
    this.hsSecret = config.SUPABASE_JWT_SECRET;
    this.issuer = `${config.SUPABASE_URL}/auth/v1`;
    this.jwks = createRemoteJWKSet(
      new URL(`${config.SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
      { cacheMaxAge: 600_000, cooldownDuration: 30_000 },
    );
  }

  async verify(token: string): Promise<AuthUser> {
    if (!token) {
      throw new AppException(ErrCodes.UNAUTHORIZED, 'Token ausente', HttpStatus.UNAUTHORIZED);
    }

    let header: { alg?: string; kid?: string };
    try {
      header = decodeProtectedHeader(token);
    } catch (err) {
      throw new AppException(
        ErrCodes.UNAUTHORIZED,
        'Token malformado',
        HttpStatus.UNAUTHORIZED,
        { reason: (err as Error).message },
      );
    }

    try {
      if (header.alg && header.alg !== 'HS256') {
        const { payload } = await jwtVerify(token, this.jwks, {
          issuer: this.issuer,
        });
        return this.mapPayload(payload);
      }

      const payload = jwt.verify(token, this.hsSecret, {
        algorithms: ['HS256'],
      }) as jwt.JwtPayload;
      return this.mapPayload(payload);
    } catch (err) {
      throw new AppException(
        ErrCodes.UNAUTHORIZED,
        'Token inválido',
        HttpStatus.UNAUTHORIZED,
        { reason: (err as Error).message, alg: header.alg },
      );
    }
  }

  private mapPayload(payload: Record<string, unknown> | jwt.JwtPayload): AuthUser {
    const userId = payload.sub;
    if (typeof userId !== 'string' || !userId) {
      throw new Error('JWT sem sub');
    }
    return {
      id: userId,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      role: typeof payload.role === 'string' ? payload.role : undefined,
    };
  }
}
