import { Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { Permission } from '../auth/auth.constants';
import { RequestWithUser } from '../auth/auth-user.interface';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Permissions(Permission.SettingsRead)
  list(@Req() request: RequestWithUser) {
    return this.notifications.listForUser(request.user.id);
  }

  @Patch(':id/read')
  @Permissions(Permission.SettingsRead)
  markRead(@Req() request: RequestWithUser, @Param('id') id: string) {
    return this.notifications.markRead(request.user.id, id);
  }

  @Post('read-all')
  @Permissions(Permission.SettingsRead)
  markAllRead(@Req() request: RequestWithUser) {
    return this.notifications.markAllRead(request.user.id);
  }
}
