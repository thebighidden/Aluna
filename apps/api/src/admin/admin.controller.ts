import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Permission } from '../auth/auth.constants';
import { RequestWithUser } from '../auth/auth-user.interface';
import { Permissions } from '../auth/decorators/permissions.decorator';
import {
  BroadcastNotificationDto,
  ComposeWaitlistMessageDto,
} from './dto/broadcast-notification.dto';
import { ReplyTicketDto, UpdateTicketStatusDto } from '../support/dto/support.dto';
import { AdminService } from './admin.service';
import { AdminOverviewQueryDto } from './dto/admin-overview-query.dto';
import { AdminGenerationQueryDto } from './dto/admin-generation-query.dto';
import { UpdateGenerationProviderDto } from './dto/update-generation-provider.dto';
import { UpdateGenerationModelDto } from './dto/update-generation-model.dto';
import { AdminWaitlistQueryDto } from './dto/admin-waitlist-query.dto';
import { UpdateWaitlistSubscriberDto } from './dto/update-waitlist-subscriber.dto';
import { UpdateProviderCredentialsDto } from './dto/update-provider-credentials.dto';

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

  @Patch('generation-model')
  @Permissions(Permission.UsersManage)
  setGenerationModel(@Body() dto: UpdateGenerationModelDto) {
    return this.admin.setGenerationModel(dto.provider, dto.model);
  }

  @Get('waitlist')
  @Permissions(Permission.AnalyticsRead)
  waitlist(@Query() query: AdminWaitlistQueryDto) {
    return this.admin.waitlist(query);
  }

  @Patch('waitlist/:id')
  @Permissions(Permission.UsersManage)
  updateWaitlistSubscriber(@Param('id') id: string, @Body() dto: UpdateWaitlistSubscriberDto) {
    return this.admin.updateWaitlistSubscriber(id, dto);
  }

  @Delete('waitlist/:id')
  @Permissions(Permission.UsersManage)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeWaitlistSubscriber(@Param('id') id: string) {
    return this.admin.removeWaitlistSubscriber(id);
  }

  @Post('notifications')
  @Permissions(Permission.UsersManage)
  broadcast(@Body() dto: BroadcastNotificationDto) {
    return this.admin.broadcast({
      userIds: dto.userIds ?? [],
      title: dto.title.trim(),
      body: dto.body.trim(),
      channel: dto.channel,
    });
  }

  @Get('users/:id/costs')
  @Permissions(Permission.UsersManage)
  userCosts(@Param('id') id: string) {
    return this.admin.userCostBreakdown(id);
  }

  @Get('waitlist/templates')
  @Permissions(Permission.UsersManage)
  waitlistTemplates() {
    return this.admin.waitlistTemplates();
  }

  @Post('waitlist/:id/message')
  @Permissions(Permission.UsersManage)
  composeWaitlistMessage(
    @Req() request: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: ComposeWaitlistMessageDto,
  ) {
    return this.admin.composeWaitlistMessage({
      subscriberId: id,
      templateId: dto.template,
      sentByName: request.user.name,
      appUrl: this.admin.publicAppUrl(),
    });
  }

  @Get('support')
  @Permissions(Permission.UsersManage)
  supportTickets(@Query('status') status?: string) {
    return this.admin.supportTickets(status);
  }

  @Post('support/:id/reply')
  @Permissions(Permission.UsersManage)
  replyToTicket(
    @Req() request: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: ReplyTicketDto,
  ) {
    return this.admin.replyToTicket({
      ticketId: id,
      adminId: request.user.id,
      adminName: request.user.name,
      body: dto.body.trim(),
    });
  }

  @Patch('support/:id/status')
  @Permissions(Permission.UsersManage)
  setTicketStatus(@Param('id') id: string, @Body() dto: UpdateTicketStatusDto) {
    return this.admin.setTicketStatus(id, dto.status);
  }

  @Get('provider-credentials')
  @Permissions(Permission.UsersManage)
  providerCredentials() {
    return this.admin.providerCredentials();
  }

  @Patch('provider-credentials')
  @Permissions(Permission.UsersManage)
  updateProviderCredentials(@Body() dto: UpdateProviderCredentialsDto) {
    return this.admin.updateProviderCredentials(dto);
  }
}
