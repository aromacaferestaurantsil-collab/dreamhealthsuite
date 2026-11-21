import { useMemo } from 'react';
import { useAuth } from '@/layouts/RootLayout';
import { APP_CONFIG, AUTH_PROFILES, GENERIC_AUTH } from '@/config/app.config';

// Discover navigation from route exports. Keep the first route for each path so
// duplicate page exports never create duplicate tabs or sidebar destinations.
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

export function useOwnerLayoutData() {
  const { logout, user } = useAuth();
  const homeRoute = useMemo(() => {
    const matched = AUTH_PROFILES?.find(p => p.name === user?.profile);
    return matched?.redirectAfterAuth ?? GENERIC_AUTH?.redirectAfterAuth ?? '/';
  }, [user?.profile]);
  const navItems = useMemo(
    () => uniqueNavItems.filter(item => !item.profiles || item.profiles.includes(user?.profile)),
    [user?.profile]
  );
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
