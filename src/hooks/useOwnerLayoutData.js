import { useMemo } from 'react';
import { useAuth } from '@/layouts/RootLayout';
import { APP_CONFIG, AUTH_PROFILES, GENERIC_AUTH } from '@/config/app.config';

// Auto-discover nav items and footer pages from page exports
const pageRoutes = import.meta.glob('/src/pages/**/*.jsx', { eager: true, import: 'route' });
const pageNavs = import.meta.glob('/src/pages/**/*.jsx', { eager: true, import: 'nav' });

const discoveredNavItems = Object.entries(pageNavs)
  .filter(([, nav]) => nav)
  .map(([filePath, nav]) => { const to = nav.to ?? pageRoutes[filePath]?.path; return { ...nav, to, path: to, href: to }; })
  .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

const navPaths = new Set(discoveredNavItems.map((n) => n.to));
const footerPages = Object.entries(pageRoutes)
  .filter(([, route]) => route && route.layout === 'owner' && route.access !== 'public' && !route.path.includes(':') && !navPaths.has(route.path))
  .map(([, route]) => ({ ...route, to: route.path, href: route.path }));

// PharmaSuite is one parent navigation section. Its child pages keep their own
// route, role visibility and page-specific logic; this only changes navigation.
const sectionFor = (item) => item.section?.startsWith('PharmaSuite') ? 'PharmaSuite' : (item.section ?? null);

// The single data source for OwnerLayout: auth, nav discovery, profile filtering,
// section grouping, footer pages, nav count badges, and the post-login home route.
export function useOwnerLayoutData() {
  const { logout, user } = useAuth();

  const homeRoute = useMemo(() => {
    const matched = AUTH_PROFILES?.find((p) => p.name === user?.profile);
    return matched?.redirectAfterAuth ?? GENERIC_AUTH?.redirectAfterAuth ?? '/';
  }, [user?.profile]);

  const navItems = useMemo(
    () => discoveredNavItems.filter((item) => !item.profiles || item.profiles.includes(user?.profile)),
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

  const initials = `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`.toUpperCase()
    || APP_CONFIG.name.slice(0, 2).toUpperCase();
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.emailAddress;

  return { user, logout, homeRoute, navItems, navGroups, footerPages, initials, displayName, counts: {}, refreshCounts: () => {} };
}
