import { Link, useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useFetch } from '@/hooks/useFetch';
import { sdk } from '@/services/sdk';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { DetailSkeleton } from '@/components/PageSkeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export const route = { path: '/subscriptions/:id', layout: 'owner', access: 'authenticated' };

const FIELDS = ['Name', 'tenant_c', 'plan_c', 'billing_cycle_c', 'status_c', 'amount_c', 'currency_c', 'start_date_c', 'end_date_c', 'trial_days_c', 'notes_c'];

export default function SubscriptionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const { data: record, loading, error, run } = useFetch(async () => {
    const result = await sdk.table('subscriptions_c').select(FIELDS).get(id);
    return result.data ?? null;
  }, [id]);

  async function updateStatus(status) {
    setSaving(true);
    try {
      const result = await sdk.table('subscriptions_c').update({ Id: id, status_c: status });
      if (result.messages?.length) toast.error(result.messages[0]);
      if (!result.data?.length) return;
      toast.success(`Subscription marked ${status}`);
      run();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      const result = await sdk.table('subscriptions_c').remove([id]);
      if (result.messages?.length) toast.error(result.messages[0]);
      if (!result.data?.length) return;
      toast.success('Subscription record deleted');
      navigate('/subscriptions');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <DetailSkeleton />;
  if (error) return <div className="text-sm text-destructive">{error.message} <Button onClick={run} variant="outline">Retry</Button></div>;
  if (!record) return <div><Link to="/subscriptions">Back to Subscriptions</Link><p className="mt-5">Subscription not found.</p></div>;

  const details = [['Business', record.tenant_c?.Name], ['Plan', record.plan_c], ['Billing cycle', record.billing_cycle_c], ['Amount', `${record.currency_c} ${Number(record.amount_c ?? 0).toLocaleString('en-IN')}`], ['Start date', record.start_date_c], ['End date', record.end_date_c || 'Lifetime / no expiry'], ['Trial duration', `${record.trial_days_c ?? 0} days`], ['Internal notes', record.notes_c]];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/subscriptions" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground"><ApperIcon name="ArrowLeft" size={16} /> Back to Subscriptions</Link>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-extrabold uppercase tracking-widest text-primary">Subscription record</div><h1 className="brand-heading mt-1 text-3xl font-black">{record.Name}</h1><p className="mt-1 text-sm text-muted-foreground">{record.tenant_c?.Name}</p></div><Badge>{record.status_c}</Badge></div>
      <Card><CardHeader><CardTitle>Licence details</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2">{details.map(([label, value]) => <div key={label}><div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 text-sm font-semibold">{value || 'Not provided'}</div></div>)}</CardContent></Card>
      <Card><CardHeader><CardTitle>Access controls</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">
        {['Active', 'Past Due', 'Suspended', 'Expired', 'Cancelled'].filter(status => status !== record.status_c).map(status => <Button key={status} size="sm" variant="outline" disabled={saving} onClick={() => updateStatus(status)}>Mark {status}</Button>)}
      </CardContent></Card>
      <div className="flex justify-end"><AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" disabled={saving}><ApperIcon name="Trash2" size={16} className="mr-2" /> Delete subscription record</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {record.Name}?</AlertDialogTitle><AlertDialogDescription>Only delete an erroneous licence record. Expiry and suspension should retain the tenant and all business data.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove} disabled={saving}>Delete record</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
    </div>
  );
}