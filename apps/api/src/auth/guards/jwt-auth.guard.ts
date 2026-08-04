import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ROLE_PERMISSIONS } from '../auth.constants';
import { AccessTokenPayload, RequestWithUser } from '../auth-user.interface';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authorization = request.headers.authorization;
    const [scheme, token] = authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('A valid bearer access token is required');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      if (payload.type !== 'access') throw new Error('Unexpected token type');
      if (!payload.sid) throw new Error('Access token has no active session');
    } catch {
      throw new UnauthorizedException('The access token is invalid or expired');
    }

    const [user, session] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: payload.sub } }),
      this.prisma.refreshSession.findUnique({ where: { id: payload.sid } }),
    ]);
    if (!user?.isActive) throw new UnauthorizedException('This account has been deactivated');
    if (user.bannedUntil && user.bannedUntil.getTime() > Date.now()) {
      throw new ForbiddenException(
        `This account is banned until ${user.bannedUntil.toISOString()}`,
      );
    }
    if (
      !session ||
      session.userId !== user.id ||
      session.revokedAt ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('The access token is invalid or expired');
    }
    request.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: [...ROLE_PERMISSIONS[user.role]],
      requestLimitPerHour: user.requestLimitPerHour,
      requestLimitPerDay: user.requestLimitPerDay,
      maxVariantsPerRequest: user.maxVariantsPerRequest,
      maxConcurrentRequests: user.maxConcurrentRequests,
    };
    return true;
  }
}
