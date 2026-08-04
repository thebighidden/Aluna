import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { Permission } from '../auth/auth.constants';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AdminService } from './admin.service';
import { AdminOverviewQueryDto } from './dto/admin-overview-query.dto';
import { AdminGenerationQueryDto } from './dto/admin-generation-query.dto';
import { UpdateGenerationProviderDto } from './dto/update-generation-provider.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  @Permissions(Permission.AnalyticsRead)
  overview(@Query() query: AdminOverviewQueryDto) {
    return this.admin.overview(query.days);
  }

  @Get('generations')
  @Permissions(Permission.AnalyticsRead)
  generations(@Query() query: AdminGenerationQueryDto) {
    return this.admin.generations(query);
  }

  @Patch('generation-provider')
  @Permissions(Permission.UsersManage)
  setGenerationProvider(@Body() dto: UpdateGenerationProviderDto) {
    return this.admin.setGenerationProvider(dto.provider);
  }
}
