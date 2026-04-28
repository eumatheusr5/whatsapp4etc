import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/jwt.service';
import { ZodValidationPipe } from '../../lib/zod-pipe';
import { AppException, ErrCodes } from '../../lib/errors';
import { UsersService } from './users.service';

const UpdateMeSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

const PasswordSchema = z.object({
  newPassword: z.string().min(6).max(72),
});

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(72),
  fullName: z.string().min(1).max(120),
  role: z.enum(['admin', 'atendente']).default('atendente'),
});

const UpdateUserSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  role: z.enum(['admin', 'atendente']).optional(),
  isActive: z.boolean().optional(),
});

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.svc.getMe(user.id);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(UpdateMeSchema)) body: z.infer<typeof UpdateMeSchema>,
  ) {
    return this.svc.updateProfile(user.id, body);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new AppException(
        ErrCodes.VALIDATION,
        'Arquivo ausente',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new AppException(
        ErrCodes.VALIDATION,
        'Apenas imagens são permitidas',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return this.svc.uploadAvatar(user.id, file.buffer, file.mimetype);
  }

  @Post('me/password')
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(PasswordSchema)) body: z.infer<typeof PasswordSchema>,
  ) {
    return this.svc.changePassword(user.id, body.newPassword);
  }

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    await this.svc.ensureAdmin(user.id);
    return this.svc.list();
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateUserSchema)) body: z.infer<typeof CreateUserSchema>,
  ) {
    await this.svc.ensureAdmin(user.id);
    return this.svc.create(body, user.id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) body: z.infer<typeof UpdateUserSchema>,
  ) {
    await this.svc.ensureAdmin(user.id);
    return this.svc.update(id, body, user.id);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.svc.ensureAdmin(user.id);
    if (id === user.id) {
      throw new AppException(
        ErrCodes.VALIDATION,
        'Você não pode desativar sua própria conta',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    return this.svc.remove(id, user.id);
  }
}
