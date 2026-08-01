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
  TeamRead = 'team:read',
  TeamManage = 'team:manage',
  SettingsRead = 'settings:read',
  SettingsManage = 'settings:manage',
  AnalyticsRead = 'analytics:read',
}

const allPermissions = Object.values(Permission);

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [Role.OWNER]: allPermissions,
  [Role.ADMIN]: allPermissions,
  [Role.CREATOR]: [
    Permission.GenerationCreate,
    Permission.GenerationReadOwn,
    Permission.GenerationDeleteOwn,
    Permission.AssetRead,
    Permission.AssetManage,
    Permission.PresetRead,
    Permission.TeamRead,
    Permission.SettingsRead,
  ],
  [Role.VIEWER]: [
    Permission.GenerationReadOwn,
    Permission.AssetRead,
    Permission.PresetRead,
    Permission.TeamRead,
    Permission.SettingsRead,
  ],
};

export function roleHasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
