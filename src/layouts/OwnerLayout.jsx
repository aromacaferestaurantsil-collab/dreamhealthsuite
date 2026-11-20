import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useOwnerLayoutData } from '@/hooks/useOwnerLayoutData';
import ApperIcon from '@/components/ApperIcon';
import UserMenu from '@/components/UserMenu';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/layouts/RootLayout';
import { cn } from '@/lib/utils';

export default function OwnerLayout() {
  const { navItems, navGroups, displayName } = useOwnerLayoutData();
  const { memberships, activeTenant, setActiveTenant } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const location = useLocation();
  const groups = navGroups?.length
    ? navGroups
    : [{ label: 'Workspace', items: navItems ?? [] }];

  // Keep PharmaSuite open whenever one of its own pages is active.
  useEffect(() => {
    const activeGroup = groups.find(group => group.items?.some(item => item.path === location.pathname));
    if (activeGroup?.label) {
      setCollapsedGroups(current => ({ ...current, [activeGroup.label]: false }));
    }
  }, [location.pathname, groups]);

  const toggleGroup = label => setCollapsedGroups(current => ({
    ...current,
    [label]: !current[label],
  }));

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className={cn(
        'hidden min-h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200 md:flex',
        collapsed ? 'w-20' : 'w-64'
      )}>
        <div className="flex h-20 items-center gap-3 border-b border-sidebar-border px-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ApperIcon name="Stethoscope" size={22} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="brand-heading text-lg font-black tracking-tight">HealthSuite</div>
              <div className="text-xs text-muted-foreground">360 healthcare cloud</div>
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          {groups.map((group, index) => {
            const isPharmaSuite = group.label === 'PharmaSuite';
            const isOpen = !collapsedGroups[group.label];
            return (
              <div key={group.label ?? index} className="mb-6">
                {!collapsed && group.label && (
                  isPharmaSuite ? (
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.label)}
                      aria-expanded={isOpen}
                      className="mb-2 flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-[11px] font-extrabold uppercase tracking-[0.16em] text-sidebar-foreground hover:bg-sidebar-accent"
                    >
                      <ApperIcon name="Pill" size={16} />
                      <span className="flex-1">PharmaSuite</span>
                      <ApperIcon name={isOpen ? 'ChevronDown' : 'ChevronRight'} size={15} />
                    </button>
                  ) : (
                    <div className="mb-2 px-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">
                      {group.label}
                    </div>
                  )
                )}
                {(!isPharmaSuite || collapsed || isOpen) && (
                  <nav className="space-y-1" aria-label={group.label ?? 'Workspace navigation'}>
                    {(group.items ?? []).map(item => (
                      <NavLink
                        key={item.path ?? item.href ?? item.label}
                        to={item.path ?? item.href ?? '/'}
                        end
                        title={collapsed ? item.label : undefined}
                        className={({ isActive }) => cn(
                          'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                          isActive && 'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground',
                          isPharmaSuite && !collapsed && 'ml-2 w-[calc(100%-0.5rem)] border-l border-sidebar-border pl-4'
                        )}
                      >
                        <ApperIcon name={item.icon ?? 'Circle'} size={18} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </NavLink>
                    ))}
                  </nav>
                )}
              </div>
            );
          })}
        </div>
        <div className="border-t border-sidebar-border p-3">
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => setCollapsed(value => !value)}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            <ApperIcon name={collapsed ? 'PanelLeftOpen' : 'PanelLeftClose'} size={18} />
            {!collapsed && <span className="ml-2">Collapse menu</span>}
          </Button>
        </div>
      </aside>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary md:hidden">
              <ApperIcon name="Stethoscope" size={19} />
            </div>
            <div>
              <div className="text-sm font-extrabold">HealthSuite 360</div>
              <div className="text-xs text-muted-foreground">{activeTenant?.tenants?.display_name ?? "No workspace selected"}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {memberships.length > 1 && <select aria-label="Select workspace" value={activeTenant?.tenant_id ?? ""} onChange={event => setActiveTenant(event.target.value)} className="max-w-44 rounded-md border border-border bg-background px-2 py-1 text-xs">{memberships.map(m => <option key={m.tenant_id} value={m.tenant_id}>{m.tenants?.display_name ?? m.tenant_id}</option>)}</select>}
            <div className="hidden text-right sm:block">
              <div className="text-sm font-bold">{displayName ?? 'Workspace user'}</div>
              <div className="text-xs text-muted-foreground">Secure workspace</div>
            </div>
            <UserMenu />
          </div>
        </header>
        <main className="w-full flex-1 p-4 md:p-8">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
        <nav className="sticky bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card px-1 py-2 md:hidden">
          {(navItems ?? []).slice(0, 5).map(item => (
            <NavLink
              key={item.path ?? item.href ?? item.label}
              to={item.path ?? item.href ?? '/'}
              className={({ isActive }) => cn(
                'flex flex-col items-center gap-1 rounded-md py-1 text-[10px] font-bold text-muted-foreground',
                isActive && 'text-primary'
              )}
            >
              <ApperIcon name={item.icon ?? 'Circle'} size={18} />
              <span className="max-w-full truncate">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
