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
import { TagsService } from './tags.service';

const TagSchema = z.object({
  name: z.string().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor deve estar em formato #RRGGBB'),
});

const TagUpdateSchema = TagSchema.partial();

@Controller('tags')
@UseGuards(JwtAuthGuard)
export class TagsController {
  constructor(private readonly svc: TagsService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(TagSchema)) body: z.infer<typeof TagSchema>,
  ) {
    return this.svc.create(body, user.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(TagUpdateSchema)) body: z.infer<typeof TagUpdateSchema>,
  ) {
    return this.svc.update(id, body, user.id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(id, user.id);
  }

  @Post(':id/assign/:contactId')
  assign(@Param('id', ParseUUIDPipe) id: string, @Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.svc.assign(contactId, id);
  }

  @Delete(':id/assign/:contactId')
  unassign(@Param('id', ParseUUIDPipe) id: string, @Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.svc.unassign(contactId, id);
  }
}
