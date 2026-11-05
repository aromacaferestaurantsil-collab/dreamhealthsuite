import { Link } from 'react-router-dom';
import { useFetch } from '@/hooks/useFetch';
import { sdk } from '@/services/sdk';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatsSkeleton } from '@/components/PageSkeleton';

export const route = {
  path: '/',
  layout: 'owner',
  access: 'authenticated'
};

export const nav = {
  icon: 'LayoutDashboard',
  label: 'Overview',
  order: 1,
  profiles: null
};

const modules = [
  {
    key: 'pharmacy',
    name: 'PharmaSuite',
    category: 'Pharmacy management',
    description: 'POS, medicine catalogue, batch inventory, purchasing, expiry and GST operations.',
    icon: 'Pill',
    path: '/pharmacy',
    accent: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-200',
    stage: 'Build 02'
  },
  {
    key: 'laboratory',
    name: 'LabSuite',
    category: 'Diagnostic centres',
    description: 'Test booking, barcode samples, collection workflows, verification and digital reports.',
    icon: 'Microscope',
    path: '/laboratory',
    accent: 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-200',
    stage: 'Build 03'
  },
  {
    key: 'doctor',
    name: 'DoctorSuite',
    category: 'Doctors and clinics',
    description: 'Appointments, clinic schedules, patient history, prescriptions and follow-ups.',
    icon: 'Stethoscope',
    path: '/doctors',
    accent: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-200',
    stage: 'Build 04'
  },
  {
    key: 'patient',
    name: 'PatientSuite',
    category: 'Patient CRM',
    description: 'Unified patient profiles, appointments, prescriptions, reports, consent and loyalty.',
    icon: 'HeartPulse',
    path: '/patients',
    accent: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200',
    stage: 'Build 05'
  },
  {
    key: 'care',
    name: 'CareConnect',
    category: 'Delivery and collection',
    description: 'Medicine delivery, home sample collection, field staff assignments and job tracking.',
    icon: 'Truck',
    path: '/care-connect',
    accent: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    stage: 'Build 06'
  },
  {
    key: 'analytics',
    name: 'HealthAnalytics',
    category: 'Business intelligence',
    description: 'Cross-module dashboards for revenue, operations, stock, turnaround and growth.',
    icon: 'ChartNoAxesCombined',
    path: '/analytics',
    accent: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200',
    stage: 'Build 07'
  }
];

const FIELDS = ['Name', 'business_type_c', 'status_c', 'modules_c', 'subscription_plan_c'];

