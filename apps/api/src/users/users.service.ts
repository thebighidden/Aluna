import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { ROLE_PERMISSIONS } from '../auth/auth.constants';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const users = await this.prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        loginCount: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { generations: true } },
      },
    });
    return users.map((user) => ({ ...user, permissions: ROLE_PERMISSIONS[user.role] }));
  }

  async create(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) throw new ConflictException('A user with this email already exists');
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        passwordHash: await hash(dto.password, 12),
        role: Role.USER,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: { select: { generations: true } },
      },
    });
    return { ...user, permissions: ROLE_PERMISSIONS[user.role] };
  }

  async updateStatus(id: string, isActive: boolean) {
    const user = await this.getUser(id);
    if (user.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('The Super Admin account is protected');
    }
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.update({
        where: { id },
        data: { isActive },
        select: { id: true, email: true, name: true, role: true, isActive: true },
      });
      if (!isActive) {
        await transaction.refreshSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return updated;
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.getUser(id);
    if (user.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('The Super Admin account is protected');
    }
    if (dto.name === undefined && dto.email === undefined && dto.password === undefined) {
      throw new BadRequestException('Provide a name, email, or password to update');
    }

    const email = dto.email?.trim().toLowerCase();
    if (email && email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existing) throw new ConflictException('A user with this email already exists');
    }

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(email ? { email } : {}),
          ...(dto.password ? { passwordHash: await hash(dto.password, 12) } : {}),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          loginCount: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { generations: true } },
        },
      });
      if (dto.password) {
        await transaction.refreshSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return { ...updated, permissions: ROLE_PERMISSIONS[updated.role] };
    });
  }

  async remove(id: string): Promise<void> {
    const user = await this.getUser(id);
    if (user.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('The Super Admin account is protected');
    }
    await this.prisma.user.delete({ where: { id } });
  }

  private async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, isActive: true },
    });
    if (!user) throw new NotFoundException(`User "${id}" was not found`);
    return user;
  }
}
