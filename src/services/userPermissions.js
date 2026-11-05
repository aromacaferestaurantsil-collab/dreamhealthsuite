import { createPermissions } from '@/services/permissions';

export const PROFILES = {
  Admin_c: {
    label: 'Super Admin',
    isDefault: true,
    isPublic: false,
    canManageTeam: true,
    reportsTo: null
  }
};

export const TABLE_PERMISSIONS = {
  Admin_c: {
    tenants_c: { access: 'Full' },
    subscriptions_c: { access: 'Full' }
  }
};

const permissions = createPermissions(PROFILES, TABLE_PERMISSIONS);

export const getProfileMeta = permissions.getProfileMeta;
export const getTableAccess = permissions.getTableAccess;
export const getFieldAccess = permissions.getFieldAccess;