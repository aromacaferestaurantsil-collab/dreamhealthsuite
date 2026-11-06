import { useState } from 'react';
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

export const route = { path: '/download', layout: 'public', access: 'public' };

const FIELDS = ['Name', 'product_c', 'description_c', 'price_c', 'offer_price_c', 'currency_c', 'billing_cycle_c', 'default_trial_days_c', 'is_active_c'];

export default function PublicDownload() {
  const [selected, setSelected] = useState('');
  const [form, setForm] = useState({ businessName: '', phone: '', email: '', businessType: 'Clinic', trialDays: '30' });
  const [submitted, setSubmitted] = useState(null);
  const { data: plans, loading, error } = useFetch(() => sdk.table('plans_c').select(FIELDS).where(window.ApperSDK.CoreSDK.eq('is_active_c', true)).orderBy('sort_order_c').limit(100).fetch().then(result => {
    if (!result.success) throw new Error(result.message);
    return result.data;
  }), []);
  const { invoke, loading: submitting } = useFunction(import.meta.env.VITE_SUBMIT_LICENSE_REQUEST);
  const rows = plans ?? [];
  const activePlan = rows.find(plan => String(plan.Id) === String(selected));

  async function submit(event) {
    event.preventDefault();
    const result = await invoke({
      businessName: form.businessName,
      phone: form.phone,
      email: form.email,
      businessType: form.businessType,
      planId: selected,
      trialDays: Number(form.trialDays || activePlan?.default_trial_days_c || 30)
    });
    if (result?.success) setSubmitted(result);
  }

  return (
    <div className="min-h-svh px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 text-center">
          <Badge className="mb-3">HEALTHSUITE 360 SOFTWARE</Badge>
          <h1 className="brand-heading text-4xl font-black md:text-5xl">Choose your healthcare software</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Select an independent product or connected suite. Submit your business details to start the default 30-day trial. The team will review your request and send your download and one-time activation key.</p>
        </div>

        {loading ? <p className="text-center text-sm text-muted-foreground">Loading available plans…</p> : error ? <p className="text-center text-sm text-destructive">{error.message}</p> : rows.length ? (
          <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map(plan => {
              const offer = Number(plan.offer_price_c) > 0 && Number(plan.offer_price_c) < Number(plan.price_c);
              return <button key={plan.Id} type="button" onClick={() => { setSelected(plan.Id); setForm(current => ({ ...current, trialDays: String(plan.default_trial_days_c || 30) })); }} className={'rounded-xl border p-5 text-left transition ' + (selected === plan.Id ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border hover:border-primary/50')}>
                <div className="flex items-start justify-between gap-2"><div><div className="text-xs font-bold uppercase text-primary">{plan.product_c}</div><div className="brand-heading mt-1 text-xl font-black">{plan.Name}</div></div>{selected === plan.Id && <ApperIcon name="CheckCircle2" className="text-primary" size={20} />}</div>
                <p className="mt-2 min-h-10 text-sm text-muted-foreground">{plan.description_c || 'Healthcare operations software plan.'}</p>
                <div className="mt-4 flex items-baseline gap-2">{offer && <span className="text-sm text-muted-foreground line-through">{plan.currency_c} {Number(plan.price_c).toLocaleString('en-IN')}</span>}<span className="brand-heading text-2xl font-black">{plan.currency_c} {Number(offer ? plan.offer_price_c : plan.price_c || 0).toLocaleString('en-IN')}</span><span className="text-xs text-muted-foreground">/ {plan.billing_cycle_c}</span></div>
                {offer && <Badge className="mt-2">Offer price</Badge>}
                <div className="mt-3 text-xs text-muted-foreground">{plan.default_trial_days_c || 30} day free trial by default</div>
              </button>;
            })}
          </div>
        ) : <Card className="mb-8"><CardContent className="p-8 text-center text-sm text-muted-foreground">No downloadable plans are published yet. Please check back soon.</CardContent></Card>}

        {submitted ? (
          <Card className="mx-auto max-w-2xl border-primary/30">
            <CardHeader><CardTitle className="flex items-center gap-2"><ApperIcon name="CheckCircle2" className="text-primary" /> Request received</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>{submitted.message}</p>
              <div className="rounded-lg bg-muted p-4"><div><b>Request:</b> {submitted.requestId}</div><div><b>Product:</b> {submitted.product} · {submitted.plan}</div><div><b>Trial:</b> {submitted.trialDays} days, {submitted.trialStart} to {submitted.trialEnd}</div><div><b>Subscription price after trial:</b> {submitted.currency} {Number(submitted.amount).toLocaleString('en-IN')}</div></div>
              <p className="text-muted-foreground">Your software download and one-time activation details will be shared after the request is reviewed. Please keep your phone and email accessible.</p>
              <Button variant="outline" onClick={() => { setSubmitted(null); setSelected(''); setForm({ businessName: '', phone: '', email: '', businessType: 'Clinic', trialDays: '30' }); }}>Submit another business</Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="mx-auto max-w-3xl">
            <CardHeader><CardTitle>Business registration and trial activation</CardTitle><p className="text-sm text-muted-foreground">A plan must be selected before submitting. Trial dates are calculated automatically when the form is submitted.</p></CardHeader>
            <CardContent>
              <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2"><Label>Selected plan *</Label><Select required value={selected} onValueChange={value => { setSelected(value); const plan = rows.find(item => item.Id === value); setForm(current => ({ ...current, trialDays: String(plan?.default_trial_days_c || 30) })); }}><SelectTrigger><SelectValue placeholder="Choose a software plan" /></SelectTrigger><SelectContent>{rows.map(plan => <SelectItem key={plan.Id} value={plan.Id}>{plan.Name} · {plan.product_c}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Business / organisation name *</Label><Input required value={form.businessName} onChange={event => setForm(current => ({ ...current, businessName: event.target.value }))} placeholder="Your business name" /></div>
                <div className="space-y-2"><Label>Phone / WhatsApp number *</Label><Input required value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} placeholder="+91…" /></div>
                <div className="space-y-2"><Label>Email address *</Label><Input required type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} placeholder="you@business.com" /></div>
                <div className="space-y-2"><Label>Business type</Label><Select value={form.businessType} onValueChange={value => setForm(current => ({ ...current, businessType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Pharmacy', 'Diagnostic Centre', 'Clinic', 'Doctor Practice', 'Hospital', 'Healthcare Group'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Trial duration (days)</Label><Input type="number" min="1" max="180" value={form.trialDays} onChange={event => setForm(current => ({ ...current, trialDays: event.target.value }))} /></div>
                <div className="flex items-end"><p className="text-xs text-muted-foreground">{activePlan ? 'Default trial: ' + (activePlan.default_trial_days_c || 30) + ' days. You can request a different duration.' : 'Default trial: 30 days.'}</p></div>
                <div className="space-y-2 md:col-span-2"><label className="flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" required className="mt-0.5" /><span>I agree that HealthSuite 360 may use these business contact details to process this software request and send account/download instructions.</span></label></div>
                <div className="md:col-span-2"><Button type="submit" disabled={!selected || submitting}>{submitting ? 'Submitting…' : 'Submit and start trial'} <ApperIcon name="ArrowRight" size={15} className="ml-2" /></Button></div>
              </form>
            </CardContent>
          </Card>
        )}
        <div className="mt-8 text-center text-xs text-muted-foreground">HealthSuite 360 · Secure software licensing · Your trial begins when your request is successfully submitted.</div>
      </div>
    </div>
  );
}
