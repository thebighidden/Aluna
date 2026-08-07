import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Permission } from '../auth/auth.constants';
import { RequestWithUser } from '../auth/auth-user.interface';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CreateTicketDto, ReplyTicketDto } from './dto/support.dto';
import { SupportService } from './support.service';

@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get()
  @Permissions(Permission.SettingsRead)
  list(@Req() request: RequestWithUser) {
    return this.support.listForUser(request.user.id);
  }

  @Post()
  @Permissions(Permission.SettingsRead)
  create(@Req() request: RequestWithUser, @Body() dto: CreateTicketDto) {
    return this.support.createTicket({
      userId: request.user.id,
      authorName: request.user.name,
      subject: dto.subject.trim(),
      body: dto.body.trim(),
    });
  }

  @Post(':id/reply')
  @Permissions(Permission.SettingsRead)
  reply(
    @Req() request: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: ReplyTicketDto,
  ) {
    return this.support.reply({
      ticketId: id,
      authorId: request.user.id,
      authorName: request.user.name,
      body: dto.body.trim(),
      fromAdmin: false,
      userId: request.user.id,
    });
  }
}
