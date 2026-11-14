import { useMemo, useState } from 'react';
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

export const route = { path: '/download', layout: 'public', access: 'public' };

const PRODUCTS = [
  { name: 'PharmaSuite', description: 'Pharmacy billing, stock, batches, purchasing and expiry control.', icon: 'Pill' },
  { name: 'LabSuite', description: 'Diagnostic bookings, sample tracking, results and report workflows.', icon: 'Microscope' },
  { name: 'DoctorSuite', description: 'Doctor profiles, appointments, consultations and prescriptions.', icon: 'Stethoscope' },
  { name: 'PatientSuite', description: 'Patient appointments, prescriptions, reports and care history.', icon: 'HeartPulse' },
  { name: 'CareConnect', description: 'Medicine delivery, home sample collection and field operations.', icon: 'Truck' },
  { name: 'HealthAnalytics', description: 'Business intelligence across pharmacy, lab, clinic and care services.', icon: 'ChartNoAxesCombined' },
  { name: 'HealthSuite 360', description: 'The connected platform with all six healthcare modules.', icon: 'Layers3' }
];

const RELEASE_FIELDS = [
  'Name', 'product_c', 'platform_c', 'version_c', 'build_number_c', 'package_type_c',
  'package_url_c', 'store_url_c', 'release_notes_c', 'minimum_os_c', 'release_status_c',
  'published_at_c', 'checksum_sha256_c', 'file_size_mb_c', 'is_mandatory_c',
  'is_latest_c', 'package_file_c'
];

const PLAN_FIELDS = [
  'Name', 'product_c', 'description_c', 'price_c', 'offer_price_c',
  'currency_c', 'billing_cycle_c', 'default_trial_days_c', 'is_active_c'
];

