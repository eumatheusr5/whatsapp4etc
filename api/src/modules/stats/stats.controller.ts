import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { StatsService } from './stats.service';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private readonly svc: StatsService) {}

  @Get('overview')
  overview(@Query('days') days?: string) {
    return this.svc.overview(days ? Math.min(180, parseInt(days, 10)) : 30);
  }
}
