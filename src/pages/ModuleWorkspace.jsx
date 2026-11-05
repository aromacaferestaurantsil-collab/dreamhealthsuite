import { Link, useParams } from 'react-router-dom';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const route = { path: '/workspace/:module', layout: 'owner', access: 'authenticated' };

const catalogue = {
  pharmacy: { name: 'PharmaSuite', icon: 'Pill', audience: 'Pharmacy ERP', capabilities: ['Medicine catalogue and generic mapping', 'Barcode point-of-sale and GST invoices', 'Batch-wise inventory and expiry alerts', 'Purchases, distributors and supplier balances', 'Reorder suggestions and purchase cost intelligence', 'Returns, cash closing and branch transfers'] },
  laboratory: { name: 'LabSuite', icon: 'Microscope', audience: 'Diagnostic centre ERP', capabilities: ['Test catalogue, packages and pricing', 'Online and walk-in patient bookings', 'Barcode sample IDs and collection assignment', 'Sample receiving, processing and outsourced tests', 'Authorised result verification and PDF reports', 'Pending report and turnaround analytics'] },
  doctors: { name: 'DoctorSuite', icon: 'Stethoscope', audience: 'Doctor and clinic ERP', capabilities: ['Doctor profile, clinic locations and working hours', 'Appointment slots, leave and schedule controls', 'Patient history and digital prescriptions', 'Diagnostic orders and prescription-linked activity', 'Follow-up reminders and rebooking', 'Consultation income and documented professional fees'] },
  patients: { name: 'PatientSuite', icon: 'HeartPulse', audience: 'Patient CRM and portal', capabilities: ['Unified patient ID and consent record', 'Appointments and prescription history', 'Verified laboratory reports and downloads', 'Medicine order and delivery history', 'Loyalty points, coupons and membership', 'Communication preferences and secure notifications'] },
  'care-connect': { name: 'CareConnect', icon: 'Truck', audience: 'Delivery and collection operations', capabilities: ['Delivery and collection staff work queues', 'Medicine delivery status and OTP confirmation', 'Home sample collection and barcode handover', 'Job assignment, reassignment and failure reasons', 'Attendance, performance and payment reports', 'Role-limited access to essential patient details'] },
  analytics: { name: 'HealthAnalytics', icon: 'ChartNoAxesCombined', audience: 'Healthcare business intelligence', capabilities: ['Pharmacy sales, margins and inventory reports', 'Laboratory bookings, pending verification and TAT', 'Doctor schedule and consultation performance', 'Branch, tenant and module comparisons', 'Subscription revenue, churn and usage analytics', 'PDF and spreadsheet reporting'] }
};

export default function ModuleWorkspace() {
  const { module } = useParams();
  const product = catalogue[module];
  if (!product) return <div><Link to="/modules">Back to product modules</Link><p className="mt-5">Module workspace not found.</p></div>;

  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <Link to="/modules" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"><ApperIcon name="ArrowLeft" size={16} /> Back to product modules</Link>
      <section className="rounded-2xl bg-primary px-6 py-8 text-primary-foreground md:px-9">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-primary-foreground/15 p-4"><ApperIcon name={product.icon} size={30} /></div>
            <div><Badge className="border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground">{product.audience}</Badge><h1 className="brand-heading mt-2 text-3xl font-black">{product.name}</h1><p className="mt-1 text-sm text-primary-foreground/80">Independent product workspace · HealthSuite 360</p></div>
          </div>
          <Badge variant="outline" className="border-primary-foreground/40 text-primary-foreground">Module foundation</Badge>
        </div>
      </section>
      <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
        <Card><CardHeader><CardTitle>Core product capabilities</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
          {product.capabilities.map((capability, index) => <div key={capability} className="flex gap-3 rounded-lg border border-border p-3"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-black text-primary">{index + 1}</div><p className="text-sm font-semibold">{capability}</p></div>)}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Workspace status</CardTitle></CardHeader><CardContent className="space-y-4">
          <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Product shell</span><Badge variant="secondary">Created</Badge></div>
          <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Operational data</span><Badge variant="outline">Not configured</Badge></div>
          <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Tenant licensing</span><Badge variant="outline">To configure</Badge></div>
          <div className="rounded-lg bg-secondary p-3 text-xs leading-5 text-muted-foreground">This workspace currently documents the module scope. The full transactional workflows, connected database, user permissions and integrations are added in the module's implementation phase.</div>
          <Button asChild variant="outline" className="w-full"><Link to="/modules">Return to module catalogue <ApperIcon name="ArrowRight" size={15} className="ml-2" /></Link></Button>
        </CardContent></Card>
      </div>
    </div>
  );
}