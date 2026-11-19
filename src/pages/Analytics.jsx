import { useEffect, useMemo, useState } from 'react';
import { useTenant } from '@/layouts/RootLayout';
import { requireSupabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const route = { path:'/analytics', layout:'owner', access:'authenticated' };
export const nav = { icon:'ChartNoAxesCombined', label:'HealthAnalytics', order:15, profiles:['Admin_c'] };

const money = value => '₹' + Number(value || 0).toLocaleString('en-IN',{maximumFractionDigits:2});
const fmtDate = value => value ? new Date(value).toLocaleDateString('en-IN') : '—';

export default function Analytics() {
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.tenant_id;
  const [tab,setTab] = useState('overview');
  const [data,setData] = useState({sales:[],purchases:[],labs:[],appointments:[],jobs:[]});
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [refreshKey,setRefreshKey] = useState(0);

  useEffect(() => {
    if (!tenantId) { setData({sales:[],purchases:[],labs:[],appointments:[],jobs:[]}); return; }
    let alive = true;
    setLoading(true); setError('');
    const client = requireSupabase();
    Promise.all([
      client.from('pharmacy_sales').select('id,invoice_number,grand_total,payment_status,sale_status,sold_at').eq('tenant_id',tenantId).order('sold_at',{ascending:false}).limit(500),
      client.from('pharmacy_purchase_orders').select('id,order_number,total,status,order_date,expected_date').eq('tenant_id',tenantId).order('order_date',{ascending:false}).limit(500),
      client.from('lab_bookings').select('id,booking_number,booking_status,total_amount,booked_at').eq('tenant_id',tenantId).order('booked_at',{ascending:false}).limit(500),
      client.from('doctor_appointments').select('id,appointment_number,appointment_status,starts_at').eq('tenant_id',tenantId).order('starts_at',{ascending:false}).limit(500),
      client.from('care_jobs').select('id,job_number,job_status,scheduled_start').eq('tenant_id',tenantId).order('scheduled_start',{ascending:false}).limit(500),
    ]).then(results => {
      const failed = results.find(x=>x.error);
      if (failed) throw failed.error;
      if (!alive) return;
      const [sales,purchases,labs,appointments,jobs] = results;
      setData({sales:sales.data||[],purchases:purchases.data||[],labs:labs.data||[],appointments:appointments.data||[],jobs:jobs.data||[]});
    }).catch(e=>{if(alive)setError(e.message||'Unable to load reports');})
      .finally(()=>{if(alive)setLoading(false);});
    return ()=>{alive=false;};
  },[tenantId,refreshKey]);

  const grossSales = useMemo(()=>data.sales.reduce((n,r)=>n+Number(r.grand_total||0),0),[data.sales]);
  const purchaseValue = useMemo(()=>data.purchases.reduce((n,r)=>n+Number(r.total||0),0),[data.purchases]);
  const tabs = [['overview','Overview'],['sales','Sales'],['purchases','Purchases']];
  const metrics = [['Sales invoices',data.sales.length],['Gross billed',money(grossSales)],['Purchase orders',data.purchases.length],['Purchase value',money(purchaseValue)],['Lab bookings',data.labs.length],['Appointments',data.appointments.length],['Care jobs',data.jobs.length]];
  const statusCounts = (rows,key) => rows.reduce((acc,row)=>{const s=row[key]||'Unspecified';acc[s]=(acc[s]||0)+1;return acc;},{});
  const renderTable = (rows,kind) => {
    const isSales=kind==='sales';
    return <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr>{(isSales?['Invoice','Date','Status','Payment','Gross total']:['PO number','Order date','Status','Expected date','Total']).map(x=><th key={x} className="py-3 pr-4">{x}</th>)}</tr></thead><tbody className="divide-y">{rows.map(r=><tr key={r.id}><td className="py-3 pr-4 font-semibold">{isSales?r.invoice_number:r.order_number}</td><td className="py-3 pr-4">{fmtDate(isSales?r.sold_at:r.order_date)}</td><td className="py-3 pr-4"><Badge variant="secondary">{isSales?r.sale_status:r.status}</Badge></td><td className="py-3 pr-4">{isSales?(r.payment_status||'—'):fmtDate(r.expected_date)}</td><td className="py-3 pr-4 font-semibold">{money(isSales?r.grand_total:r.total)}</td></tr>)}</tbody></table>{!rows.length&&<p className="py-8 text-center text-sm text-muted-foreground">No {kind} records found for this workspace.</p>}</div>;
  };

  return <div className="mx-auto max-w-7xl space-y-6">
    <section className="rounded-2xl bg-primary px-6 py-7 text-primary-foreground"><div className="text-xs font-bold uppercase tracking-widest opacity-80">HealthSuite 360 · Business intelligence</div><h1 className="brand-heading mt-2 text-3xl font-black">HealthAnalytics</h1><p className="mt-2 text-sm opacity-85">Tenant-scoped operating reports from the HealthSuite database.</p></section>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{tabs.map(([id,label])=><Button key={id} size="sm" variant={tab===id?'default':'outline'} onClick={()=>setTab(id)}>{label}</Button>)}</div><Button variant="outline" size="sm" onClick={()=>setRefreshKey(x=>x+1)} disabled={loading}>{loading?'Refreshing…':'Refresh data'}</Button></div>
    {error&&<div className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</div>}
    {tab==='overview'&&<><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label,value])=><Card key={label}><CardContent className="p-5"><div className="text-xs font-semibold text-muted-foreground">{label}</div><div className="mt-2 text-2xl font-black">{loading?'…':value}</div></CardContent></Card>)}</div><div className="grid gap-5 lg:grid-cols-3">{[['Lab booking status',statusCounts(data.labs,'booking_status')],['Appointment status',statusCounts(data.appointments,'appointment_status')],['Care job status',statusCounts(data.jobs,'job_status')]].map(([title,counts])=><Card key={title}><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="space-y-3">{Object.entries(counts).map(([status,count])=><div key={status} className="flex items-center justify-between text-sm"><span>{status}</span><Badge variant="secondary">{count}</Badge></div>)}{!Object.keys(counts).length&&<p className="text-sm text-muted-foreground">No data available yet.</p>}</CardContent></Card>)}</div></>}
    {tab==='sales'&&<Card><CardHeader><CardTitle>Sales register</CardTitle><p className="text-sm text-muted-foreground">Latest 500 pharmacy invoices for this workspace.</p></CardHeader><CardContent>{loading?<p className="text-sm text-muted-foreground">Loading sales…</p>:renderTable(data.sales,'sales')}</CardContent></Card>}
    {tab==='purchases'&&<Card><CardHeader><CardTitle>Purchase register</CardTitle><p className="text-sm text-muted-foreground">Latest 500 purchase orders for this workspace.</p></CardHeader><CardContent>{loading?<p className="text-sm text-muted-foreground">Loading purchases…</p>:renderTable(data.purchases,'purchases')}</CardContent></Card>}
    <Card><CardHeader><CardTitle>Reporting boundaries</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><p>All queries are scoped to the selected tenant and are additionally protected by database row-level security. Each register is limited to the latest 500 records.</p><p>Gross sales and purchase order totals are operational figures, not audited profit or cash-flow statements. Expenses, supplier payment allocations, employee attendance and reconciliation reports will be added after their database workflows are designed and tested.</p></CardContent></Card>
  </div>;
}
