import { useMemo } from 'react';
import { useAuth } from '@/layouts/RootLayout';
import { APP_CONFIG, AUTH_PROFILES, GENERIC_AUTH } from '@/config/app.config';

const pageMods = import.meta.glob('/src/pages/**/*.jsx', { eager: true });
const discoveredNavItems = Object.entries(pageMods)
  .filter(([, mod]) => mod.nav)
  .map(([, mod]) => { const to = mod.nav.to ?? mod.route?.path; return { ...mod.nav, to, path: to, href: to }; })
  .filter(item => typeof item.to === 'string' && item.to.startsWith('/'))
  .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
const uniqueNavItems = [...new Map(discoveredNavItems.map(item => [item.to, item])).values()];
const navPaths = new Set(uniqueNavItems.map(item => item.to));
const footerPages = Object.entries(pageMods)
  .filter(([, mod]) => mod.route && mod.route.layout === 'owner' && mod.route.access !== 'public' && !mod.route.path.includes(':') && !navPaths.has(mod.route.path))
  .map(([, mod]) => ({ ...mod.route, to: mod.route.path, href: mod.route.path }));

const sectionFor = item => item.section?.startsWith('PharmaSuite') ? 'PharmaSuite' : (item.section ?? null);
const moduleForPath = path => {
  if (/^\/pharmacy(?:\/|$)|^\/pharmacy-workflows$/.test(path)) return 'pharmacy_suite';
  if (/^\/laboratory(?:\/|$)/.test(path)) return 'laboratory_suite';
  if (/^\/doctors?(?:\/|$)/.test(path)) return 'doctor_suite';
  if (/^\/patients?(?:\/|$)/.test(path)) return 'patient_suite';
  if (/^\/care-connect(?:\/|$)/.test(path)) return 'care_connect';
  if (/^\/analytics(?:\/|$)/.test(path)) return 'analytics';
  return null;
};
const moduleAliases = {
  pharmacy_suite:['pharmacy_suite','pharmacy'],
  laboratory_suite:['laboratory_suite','lab_suite','laboratory','lab'],
  doctor_suite:['doctor_suite','doctor','doctors'],
  patient_suite:['patient_suite','patient','patients'],
  care_connect:['care_connect','care','careconnect'],
  analytics:['analytics','health_analytics'],
};

export function useOwnerLayoutData() {
  const { logout, user, memberships, activeTenant, moduleAccess } = useAuth();
  const homeRoute = useMemo(() => {
    const matched = AUTH_PROFILES?.find(p => p.name === user?.profile);
    return matched?.redirectAfterAuth ?? GENERIC_AUTH?.redirectAfterAuth ?? '/';
  }, [user?.profile]);
  const navItems = useMemo(() => uniqueNavItems.filter(item => {
    if (['Patient','Doctor'].includes(user?.profile) && item.path !== (user.profile==='Patient'?'/patient-portal':'/doctor-portal')) return false;
    if (!['Patient','Doctor'].includes(user?.profile) && ['/patient-portal','/doctor-portal'].includes(item.path)) return false;
    if (item.profiles && !item.profiles.includes(user?.profile)) return false;
    const moduleKey = moduleForPath(item.to);
    if (!moduleKey) return true;
    if (moduleAccess?.status !== 'ready' || moduleAccess.tenantId !== activeTenant?.tenant_id) return false;
    if (!moduleAliases[moduleKey].some(key => moduleAccess.keys.includes(key))) return false;
    const role = activeTenant?.role;
    if (item.profiles) return true;
    const roleAccess = {
      pharmacy_suite:['owner','admin','manager','pharmacist'],
      laboratory_suite:['owner','admin','manager','pathologist','lab_technician'],
      doctor_suite:['owner','admin','manager','doctor','receptionist'],
      patient_suite:['owner','admin','manager','receptionist','doctor','pharmacist','lab_technician','pathologist'],
      care_connect:['owner','admin','manager','care_worker'],
      analytics:['owner','admin','analyst'],
    };
    return roleAccess[moduleKey]?.includes(role) ?? false;
  }), [user?.profile, moduleAccess?.status, moduleAccess?.tenantId, moduleAccess?.keys, activeTenant?.tenant_id, activeTenant?.role]);
  const navGroups = useMemo(() => {
    const groups = [];
    const byLabel = new Map();
    for (const item of navItems) {
      const groupLabel = sectionFor(item);
      let group = groupLabel != null ? byLabel.get(groupLabel) : null;
      if (!group) {
        group = { label: groupLabel, items: [], icon: groupLabel === 'PharmaSuite' ? 'Pill' : null };
        groups.push(group);
        if (groupLabel != null) byLabel.set(groupLabel, group);
      }
      group.items.push(item);
    }
    return groups;
  }, [navItems]);
  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase() || APP_CONFIG.name.slice(0, 2).toUpperCase();
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.emailAddress;
  return { user, logout, homeRoute, navItems, navGroups, footerPages, initials, displayName, counts: {}, refreshCounts: () => {} };
}
