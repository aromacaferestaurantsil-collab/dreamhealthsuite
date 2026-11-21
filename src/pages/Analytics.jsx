import { useEffect, useMemo, useState } from 'react';
import { useTenant } from '@/layouts/RootLayout';
import { requireSupabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const route = { path:'/analytics', layout:'owner', access:'authenticated' };
export const nav = { icon:'ChartNoAxesCombined', label:'HealthAnalytics', order:15, profiles:['Admin_c'] };

const money = value => '₹' + Number(value || 0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtDate = value => value ? new Date(value).toLocaleDateString('en-IN') : '—';
const today = () => new Date().toISOString().slice(0,10);
const monthStart = () => today().slice(0,8) + '01';
const sum = (rows,key) => rows.reduce((n,r)=>n+Number(r[key]||0),0);
const nextDay = value => { const [y,m,d]=value.split('-').map(Number); return new Date(Date.UTC(y,m-1,d+1)).toISOString().slice(0,10); };
const startTs = value => value+'T00:00:00+05:30';
const endTs = value => nextDay(value)+'T00:00:00+05:30';

export default function Analytics() {
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.tenant_id;
  const [branch,setBranch] = useState(activeTenant?.branch_id || 'all');
  const [branches,setBranches] = useState([]);
  const [from,setFrom] = useState(monthStart());
  const [to,setTo] = useState(today());
  const [tab,setTab] = useState('overview');
  const [data,setData] = useState({sales:[],purchases:[],expenses:[],expensePayments:[],supplierPayments:[],cashbook:[],labs:[],appointments:[],jobs:[]});
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [refreshKey,setRefreshKey] = useState(0);

  useEffect(() => {
    if (!tenantId) { setData({sales:[],purchases:[],expenses:[],expensePayments:[],supplierPayments:[],cashbook:[],labs:[],appointments:[],jobs:[]}); return; }
    if (!from || !to || from > to) { setError('Choose a valid reporting period.'); return; }
    let alive = true;
    setLoading(true); setError('');
    const db = requireSupabase();
    const scoped = q => branch !== 'all' ? q.eq('branch_id',branch) : q;
    const time = q => q.gte('sold_at',startTs(from)).lt('sold_at',endTs(to));
    Promise.all([
      db.from('branches').select('id,name,branch_code').eq('tenant_id',tenantId).eq('status','active').order('name'),
      time(scoped(db.from('pharmacy_sales').select('id,branch_id,invoice_number,subtotal,discount,tax_total,grand_total,payment_status,sale_status,sold_at').eq('tenant_id',tenantId))).order('sold_at',{ascending:false}).limit(5000),
      scoped(db.from('pharmacy_purchase_orders').select('id,branch_id,supplier_id,order_number,supplier_invoice_number,supplier_invoice_date,received_date,total,subtotal,tax_total,status,order_date').eq('tenant_id',tenantId).not('supplier_invoice_number','is',null).gte('supplier_invoice_date',from).lte('supplier_invoice_date',to)).order('supplier_invoice_date',{ascending:false}).limit(5000),
      scoped(db.from('pharmacy_expenses').select('id,branch_id,category,description,amount,expense_date,payment_status,supplier_id').eq('tenant_id',tenantId)).order('expense_date',{ascending:false}).limit(5000),
      db.from('pharmacy_expense_payments').select('id,tenant_id,expense_id,amount,payment_method,paid_at').eq('tenant_id',tenantId).gte('paid_at',startTs(from)).lt('paid_at',endTs(to)).order('paid_at',{ascending:false}).limit(5000),
      scoped(db.from('pharmacy_supplier_payments').select('id,branch_id,supplier_id,purchase_order_id,amount,payment_method,reference_number,paid_at').eq('tenant_id',tenantId).gte('paid_at',startTs(from)).lt('paid_at',endTs(to))).order('paid_at',{ascending:false}).limit(5000),
      scoped(db.from('pharmacy_cashbook_entries').select('id,branch_id,entry_type,direction,amount,payment_method,reference_number,description,occurred_at').eq('tenant_id',tenantId).gte('occurred_at',startTs(from)).lt('occurred_at',endTs(to))).order('occurred_at',{ascending:false}).limit(5000),
      scoped(db.from('lab_bookings').select('id,branch_id,booking_number,booking_status,total_amount,booked_at').eq('tenant_id',tenantId).gte('booked_at',startTs(from)).lt('booked_at',endTs(to))).order('booked_at',{ascending:false}).limit(5000),
      scoped(db.from('doctor_appointments').select('id,branch_id,appointment_number,appointment_status,starts_at').eq('tenant_id',tenantId).gte('starts_at',startTs(from)).lt('starts_at',endTs(to))).order('starts_at',{ascending:false}).limit(5000),
      scoped(db.from('care_jobs').select('id,branch_id,job_number,job_status,scheduled_start').eq('tenant_id',tenantId).gte('scheduled_start',startTs(from)).lt('scheduled_start',endTs(to))).order('scheduled_start',{ascending:false}).limit(5000),
    ]).then(results => {
      const failed = results.find(x=>x.error);
      if (failed) throw failed.error;
      if (!alive) return;
      const [b,sales,purchases,expenses,expensePayments,supplierPayments,cashbook,labs,appointments,jobs] = results;
      setBranches(b.data||[]);
      if (branch !== 'all' && !(b.data||[]).some(x=>x.id===branch)) setBranch(activeTenant?.branch_id || 'all');
      const allExpenses = expenses.data||[];
      const periodExpenses = allExpenses.filter(x=>x.expense_date>=from && x.expense_date<=to);
      const expenseIds = new Set(allExpenses.map(x=>x.id));
      setData({sales:sales.data||[],purchases:purchases.data||[],expenses:periodExpenses,expensePayments:(expensePayments.data||[]).filter(x=>expenseIds.has(x.expense_id)),supplierPayments:supplierPayments.data||[],cashbook:cashbook.data||[],labs:labs.data||[],appointments:appointments.data||[],jobs:jobs.data||[]});
    }).catch(e=>{if(alive)setError(e.message||'Unable to load reports');})
      .finally(()=>{if(alive)setLoading(false);});
    return ()=>{alive=false;};
  },[tenantId,branch,from,to,refreshKey]);

  const completedSales = useMemo(()=>data.sales.filter(r=>r.sale_status==='completed'),[data.sales]);
  const grossSales = sum(completedSales,'grand_total');
  const outputTax = sum(completedSales,'tax_total');
  const purchaseValue = sum(data.purchases,'total');
  const inputTax = sum(data.purchases,'tax_total');
  const expenseValue = sum(data.expenses,'amount');
  const expensePaid = sum(data.expensePayments,'amount');
  const supplierPaid = sum(data.supplierPayments,'amount');
  const cashIn = sum(data.cashbook.filter(x=>x.direction==='in'),'amount');
  const cashOut = sum(data.cashbook.filter(x=>x.direction==='out'),'amount');
  const netCash = cashIn-cashOut;
  const gstNet = outputTax-inputTax;
  const statusCounts = (rows,key) => rows.reduce((acc,row)=>{const s=row[key]||'Unspecified';acc[s]=(acc[s]||0)+1;return acc;},{});
  const tabs = [['overview','Overview'],['sales','Sales'],['purchases','Purchase bills'],['expenses','Expenses & payments'],['gst','GST summary']];
  const metrics = [['Completed sales',completedSales.length],['Gross billed',money(grossSales)],['Purchase bills',data.purchases.length],['Purchase value',money(purchaseValue)],['Expenses incurred',money(expenseValue)],['Supplier payments',money(supplierPaid)],['Net cash movement',money(netCash)]];
  const renderTable = (rows,kind) => {
    const config = {
      sales:{headers:['Invoice','Date','Sale status','Payment','Tax','Gross total'],cells:r=>[r.invoice_number,fmtDate(r.sold_at),r.sale_status,r.payment_status||'—',money(r.tax_total),money(r.grand_total)]},
      purchases:{headers:['Supplier invoice','Date','Bill status','Tax','Bill total'],cells:r=>[r.supplier_invoice_number||r.order_number,fmtDate(r.supplier_invoice_date||r.received_date),r.status,money(r.tax_total),money(r.total)]},
      expenses:{headers:['Date','Category','Description','Status','Amount'],cells:r=>[fmtDate(r.expense_date),r.category,r.description,r.payment_status,money(r.amount)]},
      cash:{headers:['Date','Type','Direction','Method','Reference','Amount'],cells:r=>[fmtDate(r.occurred_at),r.entry_type,r.direction,r.payment_method||'—',r.reference_number||'—',money(r.amount)]}
    }[kind];
    return <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr>{config.headers.map(x=><th key={x} className="py-3 pr-4">{x}</th>)}</tr></thead><tbody className="divide-y">{rows.map(r=><tr key={r.id}>{config.cells(r).map((x,i)=><td key={i} className="py-3 pr-4">{x}</td>)}</tr>)}</tbody></table>{!rows.length&&<p className="py-8 text-center text-sm text-muted-foreground">No records found for this reporting period.</p>}</div>;
  };

  if (!tenantId) return <Card><CardContent className="p-6">Select a workspace to view reports.</CardContent></Card>;
  return <div className="mx-auto max-w-7xl space-y-6">
    <section className="rounded-2xl bg-primary px-6 py-7 text-primary-foreground"><div className="text-xs font-bold uppercase tracking-widest opacity-80">HealthSuite 360 · Business intelligence</div><h1 className="brand-heading mt-2 text-3xl font-black">HealthAnalytics</h1><p className="mt-2 text-sm opacity-85">Branch-scoped operating, finance and GST summaries from recorded transactions.</p></section>
    <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1"><Label>Branch</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={branch} onChange={e=>setBranch(e.target.value)}><option value="all">All accessible branches</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name} · {b.branch_code}</option>)}</select></div>
      <div className="space-y-1"><Label>From</Label><Input type="date" value={from} max={to} onChange={e=>setFrom(e.target.value)}/></div>
      <div className="space-y-1"><Label>To</Label><Input type="date" value={to} min={from} max={today()} onChange={e=>setTo(e.target.value)}/></div>
      <div className="flex items-end"><Button variant="outline" className="w-full" onClick={()=>setRefreshKey(x=>x+1)} disabled={loading}>{loading?'Refreshing…':'Refresh reports'}</Button></div>
    </CardContent></Card>
    <div className="flex flex-wrap gap-2">{tabs.map(([id,label])=><Button key={id} size="sm" variant={tab===id?'default':'outline'} onClick={()=>setTab(id)}>{label}</Button>)}</div>
    {error&&<div className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{error}</div>}
    {loading&&<p className="text-sm text-muted-foreground">Loading transactions for {from} to {to}…</p>}
    {tab==='overview'&&<><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([label,value])=><Card key={label}><CardContent className="p-5"><div className="text-xs font-semibold text-muted-foreground">{label}</div><div className="mt-2 text-2xl font-black">{loading?'…':value}</div></CardContent></Card>)}</div>
      <div className="grid gap-5 lg:grid-cols-3">{[['Lab booking status',statusCounts(data.labs,'booking_status')],['Appointment status',statusCounts(data.appointments,'appointment_status')],['Care job status',statusCounts(data.jobs,'job_status')]].map(([title,counts])=><Card key={title}><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="space-y-3">{Object.entries(counts).map(([status,count])=><div key={status} className="flex items-center justify-between text-sm"><span>{status}</span><Badge variant="secondary">{count}</Badge></div>)}{!Object.keys(counts).length&&<p className="text-sm text-muted-foreground">No data available yet.</p>}</CardContent></Card>)}</div>
      <Card><CardHeader><CardTitle>Cashbook movement</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Cashbook inflow</p><p className="text-xl font-bold">{money(cashIn)}</p></div><div><p className="text-xs text-muted-foreground">Cashbook outflow</p><p className="text-xl font-bold">{money(cashOut)}</p></div><div><p className="text-xs text-muted-foreground">Net movement</p><p className="text-xl font-bold">{money(netCash)}</p></div></CardContent></Card>
    </>}
    {tab==='sales'&&<Card><CardHeader><CardTitle>Sales register</CardTitle><p className="text-sm text-muted-foreground">Completed invoices and tax collected in the selected period.</p></CardHeader><CardContent>{renderTable(data.sales,'sales')}</CardContent></Card>}
    {tab==='purchases'&&<Card><CardHeader><CardTitle>Supplier purchase bills</CardTitle><p className="text-sm text-muted-foreground">Recorded supplier invoices only; purchase orders without supplier invoice numbers are excluded.</p></CardHeader><CardContent>{renderTable(data.purchases,'purchases')}</CardContent></Card>}
    {tab==='expenses'&&<><div className="grid gap-3 sm:grid-cols-3"><Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Expenses booked</p><p className="mt-2 text-2xl font-bold">{money(expenseValue)}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Expense payments</p><p className="mt-2 text-2xl font-bold">{money(expensePaid)}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Supplier payments</p><p className="mt-2 text-2xl font-bold">{money(supplierPaid)}</p></CardContent></Card></div><Card><CardHeader><CardTitle>Expense register</CardTitle></CardHeader><CardContent>{renderTable(data.expenses,'expenses')}</CardContent></Card><Card><CardHeader><CardTitle>Cashbook entries</CardTitle></CardHeader><CardContent>{renderTable(data.cashbook,'cash')}</CardContent></Card></>}
    {tab==='gst'&&<><div className="grid gap-3 sm:grid-cols-3"><Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Output GST · completed sales</p><p className="mt-2 text-2xl font-bold">{money(outputTax)}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Input GST · recorded supplier bills</p><p className="mt-2 text-2xl font-bold">{money(inputTax)}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Indicative net GST</p><p className="mt-2 text-2xl font-bold">{money(gstNet)}</p></CardContent></Card></div><Card><CardHeader><CardTitle>GST reconciliation basis</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><p>Output tax is summed from completed pharmacy sales. Input tax is summed from purchase records carrying a supplier invoice number.</p><p>This is an operational estimate, not a GSTR-1 / GSTR-3B filing calculation. It does not establish input-tax-credit eligibility, reverse-charge treatment, credit notes, blocked credits, place-of-supply rules or portal matching. Reconcile supplier invoices with GSTR-2B and have a qualified tax professional review the return before filing.</p></CardContent></Card></>}
    <Card><CardHeader><CardTitle>Reporting boundaries</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><p>Every query is tenant-scoped and protected by database row-level security. Branch filtering is additionally applied where selected. Each data source is limited to 5,000 rows per selected period.</p><p>Gross billed, purchase value and expense totals are operational measures; they are not audited profit, inventory valuation or cash-flow statements. For a full financial-year export, use a shorter date range if any source reaches its row limit.</p></CardContent></Card>
  </div>;
}
