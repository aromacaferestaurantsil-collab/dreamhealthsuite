import { Link } from 'react-router-dom';
import { useEffect,useState } from 'react';
import { useAuth } from '@/layouts/RootLayout';
import { requireSupabase } from '@/lib/supabase';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const route = { path: '/modules', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'Blocks', label: 'Purchased modules', order: 2, profiles: null };

const products = [
 {key:'pharmacy_suite', aliases:['pharmacy','pharmacy_suite'],name:'PharmaSuite',path:'/pharmacy',entry:'/pharmacy',icon:'Pill',audience:'Retail and multi-branch pharmacies',features:['Medicine catalogue and barcode POS','Batch, expiry and stock control','Distributor purchasing and price comparison','GST billing, returns and financial registers']},
 {key:'laboratory_suite',aliases:['lab','laboratory','laboratory_suite','lab_suite'],name:'LabSuite',path:'/laboratory',entry:'/laboratory',icon:'Microscope',audience:'Diagnostic and pathology centres',features:['Test catalogue and patient bookings','Barcode sample tracking','Collection and processing workflow','Authorised result verification and reports']},
 {key:'doctor_suite',aliases:['doctor','doctors','doctor_suite'],name:'DoctorSuite',path:'/doctors',entry:'/doctors',icon:'Stethoscope',audience:'Independent doctors and clinics',features:['Appointments and doctor availability','Digital prescriptions and test orders','Patient history and follow-up reminders','Clinic schedule and consultation reports']},
 {key:'patient_suite',aliases:['patient','patients','patient_suite'],name:'PatientSuite',path:'/patients',entry:'/patients',icon:'HeartPulse',audience:'Patients and healthcare organisations',features:['Unified patient profiles and consent','Appointments, reports and prescriptions','Medicine orders and payment history','Loyalty, coupons and communication settings']},
 {key:'care_connect',aliases:['care','care-connect','care_connect','careconnect'],name:'Care Connect',path:'/care-connect',entry:'/care-connect',icon:'Truck',audience:'Delivery and field collection teams',features:['Medicine delivery assignments','Home sample collection jobs','OTP, barcode and handover tracking','Staff performance and job settlement']},
 {key:'health_analytics',aliases:['analytics','health_analytics'],name:'HealthAnalytics',path:'/analytics',entry:'/analytics',icon:'ChartNoAxesCombined',audience:'Owners and healthcare operators',features:['Cross-module business dashboards','Sales, margin and stock intelligence','Lab turnaround and booking performance','Branch reporting and export']},
];
const matches = (row,product)=>product.aliases.includes(row.module_key);
function Status({product,entitlement,loading}) {
 if(loading)return <Badge variant="outline">Checking licence…</Badge>;
 if(!entitlement)return <Badge variant="secondary">Not purchased</Badge>;
 const active=entitlement.enabled&&(!entitlement.starts_at||new Date(entitlement.starts_at)<=new Date())&&(!entitlement.ends_at||new Date(entitlement.ends_at)>=new Date());
 return <Badge variant={active?'default':'destructive'}>{active?'Active licence':'Inactive / expired'}</Badge>;
}
export default function Modules() {
 const {activeTenant}=useAuth(); const tenantId=activeTenant?.tenant_id;
 const [entitlements,setEntitlements]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
 useEffect(()=>{let alive=true;async function load(){
  if(!tenantId){setEntitlements([]);setLoading(false);return;}
  setLoading(true);setError('');
  try{const {data,error}=await requireSupabase().rpc('get_my_module_entitlements',{p_tenant_id:tenantId});if(error)throw error;if(alive)setEntitlements(data??[]);}
  catch(e){if(alive){setError(e.message||'Unable to verify module subscriptions');setEntitlements([]);}}
  finally{if(alive)setLoading(false);}
 }load();return()=>{alive=false};},[tenantId]);
 const getEntitlement=p=>entitlements.find(e=>matches(e,p));
 const isActive=p=>{const e=getEntitlement(p);return Boolean(e?.enabled&&(!e.starts_at||new Date(e.starts_at)<=new Date())&&(!e.ends_at||new Date(e.ends_at)>=new Date()));};
 const purchased=products.filter(isActive);
 return <div className="mx-auto max-w-7xl space-y-7">
  <div><Badge className="mb-3">VENDOR MODULE ACCESS</Badge><h1 className="brand-heading text-3xl font-black">Your purchased healthcare modules</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Open the operational applications included in this organisation's active subscription. Module access is loaded from the server and cannot be granted from this screen.</p></div>
  {error&&<Card><CardContent className="p-4 text-sm text-destructive">Subscription verification failed: {error}. Module links remain unavailable until access can be verified.</CardContent></Card>}
  <div className="grid gap-3 sm:grid-cols-3"><Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Active modules</div><div className="mt-1 text-3xl font-black">{loading?'—':purchased.length}</div></CardContent></Card><Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Available products</div><div className="mt-1 text-3xl font-black">6</div></CardContent></Card><Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Organisation</div><div className="mt-1 truncate text-lg font-bold">{activeTenant?.tenants?.display_name??'Current workspace'}</div></CardContent></Card></div>
  <div className="grid gap-4 lg:grid-cols-2">{products.map(p=>{const entitlement=getEntitlement(p);const active=isActive(p);return <Card key={p.key} className="border-border/70 shadow-sm"><CardContent className="p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="rounded-xl bg-secondary p-3 text-primary"><ApperIcon name={p.icon} size={23}/></div><div><h2 className="brand-heading text-xl font-black">{p.name}</h2><p className="text-xs text-muted-foreground">{p.audience}</p></div></div><Status product={p} entitlement={entitlement} loading={loading}/></div><ul className="mt-5 grid gap-2 sm:grid-cols-2">{p.features.map(f=><li key={f} className="flex gap-2 text-sm text-muted-foreground"><ApperIcon name="Check" size={15} className="mt-0.5 shrink-0 text-primary"/><span>{f}</span></li>)}</ul><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">{entitlement?.ends_at&&<span className="text-xs text-muted-foreground">Through {new Date(entitlement.ends_at).toLocaleDateString('en-IN')}</span>}<Button asChild size="sm" disabled={!active||loading||!!error} variant={active?'default':'outline'}><Link aria-disabled={!active||loading||!!error} tabIndex={!active||loading||!!error?-1:0} to={active?p.entry:'/modules'}>{active?'Open '+p.name:'Access unavailable'} <ApperIcon name="ArrowRight" size={15} className="ml-2"/></Link></Button></div></CardContent></Card>})}</div>
  <p className="text-xs text-muted-foreground">Purchases and renewals are controlled by the platform administrator. Tenant data remains isolated by the active workspace; page navigation alone does not replace database permission checks.</p>
 </div>;
}
