import { Link } from 'react-router-dom';
import { useTenant } from '@/layouts/RootLayout';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const route = { path: '/', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'LayoutDashboard', label: 'Overview', order: 1, profiles: null };

const modules = [
  { key:'pharmacy', name:'PharmaSuite', description:'POS, catalogue, batches, purchasing and expiry controls.', icon:'Pill', path:'/pharmacy' },
  { key:'laboratory', name:'LabSuite', description:'Bookings, sample workflows, verification and reports.', icon:'Microscope', path:'/laboratory' },
  { key:'doctor', name:'DoctorSuite', description:'Doctor directory, appointments and clinical workflows.', icon:'Stethoscope', path:'/doctors' },
  { key:'patient', name:'PatientSuite', description:'Patient identity, consent and connected records.', icon:'HeartPulse', path:'/patients' },
  { key:'care', name:'CareConnect', description:'Delivery, collection and field-service operations.', icon:'Truck', path:'/care-connect' },
  { key:'analytics', name:'HealthAnalytics', description:'Operational reporting and business intelligence.', icon:'ChartNoAxesCombined', path:'/analytics' },
];

export default function Home() {
  const { memberships, activeTenant } = useTenant();
  const tenant = activeTenant?.tenants;
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="relative overflow-hidden rounded-2xl bg-primary px-6 py-8 text-primary-foreground md:px-9 md:py-10">
        <Badge className="mb-4 border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground">HEALTHSUITE 360</Badge>
        <h1 className="brand-heading text-3xl font-black tracking-tight md:text-5xl">One workspace. Connected healthcare operations.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-primary-foreground/85 md:text-base">Your organisation's healthcare workspace, powered by the HealthSuite database and tenant-scoped access.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild className="bg-card text-card-foreground hover:bg-card/90"><Link to="/pharmacy">Open PharmaSuite <ApperIcon name="ArrowUpRight" size={16} className="ml-2" /></Link></Button>
          <Button asChild variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"><Link to="/analytics">View analytics</Link></Button>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card><CardContent className="p-5"><div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active workspace</div><div className="mt-2 text-xl font-black">{tenant?.display_name || 'No workspace selected'}</div><div className="mt-1 text-xs text-muted-foreground">{tenant?.slug || 'Create or join a workspace to continue'}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your memberships</div><div className="mt-2 text-3xl font-black">{memberships.length}</div><div className="mt-1 text-xs text-muted-foreground">Workspaces available to your account</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Platform architecture</div><div className="mt-2 text-3xl font-black">Supabase</div><div className="mt-1 text-xs text-muted-foreground">PostgreSQL · Auth · RLS · APIs</div></CardContent></Card>
      </section>
      <section className="space-y-4">
        <div><div className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Product family</div><h2 className="brand-heading mt-1 text-2xl font-black">Healthcare modules</h2><p className="mt-1 text-sm text-muted-foreground">Open a module within your selected workspace.</p></div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modules.map(module => <Card key={module.key} className="border-border/70 shadow-sm"><CardHeader><div className="flex items-center gap-3"><div className="rounded-xl bg-secondary p-3 text-primary"><ApperIcon name={module.icon} size={23}/></div><CardTitle className="text-xl">{module.name}</CardTitle></div></CardHeader><CardContent><p className="min-h-12 text-sm leading-6 text-muted-foreground">{module.description}</p><div className="mt-4 border-t pt-3"><Button asChild variant="ghost" size="sm" className="text-primary"><Link to={module.path}>Open module <ApperIcon name="ArrowRight" size={15} className="ml-1"/></Link></Button></div></CardContent></Card>)}
        </div>
      </section>
    </div>
  );
}
