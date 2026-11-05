import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { sdk } from '@/services/sdk';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ListSkeleton } from '@/components/PageSkeleton';

export const route = { path: '/tenants', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'Building2', label: 'Businesses', order: 3, profiles: ['Admin_c'] };

const FIELDS = ['Name', 'business_type_c', 'status_c', 'modules_c', 'subscription_plan_c', 'email_c', 'phone_c'];

export default function Tenants() {
  const [search, setSearch] = useState('');
  const { data, loading, error, run } = useFetch(() => {
    let query = sdk.table('tenants_c').select(FIELDS).orderByDesc('CreatedOn').limit(100);
    if (search) query = query.where(window.ApperSDK.CoreSDK.contains('Name', search));
    return query.fetch().then(result => {
      if (!result.success) throw new Error(result.message);
      return result.data;
    });
  }, [search]);
  const rows = data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-widest text-primary">Super Admin</div>
          <h1 className="brand-heading mt-1 text-3xl font-black">Business tenants</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage organisations and the products licensed to each one.</p>
        </div>
        <Button asChild><Link to="/tenants/new">Add business <ApperIcon name="Plus" size={16} className="ml-2" /></Link></Button>
      </div>
      <Card className="border-border/70">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Registered organisations <Badge variant="secondary" className="ml-2">{rows.length}</Badge></CardTitle>
            <div className="relative w-full sm:w-72">
              <ApperIcon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search business name…" className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && !data ? <ListSkeleton rows={6} /> : error ? (
            <div className="p-5 text-sm text-destructive">{error.message} <Button variant="outline" size="sm" onClick={run}>Retry</Button></div>
          ) : rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <tr><th className="py-3">Organisation</th><th>Business type</th><th>Licensed plan</th><th>Status</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map(row => (
                    <tr key={row.Id} className="hover:bg-accent">
                      <td className="py-4 pr-3"><div className="font-bold">{row.Name}</div><div className="text-xs text-muted-foreground">{row.email_c ?? row.phone_c ?? 'Contact not added'}</div></td>
                      <td>{row.business_type_c ?? '—'}</td>
                      <td>{row.subscription_plan_c ?? 'Unassigned'}</td>
                      <td><Badge variant={row.status_c === 'Active' ? 'default' : 'secondary'}>{row.status_c ?? 'Pending'}</Badge></td>
                      <td className="text-right"><Button asChild size="sm" variant="ghost"><Link to={`/tenants/${row.Id}`}>View <ApperIcon name="ChevronRight" size={15} /></Link></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center">
              <ApperIcon name="Building2" size={28} className="mx-auto text-muted-foreground" />
              <p className="mt-3 font-bold">No businesses found</p>
              <p className="mt-1 text-sm text-muted-foreground">Register your first organisation to begin.</p>
              <Button asChild className="mt-4"><Link to="/tenants/new">Register business</Link></Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}