import { Module, Global } from '@nestjs/common';
import { JwtAuthGuard } from './jwt.guard';
import { JwtAuthService } from './jwt.service';

@Global()
@Module({
  providers: [JwtAuthGuard, JwtAuthService],
  exports: [JwtAuthGuard, JwtAuthService],
})
export class AuthModule {}
