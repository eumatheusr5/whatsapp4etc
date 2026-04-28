import { Body, Controller, Delete, Headers, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt.service';
import { PushService } from './push.service';
import { ZodValidationPipe } from '../../lib/zod-pipe';

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

const UnsubscribeSchema = z.object({ endpoint: z.string().url() });

@Controller('push')
@UseGuards(JwtAuthGuard)
export class PushController {
  constructor(private readonly svc: PushService) {}

  @Post('subscribe')
  subscribe(
    @Body(new ZodValidationPipe(SubscribeSchema)) body: z.infer<typeof SubscribeSchema>,
    @CurrentUser() user: AuthUser,
    @Headers('user-agent') ua?: string,
  ) {
    return this.svc.subscribe(user.id, body, ua);
  }

  @Delete('subscribe')
  unsubscribe(
    @Body(new ZodValidationPipe(UnsubscribeSchema)) body: z.infer<typeof UnsubscribeSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.unsubscribe(user.id, body.endpoint);
  }
}
