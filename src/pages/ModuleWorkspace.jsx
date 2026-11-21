import { Link, useLocation } from 'react-router-dom';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/layouts/RootLayout';
import { requireSupabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const route = { path: '/workspace/:module', layout: 'owner', access: 'authenticated' };

const catalogue = {
  pharmacy: { key:'pharmacy_suite', name:'PharmaSuite', icon:'Pill', audience:'Pharmacy ERP', path:'/pharmacy', capabilities:['Medicine catalogue and generic mapping','Barcode point-of-sale and GST invoices','Batch-wise inventory and expiry alerts','Purchases, distributors and supplier balances','Returns, cash closing and branch transfers'] },
  laboratory: { key:'lab_suite', name:'LabSuite', icon:'Microscope', audience:'Diagnostic centre ERP', path:'/lab', capabilities:['Test catalogue, bookings and pricing','Barcode sample intake and collection workflow','Sample processing and outsourced tests','Independent result verification and report release','Pending reports and turnaround analytics'] },
  doctors: { key:'doctor_suite', name:'DoctorSuite', icon:'Stethoscope', audience:'Doctor and clinic ERP', path:'/doctors', capabilities:['Doctor profile, clinic locations and working hours','Appointment slots and schedule controls','Patient history and digital prescriptions','Diagnostic orders and follow-up reminders','Consultation and professional fee records'] },
  patients: { key:'patient_suite', name:'PatientSuite', icon:'HeartPulse', audience:'Patient identity and portal', path:'/patients', capabilities:['Unified patient ID and consent records','Appointments and prescription history','Verified laboratory reports and downloads','Medicine order and delivery history','Communication preferences and notifications'] },
  'care-connect': { key:'care_connect', name:'Care Connect', icon:'Truck', audience:'Delivery and collection operations', path:'/care-connect', capabilities:['Delivery and collection work queues','Medicine delivery status and OTP confirmation','Home sample collection and barcode handover','Assignment and reassignment','Attendance and payment reports'] },
  analytics: { key:'health_analytics', name:'HealthAnalytics', icon:'ChartNoAxesCombined', audience:'Healthcare business intelligence', path:'/analytics', capabilities:['Pharmacy sales, margins and inventory reports','Laboratory bookings and turnaround','Doctor schedule and performance','Branch and module comparisons','PDF and spreadsheet reporting'] }
};
const aliases = { pharmacy:'pharmacy', pharmacy_suite:'pharmacy', laboratory:'laboratory', lab_suite:'laboratory', doctors:'doctors', doctor_suite:'doctors', patients:'patients', patient_suite:'patients', 'care-connect':'care-connect', care_connect:'care-connect', careconnect:'care-connect', analytics:'analytics', health_analytics:'analytics' };

export default function ModuleWorkspace() {
  const location = useLocation();
  const { activeTenant } = useAuth();
  const tenantId = activeTenant?.tenant_id;
  const moduleParam = location.pathname.split('/').filter(Boolean).pop();
  const module = aliases[moduleParam] || moduleParam;
  const product = catalogue[module];
  const [entitlements,setEntitlements] = useState([]);
  const [loading,setLoading] = useState(true);
  const [accessError,setAccessError] = useState('');
  useEffect(() => {
    let alive=true;
    async function load() {
      if(!tenantId) { setEntitlements([]); setLoading(false); return; }
      setLoading(true); setAccessError('');
      const {data,error}=await requireSupabase().from('tenant_module_entitlements')
        .select('module_key,enabled,starts_at,ends_at')
        .eq('tenant_id',tenantId).eq('enabled',true);
      if(!alive)return;
      if(error){setAccessError(error.message);setEntitlements([]);}
      else setEntitlements(data??[]);
      setLoading(false);
    }
    load().catch(e=>{if(alive){setAccessError(e.message||'Unable to verify subscription');setLoading(false);}});
    return ()=>{alive=false;};
  },[tenantId]);
  if (!product) return <div><Link to="/modules">Back to product modules</Link><p className="mt-5">Module workspace not found.</p></div>;
  const entitlement = entitlements.find(x => aliases[x.module_key]===module || x.module_key===product.key);
  const entitled = Boolean(entitlement && (!entitlement.starts_at || new Date(entitlement.starts_at)<=new Date()) && (!entitlement.ends_at || new Date(entitlement.ends_at)>=new Date()));
  return (
    <div className="mx-auto max-w-6xl space-y-7">
      <Link to="/modules" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground"><ApperIcon name="ArrowLeft" size={16} /> Back to product modules</Link>
      <section className="rounded-2xl bg-primary px-6 py-8 text-primary-foreground md:px-9">
        <div className="flex flex-wrap items-center justify-between gap-5"><div className="flex items-center gap-4"><div className="rounded-2xl bg-primary-foreground/15 p-4"><ApperIcon name={product.icon} size={30} /></div><div><Badge className="border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground">{product.audience}</Badge><h1 className="brand-heading mt-2 text-3xl font-black">{product.name}</h1><p className="mt-1 text-sm text-primary-foreground/80">Tenant-scoped workspace · HealthSuite 360</p></div></div><Badge variant="outline" className="border-primary-foreground/40 text-primary-foreground">{loading?'Checking licence…':entitled?'Licensed':'Not licensed'}</Badge></div>
      </section>
      {loading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Verifying your organisation's active subscription…</CardContent></Card> :
       accessError ? <Card><CardContent className="p-6 text-sm text-destructive">Could not verify module access. {accessError}</CardContent></Card> :
       !entitled ? <Card><CardHeader><CardTitle>Module not included in your subscription</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">This organisation does not currently have an active {product.name} entitlement. Contact your platform administrator to purchase or renew this module.</p><Button asChild variant="outline"><Link to="/modules">Return to your purchased modules</Link></Button></CardContent></Card> :
       <><Card><CardHeader><CardTitle>Available operational workspace</CardTitle><p className="text-sm text-muted-foreground">Your subscription is active. Open the implemented module to use its tenant-scoped operational workflows.</p></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-2">{product.capabilities.map((capability,index)=><div key={capability} className="flex gap-3 rounded-lg border p-3"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-black text-primary">{index+1}</div><p className="text-sm font-semibold">{capability}</p></div>)}</div><Button asChild><Link to={product.path}>Open {product.name} <ApperIcon name="ArrowRight" size={15} className="ml-2"/></Link></Button></CardContent></Card><p className="text-xs text-muted-foreground">Access is checked against the organisation's subscription. Transactional APIs and database policies remain the enforcement boundary; hiding a navigation link is not a security control.</p></>}
    </div>
  );
}
