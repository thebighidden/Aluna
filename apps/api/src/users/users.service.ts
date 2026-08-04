import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GenerationStatus, Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { ROLE_PERMISSIONS } from '../auth/auth.constants';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserAccessDto } from './dto/update-user-access.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1_000);
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    const activeStatuses = [
      GenerationStatus.QUEUED,
      GenerationStatus.ANALYZING,
      GenerationStatus.GENERATING,
    ];
    const [users, hourlyUsage, dailyUsage, activeUsage] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          bannedUntil: true,
          banReason: true,
          requestLimitPerHour: true,
          requestLimitPerDay: true,
          maxVariantsPerRequest: true,
          maxConcurrentRequests: true,
          lastLoginAt: true,
          loginCount: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { generations: true } },
        },
      }),
      this.prisma.generation.groupBy({
        by: ['userId'],
        where: { userId: { not: null }, createdAt: { gte: hourAgo } },
        _count: { _all: true },
      }),
      this.prisma.generation.groupBy({
        by: ['userId'],
        where: { userId: { not: null }, createdAt: { gte: today } },
        _count: { _all: true },
      }),
      this.prisma.generation.groupBy({
        by: ['userId'],
        where: { userId: { not: null }, status: { in: activeStatuses } },
        _count: { _all: true },
      }),
    ]);
    const usageCount = (rows: typeof hourlyUsage, userId: string) =>
      rows.find((row) => row.userId === userId)?._count._all ?? 0;
    return users.map((user) => ({
      ...user,
      permissions: ROLE_PERMISSIONS[user.role],
      policyUsage: {
        requestsThisHour: usageCount(hourlyUsage, user.id),
        requestsToday: usageCount(dailyUsage, user.id),
        activeRequests: usageCount(activeUsage, user.id),
      },
    }));
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
        requestLimitPerHour: dto.requestLimitPerHour,
        requestLimitPerDay: dto.requestLimitPerDay,
        maxVariantsPerRequest: dto.maxVariantsPerRequest,
        maxConcurrentRequests: dto.maxConcurrentRequests,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        bannedUntil: true,
        banReason: true,
        requestLimitPerHour: true,
        requestLimitPerDay: true,
        maxVariantsPerRequest: true,
        maxConcurrentRequests: true,
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

  async updateAccess(id: string, dto: UpdateUserAccessDto) {
    const user = await this.getUser(id);
    if (user.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('The Super Admin account is protected');
    }
    if (!Object.values(dto).some((value) => value !== undefined)) {
      throw new BadRequestException('Provide at least one access-control setting');
    }

    const bannedUntil = dto.bannedUntil ? new Date(dto.bannedUntil) : null;
    if (bannedUntil && bannedUntil.getTime() <= Date.now()) {
      throw new BadRequestException('A timed ban must end in the future');
    }
    const shouldRevokeSessions = Boolean(bannedUntil);

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.user.update({
        where: { id },
        data: {
          ...(dto.bannedUntil !== undefined ? { bannedUntil } : {}),
          ...(dto.banReason !== undefined ? { banReason: dto.banReason?.trim() || null } : {}),
          ...(dto.requestLimitPerHour !== undefined
            ? { requestLimitPerHour: dto.requestLimitPerHour }
            : {}),
          ...(dto.requestLimitPerDay !== undefined
            ? { requestLimitPerDay: dto.requestLimitPerDay }
            : {}),
          ...(dto.maxVariantsPerRequest !== undefined
            ? { maxVariantsPerRequest: dto.maxVariantsPerRequest }
            : {}),
          ...(dto.maxConcurrentRequests !== undefined
            ? { maxConcurrentRequests: dto.maxConcurrentRequests }
            : {}),
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          bannedUntil: true,
          banReason: true,
          requestLimitPerHour: true,
          requestLimitPerDay: true,
          maxVariantsPerRequest: true,
          maxConcurrentRequests: true,
        },
      });
      if (shouldRevokeSessions) {
        await transaction.refreshSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return updated;
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
