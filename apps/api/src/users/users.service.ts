import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { ROLE_PERMISSIONS } from '../auth/auth.constants';
import { CreateUserDto } from './dto/create-user.dto';

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
        createdAt: true,
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
        role: dto.role,
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

  async updateRole(id: string, role: Role) {
    const user = await this.getUser(id);
    if (user.role === Role.OWNER && role !== Role.OWNER) await this.ensureAnotherActiveOwner(id);
    return this.prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });
  }

  async updateStatus(id: string, isActive: boolean) {
    const user = await this.getUser(id);
    if (user.role === Role.OWNER && !isActive) await this.ensureAnotherActiveOwner(id);
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

  private async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, isActive: true },
    });
    if (!user) throw new NotFoundException(`User "${id}" was not found`);
    return user;
  }

  private async ensureAnotherActiveOwner(excludedId: string): Promise<void> {
    const activeOwners = await this.prisma.user.count({
      where: { id: { not: excludedId }, role: Role.OWNER, isActive: true },
    });
    if (activeOwners === 0) {
      throw new BadRequestException('The workspace must keep at least one active owner');
    }
  }
}
