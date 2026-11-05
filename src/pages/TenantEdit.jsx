import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { sdk } from '@/services/sdk';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { DetailSkeleton } from '@/components/PageSkeleton';

export const route = { path: '/tenants/:id/edit', layout: 'owner', access: 'authenticated' };

const FIELDS = ['Name', 'business_type_c', 'status_c', 'modules_c', 'subscription_plan_c', 'email_c', 'phone_c', 'address_c', 'gstin_c'];
const moduleNames = ['PharmaSuite', 'LabSuite', 'DoctorSuite', 'PatientSuite', 'CareConnect', 'HealthAnalytics'];

export default function TenantEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const { data: tenant, loading } = useFetch(async () => {
    const result = await sdk.table('tenants_c').select(FIELDS).get(id);
    return result.data ?? null;
  }, [id]);
  const [form, setForm] = useState(null);

  if (loading) return <DetailSkeleton />;
  if (!tenant) return <div><Link to="/tenants">Back to Businesses</Link><p className="mt-4">Business not found.</p></div>;
  const values = form ?? { ...tenant, modules_c: tenant.modules_c ?? [] };
  const set = (key, value) => setForm(current => ({ ...(current ?? values), [key]: value }));

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await sdk.table('tenants_c').update({ Id: id, ...values });
      if (result.messages?.length) toast.error(result.messages[0]);
      if (!result.data?.length) return;
      toast.success('Business profile updated');
      navigate(`/tenants/${id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to={`/tenants/${id}`} className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground"><ApperIcon name="ArrowLeft" size={16} /> Back to Business</Link>
      <div><div className="text-xs font-extrabold uppercase tracking-widest text-primary">Tenant administration</div><h1 className="brand-heading mt-1 text-3xl font-black">Edit {tenant.Name}</h1></div>
      <form onSubmit={save} className="space-y-5">
        <Card><CardHeader><CardTitle>Organisation profile</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2"><Label>Organisation name</Label><Input value={values.Name} onChange={event => set('Name', event.target.value)} placeholder="Business name" required /></div>
          <div className="space-y-2"><Label>Business type</Label><Select value={values.business_type_c} onValueChange={value => set('business_type_c', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Pharmacy', 'Diagnostic Centre', 'Clinic', 'Doctor Practice', 'Hospital', 'Healthcare Group'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Tenant status</Label><Select value={values.status_c} onValueChange={value => set('status_c', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Trial', 'Active', 'Pending', 'Suspended', 'Expired'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Subscription plan</Label><Select value={values.subscription_plan_c} onValueChange={value => set('subscription_plan_c', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Starter', 'Professional', 'Enterprise', 'Lifetime', 'Custom'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>GSTIN</Label><Input value={values.gstin_c ?? ''} onChange={event => set('gstin_c', event.target.value.toUpperCase())} placeholder="GST identification number" /></div>
          <div className="space-y-2"><Label>Business email</Label><Input type="email" value={values.email_c ?? ''} onChange={event => set('email_c', event.target.value)} placeholder="owner@example.com" /></div>
          <div className="space-y-2"><Label>Phone</Label><Input value={values.phone_c ?? ''} onChange={event => set('phone_c', event.target.value)} placeholder="Business contact number" /></div>
          <div className="space-y-2 sm:col-span-2"><Label>Address</Label><Input value={values.address_c ?? ''} onChange={event => set('address_c', event.target.value)} placeholder="Registered address" /></div>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Enabled modules</CardTitle></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2">{moduleNames.map(module => <label key={module} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={values.modules_c.includes(module)} onChange={event => set('modules_c', event.target.checked ? [...values.modules_c, module] : values.modules_c.filter(item => item !== module))} />{module}</label>)}</CardContent></Card>
        <div className="flex justify-end gap-3"><Button asChild type="button" variant="outline"><Link to={`/tenants/${id}`}>Cancel</Link></Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button></div>
      </form>
    </div>
  );
}