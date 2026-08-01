import { SetMetadata } from '@nestjs/common';
import { Permission } from '../auth.constants';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: Permission[]): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_KEY, permissions);
