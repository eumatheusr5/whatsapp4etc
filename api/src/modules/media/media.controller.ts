import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { MediaService } from './media.service';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly svc: MediaService) {}

  /**
   * Gera signed URL fresca para uma mídia. O frontend chama isso quando
   * a URL anterior expirar (signed URL = 24h).
   */
  @Get('signed-url')
  async signed(@Query('path') path: string) {
    const url = await this.svc.signedUrl(path);
    return { url };
  }
}
