import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { sdk } from '@/services/sdk';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ListSkeleton } from '@/components/PageSkeleton';

export const route = { path: '/subscriptions', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'CreditCard', label: 'Subscriptions', order: 4, profiles: ['Admin_c'] };

const FIELDS = ['Name', 'tenant_c', 'plan_c', 'billing_cycle_c', 'status_c', 'amount_c', 'currency_c', 'start_date_c', 'end_date_c', 'trial_days_c'];

export default function Subscriptions() {
  const [search, setSearch] = useState('');
  const { data, loading, error, run } = useFetch(() => {
    let query = sdk.table('subscriptions_c').select(FIELDS).orderByDesc('CreatedOn').limit(100);
    if (search) query = query.where(window.ApperSDK.CoreSDK.contains('Name', search));
    return query.fetch().then(result => {
      if (!result.success) throw new Error(result.message);
      return result.data;
    });
  }, [search]);
  const rows = data ?? [];
  const active = rows.filter(row => row.status_c === 'Active').length;
  const trials = rows.filter(row => row.status_c === 'Trial').length;
  const overdue = rows.filter(row => row.status_c === 'Past Due').length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-widest text-primary">Super Admin</div>
          <h1 className="brand-heading mt-1 text-3xl font-black">Subscriptions and licences</h1>
          <p className="mt-1 text-sm text-muted-foreground">Monitor plans, trial periods, renewal dates and account status.</p>
        </div>
        <Button asChild><Link to="/subscriptions/new">Create subscription <ApperIcon name="Plus" size={16} className="ml-2" /></Link></Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[['Active subscriptions', active, 'Check renewals'], ['Trial accounts', trials, 'Review trial conversion'], ['Past due', overdue, 'Follow up payment']].map(([label, value, note]) => (
          <Card key={label}><CardContent className="p-5"><div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div><div className="brand-heading mt-2 text-3xl font-black">{loading ? '—' : value}</div><div className="mt-1 text-xs text-muted-foreground">{note}</div></CardContent></Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Licence register <Badge variant="secondary" className="ml-2">{rows.length}</Badge></CardTitle>
            <Input className="w-full sm:w-72" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search subscription reference…" />
          </div>
        </CardHeader>
        <CardContent>
          {loading && !data ? <ListSkeleton rows={6} /> : error ? <div className="text-sm text-destructive">{error.message} <Button onClick={run} variant="outline" size="sm">Retry</Button></div> : rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-3">Reference / customer</th><th>Plan</th><th>Billing</th><th>Amount</th><th>End date</th><th>Status</th><th /></tr></thead>
                <tbody className="divide-y divide-border">
                  {rows.map(row => (
                    <tr key={row.Id} className="hover:bg-accent">
                      <td className="py-4"><div className="font-bold">{row.Name}</div><div className="text-xs text-muted-foreground">{row.tenant_c?.Name ?? 'Tenant not linked'}</div></td>
                      <td>{row.plan_c}</td><td>{row.billing_cycle_c}</td>
                      <td className="font-bold">{row.currency_c} {Number(row.amount_c ?? 0).toLocaleString('en-IN')}</td>
                      <td>{row.end_date_c || 'No expiry'}</td>
                      <td><Badge variant={row.status_c === 'Active' ? 'default' : row.status_c === 'Past Due' ? 'destructive' : 'secondary'}>{row.status_c}</Badge></td>
                      <td className="text-right"><Button asChild variant="ghost" size="sm"><Link to={`/subscriptions/${row.Id}`}>Manage <ApperIcon name="ChevronRight" size={15} /></Link></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="py-10 text-center text-sm text-muted-foreground">No subscription records yet. Create a licence to get started.</div>}
        </CardContent>
      </Card>
      <p className="text-xs leading-5 text-muted-foreground">Demo amounts and dates are sample records, not published pricing. Expired or suspended accounts should retain their data and permit renewal or export; do not delete clinical records because a licence expires.</p>
    </div>
  );
}