function filesOf(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function platformTitle(platform) {
  return ({ Android: 'Android · Google Play', iOS: 'iPhone & iPad · App Store', Windows: 'Windows desktop', macOS: 'Mac desktop', Web: 'Web application' })[platform] || platform;
}

export default function PublicDownload() {
  const [selected, setSelected] = useState('');
  const [form, setForm] = useState({ businessName: '', phone: '', email: '', businessType: 'Clinic', trialDays: '30' });
  const [submitted, setSubmitted] = useState(null);
  const [downloading, setDownloading] = useState('');
  const { data: releases, loading: releasesLoading, error: releasesError, run: reloadReleases } = useFetch(() => sdk.table('software_releases_c')
    .select(RELEASE_FIELDS)
    .where(window.ApperSDK.CoreSDK.eq('release_status_c', 'Published'))
    .orderByDesc('published_at_c')
    .limit(300)
    .fetch()
    .then(result => {
      if (!result.success) throw new Error(result.message || 'Unable to load published downloads');
      return result.data || [];
    }), []);
  const { data: plans, loading: plansLoading } = useFetch(() => sdk.table('plans_c')
    .select(PLAN_FIELDS)
    .where(window.ApperSDK.CoreSDK.eq('is_active_c', true))
    .orderBy('sort_order_c')
    .limit(100)
    .fetch()
    .then(result => {
      if (!result.success) throw new Error(result.message || 'Unable to load plans');
      return result.data || [];
    }), []);
  const { invoke, loading: submitting } = useFunction(import.meta.env.VITE_SUBMIT_LICENSE_REQUEST);
  const releaseRows = releases || [];
  const planRows = plans || [];
  const activePlan = planRows.find(plan => String(plan.Id) === String(selected));

  const grouped = useMemo(() => {
    const latest = releaseRows.filter(row => row.is_latest_c);
    const source = latest.length ? latest : releaseRows;
    return PRODUCTS.map(product => ({
      ...product,
      releases: source.filter(row => row.product_c === product.name)
    }));
  }, [releaseRows]);

  async function downloadRelease(release) {
    const key = release.Id;
    setDownloading(key);
    try {
      if (release.store_url_c) {
        window.open(release.store_url_c, '_blank', 'noopener,noreferrer');
        return;
      }
      if (release.package_url_c) {
        window.open(release.package_url_c, '_blank', 'noopener,noreferrer');
        return;
      }
      const file = filesOf(release.package_file_c)[0];
      if (file?.Id) {
        const result = await sdk.storage.download(file);
        const link = document.createElement('a');
        link.href = result.url;
        link.download = result.name || file.Name || release.Name || 'HealthSuite360-package';
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(result.url), 30000);
        return;
      }
      toast.error('No download target is configured for this release.');
    } catch (error) {
      toast.error(error.message || 'Package download failed. Please contact support.');
    } finally {
      setDownloading('');
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!selected) return toast.error('Choose a software plan first.');
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
    <div className="min-h-svh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary p-2 text-primary-foreground"><ApperIcon name="Stethoscope" size={23} /></div>
            <div><div className="brand-heading text-xl font-black">HealthSuite 360</div><div className="text-xs text-muted-foreground">Software downloads & updates</div></div>
          </div>
          <a href="#downloads" className="text-sm font-semibold text-primary hover:underline">Customer downloads</a>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-12 px-4 py-9 md:py-14">
        <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Badge className="mb-4">OFFICIAL CUSTOMER DOWNLOAD CENTRE</Badge>
            <h1 className="brand-heading max-w-3xl text-4xl font-black tracking-tight md:text-6xl">Your healthcare software. Always up to date.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">Download the latest HealthSuite applications, installers and updates for your device. Choose your product and platform to find the correct release, version and installation package.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild><a href="#downloads">Explore downloads <ApperIcon name="ArrowDown" size={16} className="ml-2" /></a></Button>
              <Button asChild variant="outline"><a href="#trial">Request a free trial</a></Button>
            </div>
            <div className="mt-6 flex flex-wrap gap-5 text-xs text-muted-foreground">
              <span className="flex items-center gap-2"><ApperIcon name="ShieldCheck" size={15} /> Official release catalogue</span>
              <span className="flex items-center gap-2"><ApperIcon name="RefreshCw" size={15} /> Version and update history</span>
              <span className="flex items-center gap-2"><ApperIcon name="MonitorSmartphone" size={15} /> Mobile and desktop</span>
            </div>
          </div>
          <div className="rounded-3xl bg-primary p-6 text-primary-foreground md:p-8">
            <div className="text-xs font-bold uppercase tracking-widest opacity-75">One connected platform</div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {PRODUCTS.slice(0, 6).map(product => (
                <div key={product.name} className="rounded-xl border border-primary-foreground/15 bg-primary-foreground/10 p-3">
                  <ApperIcon name={product.icon} size={21} />
                  <div className="mt-3 text-sm font-bold">{product.name}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 border-t border-primary-foreground/20 pt-4 text-sm opacity-80">Choose standalone modules or the connected suite according to your licence.</div>
          </div>
        </section>

        <section id="downloads" className="scroll-mt-6 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><div className="text-xs font-extrabold uppercase tracking-widest text-primary">Get the latest version</div><h2 className="brand-heading mt-1 text-3xl font-black">Customer downloads</h2><p className="mt-2 text-sm text-muted-foreground">Select a product, then download for Android, iOS, Windows or macOS.</p></div>
            <Button variant="outline" size="sm" onClick={reloadReleases}>Refresh releases</Button>
          </div>
          {releasesLoading ? <Card><CardContent className="p-8 text-sm text-muted-foreground">Loading published software packages…</CardContent></Card>
          : releasesError ? <Card><CardContent className="flex flex-wrap items-center justify-between gap-3 p-6 text-sm"><span className="text-destructive">{releasesError.message}</span><Button variant="outline" size="sm" onClick={reloadReleases}>Try again</Button></CardContent></Card>
          : <div className="space-y-4">
            {grouped.map(product => (
              <Card key={product.name} className="overflow-hidden">
                <div className="grid gap-4 p-5 md:grid-cols-[1fr_2fr] md:items-center">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-secondary p-3 text-primary"><ApperIcon name={product.icon} size={24} /></div>
                    <div><h3 className="brand-heading text-xl font-extrabold">{product.name}</h3><p className="mt-1 text-sm text-muted-foreground">{product.description}</p></div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {['Android', 'iOS', 'Windows', 'macOS'].map(platform => {
                      const release = product.releases.find(row => row.platform_c === platform);
                      const isMobile = platform === 'Android' || platform === 'iOS';
                      return (
                        <div key={platform} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                          <div className="min-w-0">
                            <div className="text-sm font-bold">{platformTitle(platform)}</div>
                            {release ? <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>v{release.version_c}</span>{release.is_mandatory_c && <Badge variant="destructive">Required update</Badge>}</div> : <div className="mt-1 text-xs text-muted-foreground">Not yet published</div>}
                          </div>
                          {release ? <Button size="sm" variant={isMobile ? 'default' : 'outline'} disabled={downloading === release.Id} onClick={() => downloadRelease(release)}>{downloading === release.Id ? 'Preparing…' : release.platform_c === 'Android' ? 'Google Play / Download' : release.platform_c === 'iOS' ? 'App Store' : 'Download'} <ApperIcon name="Download" size={14} className="ml-1" /></Button>
                          : <Badge variant="secondary">Coming soon</Badge>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {product.releases.length > 0 && (
                  <div className="border-t bg-muted/30 px-5 py-3 text-xs text-muted-foreground">
                    {product.releases.map(release => <div key={release.Id} className="flex flex-wrap items-center justify-between gap-2 py-1"><span>{release.platform_c} · v{release.version_c} · {release.package_type_c}</span><span>{release.minimum_os_c ? 'Requires ' + release.minimum_os_c : 'System requirements vary by device'}</span></div>)}
                  </div>
                )}
              </Card>
            ))}
          </div>}
          <p className="text-xs leading-5 text-muted-foreground">Only packages explicitly published by HealthSuite 360 are shown. App Store and Google Play links become available after the respective store listing is approved and published. Desktop installers are distributed only when a verified package has been released.</p>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          {[
            ['Download', 'Choose the right module and device platform. Check the version and minimum operating system before installing.', 'Download'],
            ['Install', 'Follow the installation instructions supplied with your package. Keep your activation details secure.', 'MonitorDown'],
            ['Activate', 'Sign in with your organisation account and activate the modules included in your subscription.', 'KeyRound']
          ].map(([title, description, icon], index) => <Card key={title}><CardContent className="p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary"><ApperIcon name={icon} size={20} /></div><div className="mt-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">0{index + 1}</div><h3 className="brand-heading mt-1 text-xl font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p></CardContent></Card>)}
        </section>

        <section id="trial" className="scroll-mt-6 grid gap-7 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-widest text-primary">Start with HealthSuite</div>
            <h2 className="brand-heading mt-2 text-3xl font-black">Request your software trial</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Choose an independent module or the complete suite. Our team will review your request and send the correct customer onboarding and activation instructions.</p>
            <div className="mt-5 space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><ApperIcon name="CheckCircle2" size={16} className="text-primary" /> Module-specific subscriptions</div>
              <div className="flex items-center gap-2"><ApperIcon name="CheckCircle2" size={16} className="text-primary" /> Trial and licence management</div>
              <div className="flex items-center gap-2"><ApperIcon name="CheckCircle2" size={16} className="text-primary" /> Assisted installation and onboarding</div>
            </div>
          </div>
          {submitted ? (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ApperIcon name="CheckCircle2" className="text-primary" /> Request received</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>{submitted.message}</p>
                <div className="rounded-lg bg-muted p-4"><div><b>Request:</b> {submitted.requestId}</div><div><b>Product:</b> {submitted.product} · {submitted.plan}</div><div><b>Trial:</b> {submitted.trialDays} days, {submitted.trialStart} to {submitted.trialEnd}</div><div><b>Subscription price after trial:</b> {submitted.currency} {Number(submitted.amount).toLocaleString('en-IN')}</div></div>
                <Button variant="outline" onClick={() => setSubmitted(null)}>Submit another request</Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader><CardTitle>Business registration</CardTitle><p className="text-sm text-muted-foreground">Fields marked * are required.</p></CardHeader>
              <CardContent>
                {plansLoading ? <p className="text-sm text-muted-foreground">Loading plans…</p> : (
                  <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2"><Label>Software plan *</Label><Select required value={selected} onValueChange={value => { setSelected(value); const plan = planRows.find(item => item.Id === value); setForm(current => ({ ...current, trialDays: String(plan?.default_trial_days_c || 30) })); }}><SelectTrigger><SelectValue placeholder="Choose a software plan" /></SelectTrigger><SelectContent>{planRows.map(plan => <SelectItem key={plan.Id} value={plan.Id}>{plan.Name} · {plan.product_c}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Business name *</Label><Input required value={form.businessName} onChange={event => setForm(current => ({ ...current, businessName: event.target.value }))} /></div>
                    <div className="space-y-2"><Label>Phone / WhatsApp *</Label><Input required value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} /></div>
                    <div className="space-y-2"><Label>Email *</Label><Input required type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} /></div>
                    <div className="space-y-2"><Label>Business type</Label><Select value={form.businessType} onValueChange={value => setForm(current => ({ ...current, businessType: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Pharmacy', 'Diagnostic Centre', 'Clinic', 'Doctor Practice', 'Hospital', 'Healthcare Group'].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Trial duration (days)</Label><Input type="number" min="1" max="180" value={form.trialDays} onChange={event => setForm(current => ({ ...current, trialDays: event.target.value }))} /></div>
                    <div className="flex items-end text-xs text-muted-foreground">{activePlan ? 'Default trial: ' + (activePlan.default_trial_days_c || 30) + ' days.' : 'Choose a plan to view trial terms.'}</div>
                    <div className="sm:col-span-2"><label className="flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" required className="mt-0.5" /><span>I agree that HealthSuite 360 may use these business contact details to process this software request and send onboarding information.</span></label></div>
                    <div className="sm:col-span-2"><Button type="submit" disabled={!selected || submitting}>{submitting ? 'Submitting…' : 'Request trial'} <ApperIcon name="ArrowRight" size={15} className="ml-2" /></Button></div>
                  </form>
                )}
              </CardContent>
            </Card>
          )}
        </section>

        <footer className="border-t pt-6 text-center text-xs text-muted-foreground">HealthSuite 360 · Official software distribution · Contact support for installation assistance and licence enquiries.</footer>
      </main>
    </div>
  );
}
