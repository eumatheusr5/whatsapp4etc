import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { StatsService } from './stats.service';

interface AuthedRequest extends Request {
  user?: { id: string };
}

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly svc: StatsService) {}

  @Get('overview')
  overview(@Req() req: AuthedRequest, @Query('days') days?: string) {
    const d = days ? Math.min(180, Math.max(1, parseInt(days, 10) || 30)) : 30;
    return this.svc.overview(d, req.user?.id);
  }

  @Get('top-contacts')
  topContacts(@Query('limit') limit?: string) {
    const n = limit ? Math.min(20, Math.max(1, parseInt(limit, 10) || 5)) : 5;
    return this.svc.topContacts(n);
  }
}
