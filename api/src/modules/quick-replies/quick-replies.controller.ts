import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt.service';
import { ZodValidationPipe } from '../../lib/zod-pipe';
import { QuickRepliesService } from './quick-replies.service';
import { getSupabaseAdmin } from '../../lib/supabase-admin';

const QuickReplySchema = z.object({
  shortcut: z.string().min(2).max(40),
  body: z.string().min(1).max(4000),
  global: z.boolean().default(false),
});

const QuickReplyUpdateSchema = QuickReplySchema.partial();

async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await getSupabaseAdmin()
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  return data?.role === 'admin';
}

@Controller('quick-replies')
@UseGuards(JwtAuthGuard)
export class QuickRepliesController {
  constructor(private readonly svc: QuickRepliesService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return this.svc.list(user.id, await isAdmin(user.id));
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(QuickReplySchema)) body: z.infer<typeof QuickReplySchema>,
  ) {
    return this.svc.create(user.id, await isAdmin(user.id), body);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(QuickReplyUpdateSchema))
    body: z.infer<typeof QuickReplyUpdateSchema>,
  ) {
    return this.svc.update(user.id, await isAdmin(user.id), id, body);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(user.id, await isAdmin(user.id), id);
  }
}
