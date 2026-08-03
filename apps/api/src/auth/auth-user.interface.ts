import { Role } from '@prisma/client';
import { Request } from 'express';
import { Permission } from './auth.constants';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  permissions: Permission[];
}

export interface RequestWithUser extends Request {
  user: AuthUser;
}

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  email: string;
  role: Role;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  type: 'refresh';
}
