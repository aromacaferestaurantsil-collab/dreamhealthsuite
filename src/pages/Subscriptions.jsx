import { useEffect,useState } from 'react';
import { useTenant } from '@/layouts/RootLayout';
import { requireSupabase } from '@/lib/supabase';
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const productNames={
 pharmacy_suite:'PharmaSuite',pharmacy:'PharmaSuite',
 laboratory_suite:'LabSuite',lab_suite:'LabSuite',laboratory:'LabSuite',
 doctor_suite:'DoctorSuite',doctor:'DoctorSuite',
 patient_suite:'PatientSuite',patient:'PatientSuite',
 care_connect:'Care Connect',care:'Care Connect',
 analytics:'HealthAnalytics',health_analytics:'HealthAnalytics'
};
const money=(currency,value)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:currency||'INR',maximumFractionDigits:2}).format(Number(value||0));
export const route={path:'/subscriptions',layout:'owner',access:'authenticated'};
export const nav={icon:'CreditCard',label:'Subscription',order:4,profiles:null};
export default function Subscriptions(){
 const {activeTenant}=useTenant();
 const [rows,setRows]=useState([]);
 const [entitlements,setEntitlements]=useState([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 useEffect(()=>{
  let alive=true;
  (async()=>{
   setLoading(true);setError('');
   if(!activeTenant?.tenant_id){setRows([]);setEntitlements([]);setLoading(false);return;}
   try{
    const db=requireSupabase();
    const [subscriptions,licences]=await Promise.all([
     db.from('tenant_subscriptions').select('id,status,starts_at,trial_ends_at,current_period_start,current_period_end,cancelled_at,created_at,subscription_plans(name,price,currency,billing_interval,module_entitlements,limits)').eq('tenant_id',activeTenant.tenant_id).order('created_at',{ascending:false}),
     db.rpc('get_my_module_entitlements',{p_tenant_id:activeTenant.tenant_id})
    ]);
    if(subscriptions.error)throw subscriptions.error;
    if(licences.error)throw licences.error;
    if(alive){setRows(subscriptions.data||[]);setEntitlements((licences.data||[]).filter(x=>x.enabled));}
   }catch(e){if(alive)setError(e.message||'Unable to load subscription details');}
   finally{if(alive)setLoading(false);}
  })();
  return()=>{alive=false};
 },[activeTenant?.tenant_id]);
 const licensedNames=[...new Set(entitlements.map(e=>productNames[e.module_key]||e.module_key))];
 return <div className="mx-auto max-w-5xl space-y-6">
  <div><div className="text-xs font-bold uppercase tracking-widest text-primary">Account billing</div><h1 className="brand-heading mt-1 text-3xl font-black">Subscription and plan</h1><p className="mt-1 text-sm text-muted-foreground">Read-only subscription information and purchased module access for the selected organisation.</p></div>
  {!activeTenant?<Card><CardContent className="p-5">Select an organisation workspace to view its subscription.</CardContent></Card>:loading?<p className="text-sm text-muted-foreground">Loading subscription…</p>:error?<p className="text-sm text-destructive">{error}</p>:<>
   <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>Active module licences</CardTitle><Badge variant="secondary">{licensedNames.length} enabled</Badge></div></CardHeader><CardContent>{licensedNames.length?<div className="flex flex-wrap gap-2">{licensedNames.map(name=><Badge key={name} variant="outline">{name}</Badge>)}</div>:<p className="text-sm text-muted-foreground">No module licences are currently enabled for this workspace.</p>}</CardContent></Card>
   {rows.length?<div className="space-y-4">{rows.map(row=><Card key={row.id}><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>{row.subscription_plans?.name||'Subscription plan'}</CardTitle><Badge variant={row.status==='active'?'default':'secondary'}>{row.status}</Badge></div></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 text-sm"><div><div className="text-muted-foreground">Plan price</div><strong>{money(row.subscription_plans?.currency,row.subscription_plans?.price)} / {row.subscription_plans?.billing_interval||'—'}</strong></div><div><div className="text-muted-foreground">Started</div><strong>{row.starts_at?new Date(row.starts_at).toLocaleDateString('en-IN'):'—'}</strong></div><div><div className="text-muted-foreground">Trial ends</div><strong>{row.trial_ends_at?new Date(row.trial_ends_at).toLocaleDateString('en-IN'):'—'}</strong></div><div><div className="text-muted-foreground">Current period ends</div><strong>{row.current_period_end?new Date(row.current_period_end).toLocaleDateString('en-IN'):'—'}</strong></div><div className="sm:col-span-2"><div className="text-muted-foreground">Plan modules</div><div className="mt-1 flex flex-wrap gap-2">{Object.entries(row.subscription_plans?.module_entitlements||{}).filter(([,enabled])=>enabled===true).map(([key])=><Badge key={key} variant="outline">{productNames[key]||key}</Badge>)}{!Object.values(row.subscription_plans?.module_entitlements||{}).some(Boolean)&&<span className="text-muted-foreground">Not specified on plan</span>}</div></div></CardContent></Card>)}</div>:licensedNames.length?<Card><CardContent className="p-5 text-sm text-muted-foreground">Module licences are enabled for this workspace, but no billing subscription record is attached yet. Contact the platform administrator to reconcile the plan and billing history.</CardContent></Card>:<Card><CardContent className="p-6 text-sm text-muted-foreground">No subscription has been assigned to this workspace yet. Contact the platform administrator for plan activation.</CardContent></Card>}
  </>}
 </div>;
}
