import { useMemo } from 'react';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
export const route={path:'/analytics',layout:'owner',access:'authenticated'};
export const nav={icon:'ChartNoAxesCombined',label:'HealthAnalytics',order:15,profiles:['Admin_c']};
const specs=[
 {title:'Pharmacy invoices',table:'pharmacy_sales_c',fields:['invoice_number_c','grand_total_c','payment_status_c','sale_date_c']},
 {title:'Lab bookings',table:'lab_bookings_c',fields:['booking_number_c','status_c','total_amount_c','booking_date_c']},
 {title:'Appointments',table:'doctor_appointments_c',fields:['appointment_number_c','status_c','appointment_at_c']},
 {title:'Care jobs',table:'care_jobs_c',fields:['job_number_c','status_c','job_type_c','scheduled_at_c']}
];
export default function Analytics(){
 const pharmacy=useFetch(()=>sdk.table(specs[0].table).select(specs[0].fields).limit(1000).fetch().then(r=>{if(!r.success)throw new Error(r.message);return r.data||[]}),[]);
 const lab=useFetch(()=>sdk.table(specs[1].table).select(specs[1].fields).limit(1000).fetch().then(r=>{if(!r.success)throw new Error(r.message);return r.data||[]}),[]);
 const appointments=useFetch(()=>sdk.table(specs[2].table).select(specs[2].fields).limit(1000).fetch().then(r=>{if(!r.success)throw new Error(r.message);return r.data||[]}),[]);
 const jobs=useFetch(()=>sdk.table(specs[3].table).select(specs[3].fields).limit(1000).fetch().then(r=>{if(!r.success)throw new Error(r.message);return r.data||[]}),[]);
 const sales=pharmacy.data||[], bookings=lab.data||[], visits=appointments.data||[], deliveries=jobs.data||[];
 const total=sales.reduce((n,r)=>n+Number(r.grand_total_c||0),0);
 const metrics=[['Pharmacy invoices',sales.length],['Pharmacy billed value','₹'+total.toLocaleString('en-IN',{maximumFractionDigits:2})],['Lab bookings',bookings.length],['Appointments',visits.length],['Care jobs',deliveries.length]];
 const loading=[pharmacy,lab,appointments,jobs].some(x=>x.loading);
 const refresh=()=>[pharmacy,lab,appointments,jobs].forEach(x=>x.run());
 const statusCounts=rows=>rows.reduce((acc,r)=>{const s=r.status_c||'Unspecified';acc[s]=(acc[s]||0)+1;return acc;},{});
 const groups=[['Lab booking status',statusCounts(bookings)],['Appointment status',statusCounts(visits)],['Care job status',statusCounts(deliveries)]];
 return <div className="mx-auto max-w-7xl space-y-6">
  <section className="rounded-2xl bg-primary px-6 py-7 text-primary-foreground"><div className="text-xs font-bold uppercase tracking-widest opacity-80">HealthSuite 360 · Business intelligence</div><h1 className="brand-heading mt-2 text-3xl font-black">HealthAnalytics</h1><p className="mt-2 text-sm opacity-85">Operational snapshots across pharmacy, laboratory, appointments and care delivery.</p></section>
  <div className="flex justify-end"><Button variant="outline" onClick={refresh}>Refresh data</Button></div>
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{metrics.map(([label,value])=><Card key={label}><CardContent className="p-5"><div className="text-xs font-semibold text-muted-foreground">{label}</div><div className="mt-2 text-2xl font-black">{loading?'…':value}</div></CardContent></Card>)}</div>
  <div className="grid gap-5 lg:grid-cols-3">{groups.map(([title,counts])=><Card key={title}><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="space-y-3">{Object.entries(counts).map(([status,count])=><div key={status} className="flex items-center justify-between text-sm"><span>{status}</span><Badge variant="secondary">{count}</Badge></div>)}{!Object.keys(counts).length&&<p className="text-sm text-muted-foreground">No data available yet.</p>}</CardContent></Card>)}</div>
  <Card><CardHeader><CardTitle>Reporting scope and limitations</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><p>These are live operational counts from the connected application database, limited to the most recent 1,000 rows per dataset.</p><p>Revenue shown is gross pharmacy invoice value, not recognised revenue or profit. Refunds, discounts, GST treatment, purchase costs, lab TAT, branch segmentation, tenant subscription revenue and churn need dedicated validated reporting models.</p><p>Do not use this dashboard for financial statements or clinical decisions until reconciliation and tenant-scoped access controls are complete.</p></CardContent></Card>
 </div>;
}
