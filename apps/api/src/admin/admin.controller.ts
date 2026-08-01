import { Controller, Get, Query } from '@nestjs/common';
import { Permission } from '../auth/auth.constants';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AdminService } from './admin.service';
import { AdminOverviewQueryDto } from './dto/admin-overview-query.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  @Permissions(Permission.AnalyticsRead)
  overview(@Query() query: AdminOverviewQueryDto) {
    return this.admin.overview(query.days);
  }
}
