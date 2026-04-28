import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt.service';
import { ConversationsService } from './conversations.service';
import { z } from 'zod';
import { ZodValidationPipe } from '../../lib/zod-pipe';
import { getSupabaseAdmin } from '../../lib/supabase-admin';

const TypingSchema = z.object({ state: z.enum(['composing', 'paused']) });

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly svc: ConversationsService) {}

  @Post(':id/assign')
  async assign(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.svc.assign(id, user.id);
    return { ok: true };
  }

  @Post(':id/release')
  async release(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const isAdmin = await this.isAdmin(user.id);
    await this.svc.release(id, user.id, isAdmin);
    return { ok: true };
  }

  @Post(':id/read')
  async read(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.svc.markRead(id, user.id);
    return { ok: true };
  }

  @Post(':id/typing')
  async typing(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(TypingSchema)) body: z.infer<typeof TypingSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    await this.svc.sendTyping(id, user.id, body.state);
    return { ok: true };
  }

  private async isAdmin(userId: string): Promise<boolean> {
    const { data } = await getSupabaseAdmin()
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    return data?.role === 'admin';
  }
}
