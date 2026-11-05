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

export const route = { path: '/tenants/:id', layout: 'owner', access: 'authenticated' };

const FIELDS = ['Name', 'business_type_c', 'status_c', 'modules_c', 'subscription_plan_c', 'email_c', 'phone_c', 'address_c', 'gstin_c'];

export default function TenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const { data: tenant, loading, error, run } = useFetch(async () => {
    const result = await sdk.table('tenants_c').select(FIELDS).get(id);
    if (!result.success) return null;
    return result.data;
  }, [id]);

  async function remove() {
    setDeleting(true);
    try {
      const result = await sdk.table('tenants_c').remove([id]);
      if (result.messages?.length) toast.error(result.messages[0]);
      if (!result.data?.length) return;
      toast.success('Business record deleted');
      navigate('/tenants');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <DetailSkeleton />;
  if (error) return <div className="text-sm text-destructive">{error.message} <Button onClick={run} variant="outline">Retry</Button></div>;
  if (!tenant) return <div><Link to="/tenants">Back to Businesses</Link><p className="mt-6">Business not found or you do not have access.</p></div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/tenants" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"><ApperIcon name="ArrowLeft" size={16} /> Back to Businesses</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><Badge className="mb-2">Business tenant</Badge><h1 className="brand-heading text-3xl font-black">{tenant.Name}</h1><p className="mt-1 text-sm text-muted-foreground">{tenant.business_type_c}</p></div>
        <Badge variant={tenant.status_c === 'Active' ? 'default' : 'secondary'}>{tenant.status_c}</Badge>
      </div>
      <Card><CardHeader><CardTitle>Organisation profile</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2">
        {[['Business email', tenant.email_c], ['Phone', tenant.phone_c], ['GSTIN', tenant.gstin_c], ['Address', tenant.address_c], ['Subscription plan', tenant.subscription_plan_c]].map(([label, value]) => <div key={label}><div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 text-sm font-semibold">{value || 'Not provided'}</div></div>)}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Licensed product modules</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{(tenant.modules_c ?? []).length ? tenant.modules_c.map(module => <Badge key={module} variant="secondary">{module}</Badge>) : <p className="text-sm text-muted-foreground">No modules assigned yet.</p>}</CardContent></Card>
      <div className="flex flex-wrap justify-end gap-3">
        <Button asChild variant="outline"><Link to={`/tenants/${id}/edit`}>Edit business</Link></Button>
        <Button asChild variant="outline"><Link to="/modules">Explore modules</Link></Button>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="destructive"><ApperIcon name="Trash2" size={16} className="mr-2" /> Delete record</Button></AlertDialogTrigger>
          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {tenant.Name}?</AlertDialogTitle><AlertDialogDescription>This removes this tenant record from the current workspace. Do not use deletion for subscription expiry; suspend access and retain customer data instead.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={deleting} onClick={remove}>{deleting ? 'Deleting…' : 'Delete business'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}