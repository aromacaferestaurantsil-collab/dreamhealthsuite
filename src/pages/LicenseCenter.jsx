import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useFunction } from '@/hooks/useFunction';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export const route = { path: '/licensing', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'KeyRound', label: 'Licensing centre', order: 5, profiles: ['Admin_c'] };

const PRODUCTS = ['PharmaSuite', 'LabSuite', 'DoctorSuite', 'PatientSuite', 'CareConnect', 'HealthAnalytics', 'HealthSuite 360'];
const PLAN_FIELDS = ['Name', 'product_c', 'description_c', 'price_c', 'offer_price_c', 'currency_c', 'billing_cycle_c', 'default_trial_days_c', 'is_active_c', 'download_url_c', 'sort_order_c'];
const REQUEST_FIELDS = ['Name', 'business_name_c', 'phone_c', 'email_c', 'business_type_c', 'plan_c', 'source_c', 'status_c', 'trial_days_c', 'trial_start_c', 'trial_end_c', 'standard_price_c', 'offer_price_c', 'amount_c', 'currency_c', 'billing_cycle_c', 'notes_c'];
const DEVICE_FIELDS = ['Name', 'license_key_c', 'installation_id_c', 'device_label_c', 'platform_c', 'activated_on_c', 'last_seen_c', 'status_c'];

function dateAfter(days) {
  const date = new Date();
  date.setDate(date.getDate() + Number(days || 30));
  return date.toISOString().slice(0, 10);
}