export default function Home() {
  const { data: tenants, loading, error, run } = useFetch(() => (
    sdk.table('tenants_c')
      .select(FIELDS)
      .orderByDesc('CreatedOn')
      .limit(6)
      .fetch()
      .then(result => {
        if (!result.success) throw new Error(result.message);
        return result.data;
      })
  ), []);

  const tenantRows = tenants ?? [];
  const activeCount = tenantRows.filter(item => item.status_c === 'Active').length;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="relative overflow-hidden rounded-2xl bg-primary px-6 py-8 text-primary-foreground md:px-9 md:py-10">
        <div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border-[36px] border-primary-foreground/10" />
        <div className="absolute -bottom-28 right-40 h-64 w-64 rounded-full border-[24px] border-primary-foreground/10" />
        <div className="relative max-w-3xl">
          <Badge className="mb-4 border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/10">
            MASTER HEALTHCARE PLATFORM
          </Badge>
          <h1 className="brand-heading text-3xl font-black tracking-tight md:text-5xl">
            One platform. Every healthcare workflow.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-primary-foreground/85 md:text-base">
            Manage independent pharmacy, diagnostic, doctor, patient and care-delivery products from one secure, connected workspace.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="bg-card text-card-foreground hover:bg-card/90">
              <Link to="/tenants/new">Onboard a business <ApperIcon name="ArrowUpRight" size={16} className="ml-2" /></Link>
            </Button>
            <Button asChild variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
              <Link to="/modules">Explore product modules</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Product modules', value: '06', note: 'Independent products', icon: 'Blocks' },
          { label: 'Business tenants', value: loading ? '—' : String(tenantRows.length), note: 'Latest registered businesses', icon: 'Building2' },
          { label: 'Active in this view', value: loading ? '—' : String(activeCount), note: 'From recent tenant records', icon: 'ShieldCheck' },
          { label: 'Platform model', value: 'SaaS', note: 'Multi-tenant architecture', icon: 'Cloud' }
        ].map(stat => (
          <Card key={stat.label} className="border-border/70 shadow-sm">
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{stat.label}</div>
                <div className="brand-heading mt-2 text-3xl font-black">{stat.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{stat.note}</div>
              </div>
              <div className="rounded-xl bg-secondary p-3 text-primary">
                <ApperIcon name={stat.icon} size={21} />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">The product family</div>
            <h2 className="brand-heading mt-1 text-2xl font-black">Independent apps, connected by design</h2>
            <p className="mt-1 text-sm text-muted-foreground">Each module can be licensed separately or enabled together as HealthSuite 360.</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/modules">View module catalogue <ApperIcon name="ArrowRight" size={15} className="ml-2" /></Link>
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((module, index) => (
            <Card key={module.key} className="group overflow-hidden border-border/70 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className={`rounded-xl p-3 ${module.accent}`}>
                    <ApperIcon name={module.icon} size={23} />
                  </div>
                  <Badge variant="outline">{module.stage}</Badge>
                </div>
                <CardTitle className="brand-heading pt-2 text-xl font-extrabold">{module.name}</CardTitle>
                <div className="text-xs font-bold text-primary">{module.category}</div>
              </CardHeader>
              <CardContent>
                <p className="min-h-12 text-sm leading-6 text-muted-foreground">{module.description}</p>
                <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                  <span className="text-xs font-semibold text-muted-foreground">Module workspace</span>
                  <Button asChild variant="ghost" size="sm" className="text-primary">
                    <Link to={module.path}>Open overview <ApperIcon name="ArrowRight" size={15} className="ml-1" /></Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="brand-heading text-xl">Recent business onboarding</CardTitle>
            <p className="text-sm text-muted-foreground">The latest organisations registered on the platform.</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <StatsSkeleton count={3} />
            ) : error ? (
              <div className="rounded-lg border border-destructive/30 p-4 text-sm">
                <p className="font-bold text-destructive">Unable to load tenant records.</p>
                <p className="mt-1 text-muted-foreground">{error.message}</p>
                <Button variant="outline" size="sm" onClick={run} className="mt-3">Retry</Button>
              </div>
            ) : tenantRows.length ? (
              <div className="divide-y divide-border">
                {tenantRows.map(tenant => (
                  <Link key={tenant.Id} to={`/tenants/${tenant.Id}`} className="flex items-center justify-between gap-3 py-3 transition-colors hover:bg-accent">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">{tenant.Name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{tenant.business_type_c ?? 'Business'} · {tenant.subscription_plan_c ?? 'Plan not assigned'}</div>
                    </div>
                    <Badge variant={tenant.status_c === 'Active' ? 'default' : 'secondary'}>{tenant.status_c ?? 'Pending'}</Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <ApperIcon name="Building2" size={25} className="mx-auto text-muted-foreground" />
                <p className="mt-3 text-sm font-bold">Your first customer starts here</p>
                <p className="mt-1 text-xs text-muted-foreground">Create a business tenant and assign its first product modules.</p>
                <Button asChild size="sm" className="mt-4"><Link to="/tenants/new">Add a business</Link></Button>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="brand-heading text-xl">Platform build sequence</CardTitle>
            <p className="text-sm text-muted-foreground">Modules are developed as separate workspaces, then unified.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              ['01', 'Master workspace and access foundation', 'In progress'],
              ['02', 'PharmaSuite', 'Next'],
              ['03', 'LabSuite', 'Planned'],
              ['04', 'DoctorSuite', 'Planned'],
              ['05', 'PatientSuite and CareConnect', 'Planned']
            ].map((item, index) => (
              <div key={item[0]} className="flex gap-3">
                <div className="brand-heading flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-black">{item[0]}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{item[1]}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{item[2]}</div>
                </div>
                {index === 0 && <ApperIcon name="CircleDot" className="text-primary" size={17} />}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}