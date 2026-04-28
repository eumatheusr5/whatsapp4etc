import { CanActivate, ExecutionContext, Injectable, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthService, AuthUser } from './jwt.service';
import { AppException, ErrCodes } from '../../lib/errors';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['authorization'];
    if (!header || typeof header !== 'string') {
      throw new AppException(
        ErrCodes.UNAUTHORIZED,
        'Authorization ausente',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new AppException(
        ErrCodes.UNAUTHORIZED,
        'Authorization malformado',
        HttpStatus.UNAUTHORIZED,
      );
    }
    req.user = await this.jwt.verify(token);
    return true;
  }
}
