import { Link } from 'react-router-dom';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const route = { path: '/modules', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'Blocks', label: 'Product modules', order: 2, profiles: null };

const products = [
  { name: 'PharmaSuite', path: '/pharmacy', icon: 'Pill', audience: 'Retail and multi-branch pharmacies', features: ['Medicine catalogue and barcode POS', 'Batch, expiry and stock control', 'Distributor purchasing and price comparison', 'GST billing, returns and margin reports'] },
  { name: 'LabSuite', path: '/laboratory', icon: 'Microscope', audience: 'Diagnostic and pathology centres', features: ['Test catalogue and patient bookings', 'Barcode sample tracking', 'Collection and processing workflow', 'Authorised result verification and reports'] },
  { name: 'DoctorSuite', path: '/doctors', icon: 'Stethoscope', audience: 'Independent doctors and clinics', features: ['Appointments and doctor availability', 'Digital prescriptions and test orders', 'Patient history and follow-up reminders', 'Clinic schedule and consultation reports'] },
  { name: 'PatientSuite', path: '/patients', icon: 'HeartPulse', audience: 'Patients and healthcare organisations', features: ['Unified patient profiles and consent', 'Appointments, reports and prescriptions', 'Medicine orders and payment history', 'Loyalty, coupons and communication settings'] },
  { name: 'CareConnect', path: '/care-connect', icon: 'Truck', audience: 'Delivery and field collection teams', features: ['Medicine delivery assignments', 'Home sample collection jobs', 'OTP, barcode and handover tracking', 'Staff performance and job settlement'] },
  { name: 'HealthAnalytics', path: '/analytics', icon: 'ChartNoAxesCombined', audience: 'Owners and healthcare operators', features: ['Cross-module business dashboards', 'Sales, margin and stock intelligence', 'Lab turnaround and booking performance', 'Branch and subscription reporting'] }
];

export default function Modules() {
  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div>
        <Badge className="mb-3">PRODUCT CATALOGUE</Badge>
        <h1 className="brand-heading text-3xl font-black">Choose the right healthcare workspace</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Every product is designed to operate on its own subscription, permission set and workspace. Connected customers can combine modules without maintaining duplicate patient identities.</p>
      </div>
      <Card className="border-primary/20 bg-primary/5 shadow-none">
        <CardContent className="flex flex-col justify-between gap-4 p-5 md:flex-row md:items-center">
          <div>
            <div className="brand-heading text-xl font-black">HealthSuite 360 Master</div>
            <p className="mt-1 text-sm text-muted-foreground">A unified login, organisation profile, shared patient identity and connected reporting across licensed modules.</p>
          </div>
          <Badge variant="outline" className="w-fit">Bundle configuration by Super Admin</Badge>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        {products.map(product => (
          <Card key={product.name} className="border-border/70 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-secondary p-3 text-primary"><ApperIcon name={product.icon} size={24} /></div>
                  <div>
                    <h2 className="brand-heading text-xl font-black">{product.name}</h2>
                    <p className="text-xs text-muted-foreground">{product.audience}</p>
                  </div>
                </div>
                <Badge variant="outline">Independent app</Badge>
              </div>
              <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                {product.features.map(feature => (
                  <li key={feature} className="flex gap-2 text-sm text-muted-foreground">
                    <ApperIcon name="Check" size={15} className="mt-0.5 shrink-0 text-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 border-t border-border pt-4">
                <Button asChild variant="outline" size="sm">
                  <Link to={product.path}>Open {product.name} <ApperIcon name="ArrowRight" size={15} className="ml-2" /></Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}