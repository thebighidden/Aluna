import {
  ForbiddenException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ROLE_PERMISSIONS } from './auth.constants';
import { RefreshTokenPayload } from './auth-user.interface';
import { LoginDto } from './dto/login.dto';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    permissions: readonly string[];
    requestLimitPerHour: number;
    requestLimitPerDay: number;
    maxVariantsPerRequest: number;
    maxConcurrentRequests: number;
  };
}

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.prisma.refreshSession.deleteMany({
      where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }] },
    });
    await this.ensureSuperAdmin();
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Email or password is incorrect');
    }
    if (!user.isActive) throw new ForbiddenException('This account has been deactivated');
    if (user.bannedUntil && user.bannedUntil.getTime() > Date.now()) {
      throw new ForbiddenException(
        `This account is banned until ${user.bannedUntil.toISOString()}`,
      );
    }
    const authenticatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), loginCount: { increment: 1 } },
    });
    await this.revokeUserSessions(user.id);
    return this.issueTokens(authenticatedUser);
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });
    if (!session || session.userId !== payload.sub || session.revokedAt || !session.user.isActive) {
      throw new UnauthorizedException('The refresh session is no longer valid');
    }
    if (session.user.bannedUntil && session.user.bannedUntil.getTime() > Date.now()) {
      throw new ForbiddenException(
        `This account is banned until ${session.user.bannedUntil.toISOString()}`,
      );
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('The refresh session has expired');
    }
    if (!this.hashesMatch(session.tokenHash, this.hashToken(refreshToken))) {
      throw new UnauthorizedException('The refresh token is invalid');
    }

    const revoked = await this.prisma.refreshSession.updateMany({
      where: { id: session.id, userId: session.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count !== 1)
      throw new UnauthorizedException('The refresh session is no longer valid');
    return this.issueTokens(session.user);
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = await this.verifyRefreshToken(refreshToken);
      await this.prisma.refreshSession.updateMany({
        where: { id: payload.sid, userId: payload.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      // Logout is idempotent and should not reveal token validity.
    }
  }

  private async issueTokens(user: User): Promise<AuthResponse> {
    const accessTtl = this.config.getOrThrow<number>('JWT_ACCESS_TTL_SECONDS');
    const refreshTtl = this.config.getOrThrow<number>('JWT_REFRESH_TTL_SECONDS');
    const sessionId = randomUUID();
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, sid: sessionId, email: user.email, role: user.role, type: 'access' },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessTtl,
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, sid: sessionId, type: 'refresh' },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTtl,
      },
    );

    await this.prisma.refreshSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshTtl * 1_000),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: accessTtl,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: ROLE_PERMISSIONS[user.role],
        requestLimitPerHour: user.requestLimitPerHour,
        requestLimitPerDay: user.requestLimitPerDay,
        maxVariantsPerRequest: user.maxVariantsPerRequest,
        maxConcurrentRequests: user.maxConcurrentRequests,
      },
    };
  }

  private async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      if (payload.type !== 'refresh') throw new Error('Unexpected token type');
      return payload;
    } catch {
      throw new UnauthorizedException('The refresh token is invalid or expired');
    }
  }

  private async ensureSuperAdmin(): Promise<void> {
    const superAdmin = await this.prisma.user.findFirst({
      where: { role: Role.SUPER_ADMIN },
      select: { id: true },
    });
    if (superAdmin) return;

    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    const email = this.config
      .getOrThrow<string>(isProduction ? 'BOOTSTRAP_ADMIN_EMAIL' : 'DEMO_USER_EMAIL')
      .trim()
      .toLowerCase();
    const password = this.config.getOrThrow<string>(
      isProduction ? 'BOOTSTRAP_ADMIN_PASSWORD' : 'DEMO_USER_PASSWORD',
    );
    const name = isProduction
      ? this.config.getOrThrow<string>('BOOTSTRAP_ADMIN_NAME')
      : 'Alex Morgan';
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: { role: Role.SUPER_ADMIN, isActive: true },
      });
      return;
    }

    await this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await hash(password, 12),
        role: Role.SUPER_ADMIN,
      },
    });
  }

  private async revokeUserSessions(userId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private hashesMatch(expected: string, actual: string): boolean {
    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(actual);
    return (
      expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
    );
  }
}
