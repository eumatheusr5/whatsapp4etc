import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt.service';
import { MessagesService } from './messages.service';
import { ZodValidationPipe } from '../../lib/zod-pipe';
import { AppException, ErrCodes } from '../../lib/errors';

const SendTextSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().min(1).max(8000),
  replyToMessageId: z.string().uuid().optional(),
});

const ReactSchema = z.object({
  emoji: z.string().min(0).max(8),
});

const EditSchema = z.object({
  body: z.string().min(1).max(8000),
});

const ForwardSchema = z.object({
  targetConversationIds: z.array(z.string().uuid()).min(1).max(20),
});

const SendMediaMetaSchema = z.object({
  conversationId: z.string().uuid(),
  type: z.enum(['image', 'video', 'document', 'audio', 'ptt', 'sticker']),
  caption: z.string().max(4000).optional(),
  replyToMessageId: z.string().uuid().optional(),
  fileName: z.string().max(255).optional(),
});

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly svc: MessagesService) {}

  @Post('text')
  sendText(
    @Body(new ZodValidationPipe(SendTextSchema)) body: z.infer<typeof SendTextSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.sendText({ ...body, userId: user.id });
  }

  @Post('media')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  async sendMedia(
    @Body() rawBody: Record<string, string>,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) {
      throw new AppException(ErrCodes.VALIDATION, 'Arquivo ausente', HttpStatus.UNPROCESSABLE_ENTITY);
    }
    const meta = SendMediaMetaSchema.parse({
      conversationId: rawBody.conversationId,
      type: rawBody.type,
      caption: rawBody.caption,
      replyToMessageId: rawBody.replyToMessageId,
      fileName: rawBody.fileName ?? file.originalname,
    });
    return this.svc.sendMedia({
      ...meta,
      buffer: file.buffer,
      mimeType: file.mimetype,
      userId: user.id,
    });
  }

  @Post(':id/react')
  react(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ReactSchema)) body: z.infer<typeof ReactSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.react(id, user.id, body.emoji);
  }

  @Post(':id/edit')
  edit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(EditSchema)) body: z.infer<typeof EditSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.edit(id, user.id, body.body);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.deleteForAll(id, user.id);
  }

  @Post(':id/forward')
  forward(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ForwardSchema)) body: z.infer<typeof ForwardSchema>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.forward(id, body.targetConversationIds, user.id);
  }
}
