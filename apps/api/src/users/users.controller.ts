import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Permission } from '../auth/auth.constants';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Permissions(Permission.TeamRead)
  list() {
    return this.users.list();
  }

  @Post()
  @Permissions(Permission.TeamManage)
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id/role')
  @Permissions(Permission.TeamManage)
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.users.updateRole(id, dto.role);
  }

  @Patch(':id/status')
  @Permissions(Permission.TeamManage)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.users.updateStatus(id, dto.isActive);
  }
}
