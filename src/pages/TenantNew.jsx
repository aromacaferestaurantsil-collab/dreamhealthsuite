import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

export const route = { path: '/tenants/new', layout: 'owner', access: 'authenticated' };

const availableModules = ['PharmaSuite', 'LabSuite', 'DoctorSuite', 'PatientSuite', 'CareConnect', 'HealthAnalytics'];

export default function TenantNew() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    Name: '',
    business_type_c: 'Pharmacy',
    email_c: '',
    phone_c: '',
    address_c: '',
    gstin_c: '',
    status_c: 'Trial',
    subscription_plan_c: 'Starter',
    modules_c: ['PharmaSuite']
  });
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const toggleModule = (module, checked) => set('modules_c', checked
    ? [...form.modules_c, module]
    : form.modules_c.filter(item => item !== module));

  async function save(event) {
    event.preventDefault();
    if (!form.Name.trim()) {
      toast.error('Enter the organisation name');
      return;
    }
    setSaving(true);
    try {
      const result = await sdk.table('tenants_c').create(form);
      if (result.messages?.length) toast.error(result.messages[0]);
      if (!result.data?.length) return;
      toast.success('Business tenant created');
      navigate(`/tenants/${result.data[0].Id}`);
    } catch (error) {
      toast.error(error.message ?? 'Unable to create business');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/tenants" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"><ApperIcon name="ArrowLeft" size={16} /> Back to Businesses</Link>
      <div>
        <div className="text-xs font-extrabold uppercase tracking-widest text-primary">Customer onboarding</div>
        <h1 className="brand-heading mt-1 text-3xl font-black">Register a business</h1>
        <p className="mt-1 text-sm text-muted-foreground">Create an organisation profile, then assign products and staff access.</p>
      </div>
      <form onSubmit={save} className="space-y-5">
        <Card>
          <CardHeader><CardTitle className="text-base">Organisation details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="tenant-name">Business / clinic name *</Label><Input id="tenant-name" value={form.Name} onChange={event => set('Name', event.target.value)} placeholder="e.g. City Care Diagnostics" required /></div>
            <div className="space-y-2"><Label>Business type</Label><Select value={form.business_type_c} onValueChange={value => set('business_type_c', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Pharmacy', 'Diagnostic Centre', 'Clinic', 'Doctor Practice', 'Hospital', 'Healthcare Group'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>GSTIN</Label><Input value={form.gstin_c} onChange={event => set('gstin_c', event.target.value.toUpperCase())} placeholder="15-character GSTIN" maxLength={15} /></div>
            <div className="space-y-2"><Label htmlFor="tenant-email">Business email</Label><Input id="tenant-email" type="email" value={form.email_c} onChange={event => set('email_c', event.target.value)} placeholder="owner@example.com" /></div>
            <div className="space-y-2"><Label htmlFor="tenant-phone">Phone number</Label><Input id="tenant-phone" value={form.phone_c} onChange={event => set('phone_c', event.target.value)} placeholder="+91 00000 00000" /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="tenant-address">Registered address</Label><Input id="tenant-address" value={form.address_c} onChange={event => set('address_c', event.target.value)} placeholder="Street, city, state, PIN code" /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Initial product access</CardTitle><p className="text-sm text-muted-foreground">Modules are licensed independently. You can add more later.</p></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {availableModules.map(module => (
              <label key={module} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-accent">
                <Checkbox checked={form.modules_c.includes(module)} onCheckedChange={checked => toggleModule(module, checked)} />
                <span className="text-sm font-bold">{module}</span>
              </label>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Subscription setup</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Initial status</Label><Select value={form.status_c} onValueChange={value => set('status_c', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Trial">Trial</SelectItem><SelectItem value="Active">Active</SelectItem><SelectItem value="Pending">Pending activation</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Plan</Label><Select value={form.subscription_plan_c} onValueChange={value => set('subscription_plan_c', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Starter">Starter</SelectItem><SelectItem value="Professional">Professional</SelectItem><SelectItem value="Enterprise">Enterprise</SelectItem><SelectItem value="Lifetime">Lifetime licence</SelectItem><SelectItem value="Custom">Custom</SelectItem></SelectContent></Select></div>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-3">
          <Button asChild type="button" variant="outline"><Link to="/tenants">Cancel</Link></Button>
          <Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create business'} <ApperIcon name="ArrowRight" size={16} className="ml-2" /></Button>
        </div>
      </form>
    </div>
  );
}