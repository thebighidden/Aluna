import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { AnalyticsService } from './analytics.service';
import { CreateSiteVisitDto } from './dto/create-site-visit.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post('visits')
  @Public()
  @HttpCode(202)
  recordVisit(
    @Body() dto: CreateSiteVisitDto,
    @Headers('user-agent') userAgent?: string,
    @Headers('cf-ipcountry') country?: string,
  ) {
    return this.analytics.recordVisit(dto, userAgent, country);
  }
}
