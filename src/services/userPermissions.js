export const PROFILES = [
  {
    name: 'Super Admin',
    key: 'super-admin',
    description: 'Platform owner with global authority',
    reportsTo: null,
    canManageTeam: true
  },
  {
    name: 'Business Owner',
    key: 'tenant-admin',
    description: 'Owns a tenant and its licensed modules',
    reportsTo: null,
    canManageTeam: true
  },
  {
    name: 'Staff Member',
    key: 'staff',
    description: 'Works within assigned tenant and module permissions',
    reportsTo: 'Business Owner',
    canManageTeam: false
  }
];

export function getProfileMeta(profileName) {
  return PROFILES.find(profile => profile.name === profileName) ?? null;
}

export function getTableAccess(profileName) {
  return profileName === 'Super Admin' || profileName === 'Business Owner';
}

export function getFieldAccess() {
  return true;
}