export default function LicenseCenter() {
  const [tab, setTab] = useState('requests');
  const [saving, setSaving] = useState(false);
  const [manual, setManual] = useState({ business_name_c: '', phone_c: '', email_c: '', business_type_c: 'Clinic', plan_c: '', trial_days_c: '30' });
  const [planForm, setPlanForm] = useState({ Name: '', product_c: 'PharmaSuite', description_c: '', price_c: '', offer_price_c: '', currency_c: 'INR', billing_cycle_c: 'Monthly', default_trial_days_c: '30', is_active_c: true, download_url_c: '', sort_order_c: '1' });
  const [issued, setIssued] = useState(null);
  const [maxDevices, setMaxDevices] = useState('1');
  const [edits, setEdits] = useState({});
  const { data: plans, loading: plansLoading, run: reloadPlans } = useFetch(() => sdk.table('plans_c').select(PLAN_FIELDS).orderBy('sort_order_c').limit(100).fetch().then(r => {
    if (!r.success) throw new Error(r.message);
    return r.data;
  }), []);
  const { data: requests, loading: requestsLoading, run: reloadRequests } = useFetch(() => sdk.table('license_requests_c').select(REQUEST_FIELDS).orderByDesc('CreatedOn').limit(100).fetch().then(r => {
    if (!r.success) throw new Error(r.message);
    return r.data;
  }), []);
  const { data: devices } = useFetch(() => sdk.table('device_activations_c').select(DEVICE_FIELDS).orderByDesc('CreatedOn').limit(100).fetch().then(r => r.data ?? []), []);
  const { invoke: issueKey, loading: issuing } = useFunction(import.meta.env.VITE_ISSUE_LICENSE_KEY);
  const planRows = plans ?? [];
  const requestRows = requests ?? [];
  const published = planRows.filter(plan => plan.is_active_c);
  const pending = requestRows.filter(request => ['New', 'Reviewed', 'Approved'].includes(request.status_c)).length;

  const shareLinks = useMemo(() => {
    if (!issued) return null;
    const plan = planRows.find(item => String(item.Id) === String(issued.planId));
    const download = plan?.download_url_c || 'Download link will be shared by the HealthSuite 360 team.';
    const message = 'HealthSuite 360 download and activation details for ' + issued.businessName + '\nDownload: ' + download + '\nOne-time activation key: ' + issued.licenseKey + '\nKey expires: ' + new Date(issued.expiresOn).toLocaleString();
    const phone = String(issued.phone || '').replace(/\D/g, '');
    return {
      whatsapp: phone ? 'https://wa.me/' + phone + '?text=' + encodeURIComponent(message) : '',
      email: 'mailto:' + encodeURIComponent(issued.email || '') + '?subject=' + encodeURIComponent('Your HealthSuite 360 software access') + '&body=' + encodeURIComponent(message)
    };
  }, [issued, planRows]);

  async function createPlan(event) {
    event.preventDefault();
    if (!planForm.Name.trim() || !planForm.price_c || !planForm.download_url_c.trim()) {
      toast.error('Enter plan name, standard price and a real download URL.');
      return;
    }
    setSaving(true);
    try {
      const result = await sdk.table('plans_c').create({
        ...planForm,
        price_c: Number(planForm.price_c),
        offer_price_c: Number(planForm.offer_price_c || 0),
        default_trial_days_c: Number(planForm.default_trial_days_c || 30),
        sort_order_c: Number(planForm.sort_order_c || 1)
      });
      if (result.messages?.length) toast.error(result.messages[0]);
      if (!result.data?.length) return;
      toast.success('Plan published to the online catalogue');
      setPlanForm({ Name: '', product_c: 'PharmaSuite', description_c: '', price_c: '', offer_price_c: '', currency_c: 'INR', billing_cycle_c: 'Monthly', default_trial_days_c: '30', is_active_c: true, download_url_c: '', sort_order_c: '1' });
      reloadPlans();
    } catch (error) {
      toast.error(error.message || 'Unable to create plan');
    } finally {
      setSaving(false);
    }
  }

  async function createManualRequest(event) {
    event.preventDefault();
    if (!manual.business_name_c.trim() || !manual.phone_c.trim() || !manual.email_c.trim() || !manual.plan_c) {
      toast.error('Business name, phone, email and plan are required.');
      return;
    }
    const plan = planRows.find(item => String(item.Id) === String(manual.plan_c));
    if (!plan) return toast.error('Choose a published plan.');
    const days = Math.max(1, Math.min(180, Number(manual.trial_days_c || plan.default_trial_days_c || 30)));
    const start = new Date().toISOString().slice(0, 10);
    const amount = Number(plan.offer_price_c) > 0 && Number(plan.offer_price_c) < Number(plan.price_c) ? Number(plan.offer_price_c) : Number(plan.price_c || 0);
    setSaving(true);
    try {
      const result = await sdk.table('license_requests_c').create({
        Name: 'REQ-' + Date.now(),
        ...manual,
        plan_c: plan.Id,
        source_c: 'Manual',
        status_c: 'Reviewed',
        trial_days_c: days,
        trial_start_c: start,
        trial_end_c: dateAfter(days),
        standard_price_c: Number(plan.price_c || 0),
        offer_price_c: Number(plan.offer_price_c || 0),
        amount_c: amount,
        currency_c: plan.currency_c || 'INR',
        billing_cycle_c: plan.billing_cycle_c || 'Monthly'
      });
      if (result.messages?.length) toast.error(result.messages[0]);
      if (!result.data?.length) return;
      toast.success('Manual business request added');
      setManual({ business_name_c: '', phone_c: '', email_c: '', business_type_c: 'Clinic', plan_c: '', trial_days_c: '30' });
      reloadRequests();
      setTab('requests');
    } catch (error) {
      toast.error(error.message || 'Unable to add customer');
    } finally {
      setSaving(false);
    }
  }

  async function saveRequest(request) {
    const edit = edits[request.Id] || {};
    const days = Math.max(1, Math.min(180, Number(edit.trial_days_c ?? request.trial_days_c ?? 30)));
    const amount = Math.max(0, Number(edit.amount_c ?? request.amount_c ?? 0));
    const start = request.trial_start_c || new Date().toISOString().slice(0, 10);
    const end = new Date(start + 'T00:00:00');
    end.setDate(end.getDate() + days);
    const result = await sdk.table('license_requests_c').update({
      Id: request.Id,
      trial_days_c: days,
      trial_start_c: start,
      trial_end_c: end.toISOString().slice(0, 10),
      amount_c: amount,
      status_c: edit.status_c || request.status_c
    });
    if (!result.data?.length) return toast.error(result.messages?.[0] || 'Could not save request');
    toast.success('Trial and subscription amount updated');
    reloadRequests();
  }

  async function generateKey(request) {
    const response = await issueKey({ requestId: request.Id, maxDevices: Number(maxDevices) });
    if (!response?.success) return;
    setIssued({
      licenseKey: response.licenseKey,
      expiresOn: response.expiresOn,
      businessName: request.business_name_c,
      phone: request.phone_c,
      email: request.email_c,
      planId: request.plan_c?.Id
    });
    reloadRequests();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-widest text-primary">Super Admin · Commercial operations</div>
          <h1 className="brand-heading mt-1 text-3xl font-black">Licensing centre</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Publish software plans, collect online applications, add offline customers, configure trials and issue single-use activation keys.</p>
        </div>
        <Button asChild variant="outline"><Link to="/download">View customer download page <ApperIcon name="ExternalLink" size={15} className="ml-2" /></Link></Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-5"><div className="text-xs font-bold uppercase text-muted-foreground">Published plans</div><div className="brand-heading mt-2 text-3xl font-black">{published.length}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs font-bold uppercase text-muted-foreground">Pending applications</div><div className="brand-heading mt-2 text-3xl font-black">{pending}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs font-bold uppercase text-muted-foreground">Registered devices</div><div className="brand-heading mt-2 text-3xl font-black">{(devices ?? []).length}</div></CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ['requests', 'Customer requests'],
          ['manual', 'Manual customer entry'],
          ['plans', 'Plans and pricing'],
          ['devices', 'Device register']
        ].map(([key, label]) => <Button key={key} size="sm" variant={tab === key ? 'default' : 'outline'} onClick={() => setTab(key)}>{label}</Button>)}
      </div>

      {tab === 'requests' && (
        <Card>
          <CardHeader><CardTitle>Online and manual customer applications</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {requestsLoading ? <p className="text-sm text-muted-foreground">Loading customer requests…</p> : requestRows.length ? requestRows.map(request => {
              const edit = edits[request.Id] || {};
              return (
                <div key={request.Id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-bold">{request.business_name_c}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{request.phone_c} · {request.email_c} · {request.source_c} · {request.plan_c?.Name || 'Plan'}</div>
                      <div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline">{request.status_c}</Badge><Badge variant="secondary">{request.billing_cycle_c || 'Monthly'}</Badge></div>
                    </div>
                    <div className="text-right text-sm font-bold">{request.currency_c || 'INR'} {Number(request.amount_c || 0).toLocaleString('en-IN')}</div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <div className="space-y-1"><Label>Trial days</Label><Input type="number" min="1" max="180" value={edit.trial_days_c ?? request.trial_days_c ?? 30} onChange={event => setEdits(current => ({ ...current, [request.Id]: { ...current[request.Id], trial_days_c: event.target.value } }))} /></div>
                    <div className="space-y-1"><Label>Agreed amount</Label><Input type="number" min="0" step="0.01" value={edit.amount_c ?? request.amount_c ?? 0} onChange={event => setEdits(current => ({ ...current, [request.Id]: { ...current[request.Id], amount_c: event.target.value } }))} /></div>
                    <div className="space-y-1"><Label>Request status</Label><Select value={edit.status_c || request.status_c || 'New'} onValueChange={value => setEdits(current => ({ ...current, [request.Id]: { ...current[request.Id], status_c: value } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['New', 'Reviewed', 'Approved', 'Rejected'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
                    <div className="flex items-end"><Button className="w-full" variant="outline" onClick={() => saveRequest(request)}>Save terms</Button></div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Trial: {request.trial_start_c || '—'} → {request.trial_end_c || '—'}</span>
                    <span>·</span><span>Standard: {request.currency_c || 'INR'} {Number(request.standard_price_c || 0).toLocaleString('en-IN')}</span>
                    <span>·</span><span>Offer: {Number(request.offer_price_c || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <div className="flex items-center gap-2"><Label className="whitespace-nowrap">Device limit</Label><Input className="w-20" type="number" min="1" max="10" value={maxDevices} onChange={event => setMaxDevices(event.target.value)} /></div>
                    <Button size="sm" disabled={issuing || request.status_c === 'Rejected'} onClick={() => generateKey(request)}>{issuing ? 'Generating…' : 'Generate one-time key'}</Button>
                  </div>
                </div>
              );
            }) : <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No applications yet. Publish a plan and share the customer download page.</div>}
          </CardContent>
        </Card>
      )}

      {tab === 'manual' && (
        <Card>
          <CardHeader><CardTitle>Manually register a customer business</CardTitle><p className="text-sm text-muted-foreground">Required: business name, phone number, email address and selected plan. A default 30-day trial is applied and can be edited.</p></CardHeader>
          <CardContent>
            <form onSubmit={createManualRequest} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Business name *</Label><Input required value={manual.business_name_c} onChange={event => setManual(current => ({ ...current, business_name_c: event.target.value }))} /></div>
              <div className="space-y-2"><Label>Phone number *</Label><Input required value={manual.phone_c} onChange={event => setManual(current => ({ ...current, phone_c: event.target.value }))} /></div>
              <div className="space-y-2"><Label>Email address *</Label><Input required type="email" value={manual.email_c} onChange={event => setManual(current => ({ ...current, email_c: event.target.value }))} /></div>
              <div className="space-y-2"><Label>Business type</Label><Select value={manual.business_type_c} onValueChange={value => setManual(current => ({ ...current, business_type_c: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Pharmacy', 'Diagnostic Centre', 'Clinic', 'Doctor Practice', 'Hospital', 'Healthcare Group'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Software plan *</Label><Select value={manual.plan_c} onValueChange={value => setManual(current => ({ ...current, plan_c: value }))}><SelectTrigger><SelectValue placeholder="Choose a published plan" /></SelectTrigger><SelectContent>{published.map(plan => <SelectItem key={plan.Id} value={plan.Id}>{plan.Name} · {plan.currency_c} {plan.offer_price_c > 0 && plan.offer_price_c < plan.price_c ? plan.offer_price_c : plan.price_c}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Trial duration (days)</Label><Input type="number" min="1" max="180" value={manual.trial_days_c} onChange={event => setManual(current => ({ ...current, trial_days_c: event.target.value }))} /></div>
              <div className="md:col-span-2"><Button disabled={saving || !published.length}>{saving ? 'Saving…' : 'Register customer request'} <ApperIcon name="ArrowRight" size={15} className="ml-2" /></Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      {tab === 'plans' && (
        <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
          <Card>
            <CardHeader><CardTitle>Publish a software plan</CardTitle><p className="text-sm text-muted-foreground">The online catalogue uses the offer price when it is lower than the standard price.</p></CardHeader>
            <CardContent>
              <form onSubmit={createPlan} className="space-y-3">
                <div className="space-y-1"><Label>Plan name *</Label><Input required value={planForm.Name} onChange={event => setPlanForm(current => ({ ...current, Name: event.target.value }))} placeholder="PharmaSuite Professional" /></div>
                <div className="space-y-1"><Label>Product</Label><Select value={planForm.product_c} onValueChange={value => setPlanForm(current => ({ ...current, product_c: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRODUCTS.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label>Description</Label><Input value={planForm.description_c} onChange={event => setPlanForm(current => ({ ...current, description_c: event.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Standard price *</Label><Input required type="number" min="0" step="0.01" value={planForm.price_c} onChange={event => setPlanForm(current => ({ ...current, price_c: event.target.value }))} /></div>
                  <div className="space-y-1"><Label>Offer price</Label><Input type="number" min="0" step="0.01" value={planForm.offer_price_c} onChange={event => setPlanForm(current => ({ ...current, offer_price_c: event.target.value }))} /></div>
                  <div className="space-y-1"><Label>Currency</Label><Select value={planForm.currency_c} onValueChange={value => setPlanForm(current => ({ ...current, currency_c: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="INR">INR</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent></Select></div>
                  <div className="space-y-1"><Label>Billing cycle</Label><Select value={planForm.billing_cycle_c} onValueChange={value => setPlanForm(current => ({ ...current, billing_cycle_c: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Monthly', 'Quarterly', 'Annual', 'Lifetime'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1"><Label>Default trial days</Label><Input type="number" min="1" max="180" value={planForm.default_trial_days_c} onChange={event => setPlanForm(current => ({ ...current, default_trial_days_c: event.target.value }))} /></div>
                  <div className="space-y-1"><Label>Display order</Label><Input type="number" min="1" value={planForm.sort_order_c} onChange={event => setPlanForm(current => ({ ...current, sort_order_c: event.target.value }))} /></div>
                </div>
                <div className="space-y-1"><Label>Actual software download URL *</Label><Input required type="url" value={planForm.download_url_c} onChange={event => setPlanForm(current => ({ ...current, download_url_c: event.target.value }))} placeholder="https://your-domain.com/downloads/installer" /></div>
                <Button type="submit" disabled={saving}>{saving ? 'Publishing…' : 'Publish plan'}</Button>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Published catalogue</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {plansLoading ? <p className="text-sm text-muted-foreground">Loading plans…</p> : planRows.length ? planRows.map(plan => <div key={plan.Id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div><div className="font-bold">{plan.Name}</div><div className="text-xs text-muted-foreground">{plan.product_c} · {plan.billing_cycle_c} · {plan.default_trial_days_c || 30} day trial</div><div className="mt-1 text-sm"><span className="text-muted-foreground line-through">{plan.currency_c} {Number(plan.price_c || 0).toLocaleString('en-IN')}</span> <b>{plan.currency_c} {Number(plan.offer_price_c > 0 && plan.offer_price_c < plan.price_c ? plan.offer_price_c : plan.price_c || 0).toLocaleString('en-IN')}</b></div></div>
                <Badge variant={plan.is_active_c ? 'default' : 'secondary'}>{plan.is_active_c ? 'Published' : 'Hidden'}</Badge>
              </div>) : <p className="text-sm text-muted-foreground">No plans published yet.</p>}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'devices' && (
        <Card><CardHeader><CardTitle>Registered device installations</CardTitle><p className="text-sm text-muted-foreground">The licensing client should register a generated installation ID and platform details. Browsers do not expose a reliable MAC address.</p></CardHeader><CardContent className="space-y-3">
          {(devices ?? []).length ? devices.map(device => <div key={device.Id} className="flex flex-wrap justify-between gap-2 rounded-lg border p-3 text-sm"><div><b>{device.device_label_c || device.Name}</b><div className="text-xs text-muted-foreground">{device.platform_c} · {device.installation_id_c}</div></div><Badge variant={device.status_c === 'Active' ? 'default' : 'secondary'}>{device.status_c}</Badge></div>) : <p className="text-sm text-muted-foreground">No device activations recorded yet. Activation client integration is the next technical step.</p>}
        </CardContent></Card>
      )}

      {issued && shareLinks && (
        <Card className="border-primary/30">
          <CardHeader><CardTitle className="flex items-center gap-2"><ApperIcon name="KeyRound" size={19} /> One-time activation key generated</CardTitle><p className="text-sm text-muted-foreground">This is the only display of the raw key. Copy it and deliver it to the customer securely.</p></CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-muted p-4 font-mono text-lg font-bold tracking-wider">{issued.licenseKey}</div>
            <div className="text-xs text-muted-foreground">Expires: {new Date(issued.expiresOn).toLocaleString()} · {maxDevices} permitted device(s)</div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigator.clipboard.writeText(issued.licenseKey)} variant="outline"><ApperIcon name="Copy" size={15} className="mr-2" /> Copy key</Button>
              {shareLinks.whatsapp && <Button asChild><a href={shareLinks.whatsapp} target="_blank" rel="noreferrer"><ApperIcon name="MessageCircle" size={15} className="mr-2" /> WhatsApp customer</a></Button>}
              <Button asChild variant="outline"><a href={shareLinks.email}><ApperIcon name="Mail" size={15} className="mr-2" /> Email customer</a></Button>
            </div>
          </CardContent>
        </Card>
      )}
      <p className="text-xs leading-5 text-muted-foreground">Device protection uses an installation identifier and a server-side activation limit, not a browser MAC address. A true device lock requires the downloadable desktop/mobile application to call a server-side redemption endpoint; this register alone does not enforce device locking.</p>
    </div>
  );
}
