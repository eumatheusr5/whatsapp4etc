import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { getConfig } from '../../lib/config';
import { AppException, ErrCodes } from '../../lib/errors';
import { HttpStatus } from '@nestjs/common';

export interface AuthUser {
  id: string;
  email?: string;
  role?: string;
}

@Injectable()
export class JwtAuthService {
  private readonly secret: string;

  constructor() {
    this.secret = getConfig().SUPABASE_JWT_SECRET;
  }

  verify(token: string): AuthUser {
    if (!token) {
      throw new AppException(ErrCodes.UNAUTHORIZED, 'Token ausente', HttpStatus.UNAUTHORIZED);
    }
    try {
      const payload = jwt.verify(token, this.secret) as jwt.JwtPayload;
      const userId = payload.sub;
      if (!userId) {
        throw new Error('JWT sem sub');
      }
      return {
        id: userId,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        role: typeof payload.role === 'string' ? payload.role : undefined,
      };
    } catch (err) {
      throw new AppException(
        ErrCodes.UNAUTHORIZED,
        'Token inválido',
        HttpStatus.UNAUTHORIZED,
        { reason: (err as Error).message },
      );
    }
  }
}
