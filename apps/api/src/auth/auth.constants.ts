import { Role } from '@prisma/client';

export enum Permission {
  GenerationCreate = 'generation:create',
  GenerationReadOwn = 'generation:read:own',
  GenerationReadAll = 'generation:read:all',
  GenerationDeleteOwn = 'generation:delete:own',
  GenerationDeleteAll = 'generation:delete:all',
  AssetRead = 'asset:read',
  AssetManage = 'asset:manage',
  PresetRead = 'preset:read',
  PresetManage = 'preset:manage',
  UsersManage = 'users:manage',
  SettingsRead = 'settings:read',
  SettingsManage = 'settings:manage',
  AnalyticsRead = 'analytics:read',
  BrandProfileRead = 'brand-profile:read',
  BrandProfileManage = 'brand-profile:manage',
}

const allPermissions = Object.values(Permission);

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [Role.SUPER_ADMIN]: allPermissions,
  [Role.USER]: [
    Permission.GenerationCreate,
    Permission.GenerationReadOwn,
    Permission.GenerationDeleteOwn,
    Permission.AssetRead,
    Permission.AssetManage,
    Permission.PresetRead,
    Permission.SettingsRead,
    Permission.BrandProfileRead,
    Permission.BrandProfileManage,
  ],
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
