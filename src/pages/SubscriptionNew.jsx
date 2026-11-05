import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export const route = { path: '/subscriptions/new', layout: 'owner', access: 'authenticated' };

const TENANT_FIELDS = ['Name', 'business_type_c', 'status_c'];

export default function SubscriptionNew() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ Name: '', tenant_c: '', plan_c: 'Starter', billing_cycle_c: 'Monthly', status_c: 'Trial', amount_c: '0', currency_c: 'INR', start_date_c: new Date().toISOString().slice(0, 10), end_date_c: '', trial_days_c: '30', notes_c: '' });
  const { data: tenants } = useFetch(() => sdk.table('tenants_c').select(TENANT_FIELDS).orderBy('Name').limit(100).fetch().then(result => result.data ?? []), []);
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));

  async function save(event) {
    event.preventDefault();
    if (!form.Name.trim() || !form.tenant_c) {
      toast.error('Enter a reference and choose a business');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, amount_c: Number(form.amount_c), trial_days_c: Number(form.trial_days_c) };
      const result = await sdk.table('subscriptions_c').create(payload);
      if (result.messages?.length) toast.error(result.messages[0]);
      if (!result.data?.length) return;
      toast.success('Subscription created');
      navigate(`/subscriptions/${result.data[0].Id}`);
    } catch (error) {
      toast.error(error.message ?? 'Unable to create subscription');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/subscriptions" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground"><ApperIcon name="ArrowLeft" size={16} /> Back to Subscriptions</Link>
      <div><div className="text-xs font-extrabold uppercase tracking-widest text-primary">Licence administration</div><h1 className="brand-heading mt-1 text-3xl font-black">Create subscription</h1></div>
      <form onSubmit={save} className="space-y-5">
        <Card><CardHeader><CardTitle>Customer and plan</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2"><Label>Subscription reference *</Label><Input value={form.Name} onChange={event => set('Name', event.target.value)} placeholder="e.g. SUB-2026-0009" required /></div>
          <div className="space-y-2 sm:col-span-2"><Label>Business tenant *</Label><Select value={form.tenant_c} onValueChange={value => set('tenant_c', value)}><SelectTrigger><SelectValue placeholder="Choose a business" /></SelectTrigger><SelectContent>{(tenants ?? []).map(tenant => <SelectItem key={tenant.Id} value={tenant.Id}>{tenant.Name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Plan</Label><Select value={form.plan_c} onValueChange={value => set('plan_c', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Starter', 'Professional', 'Enterprise', 'Lifetime', 'Custom'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Billing cycle</Label><Select value={form.billing_cycle_c} onValueChange={value => set('billing_cycle_c', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Monthly', 'Quarterly', 'Annual', 'Lifetime', 'Custom'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Status</Label><Select value={form.status_c} onValueChange={value => set('status_c', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Trial', 'Active', 'Past Due', 'Expired', 'Suspended', 'Cancelled'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Amount</Label><Input type="number" min="0" step="0.01" value={form.amount_c} onChange={event => set('amount_c', event.target.value)} placeholder="0.00" /></div>
          <div className="space-y-2"><Label>Currency</Label><Select value={form.currency_c} onValueChange={value => set('currency_c', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INR">INR</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Trial duration (days)</Label><Input type="number" min="0" value={form.trial_days_c} onChange={event => set('trial_days_c', event.target.value)} placeholder="30" /></div>
          <div className="space-y-2"><Label>Start date</Label><Input type="date" value={form.start_date_c} onChange={event => set('start_date_c', event.target.value)} /></div>
          <div className="space-y-2"><Label>End date (blank for lifetime)</Label><Input type="date" value={form.end_date_c} onChange={event => set('end_date_c', event.target.value)} /></div>
        </CardContent></Card>
        <div className="flex justify-end gap-3"><Button asChild type="button" variant="outline"><Link to="/subscriptions">Cancel</Link></Button><Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create subscription'}</Button></div>
      </form>
    </div>
  );
}