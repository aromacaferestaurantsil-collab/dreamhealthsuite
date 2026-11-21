import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/layouts/RootLayout';
import { requireSupabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export const route = { path: '/pharmacy/purchase', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'PackagePlus', label: 'Purchase', section: 'PharmaSuite · Inventory', order: 10, profiles: ['Admin_c','Manager','Pharmacist'] };

const today = () => new Date().toISOString().slice(0,10);
const money = n => '₹' + Number(n || 0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const blankLine = () => ({ key: crypto.randomUUID(), medicine:'', pack:'', batch:'', expiry:'', qty:'1', free:'0', rate:'0', discount:'0', gst:'0', mrp:'0', selling:'0', hsn:'' });
const Field = ({label,children}) => <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;

export default function PharmacyPurchase() {
 const {activeTenant} = useAuth();
 const tenantId = activeTenant?.tenant_id;
 const db = requireSupabase();
 const [branch,setBranch] = useState(activeTenant?.branch_id || '');
 const [branches,setBranches] = useState([]);
 const [suppliers,setSuppliers] = useState([]);
 const [medicines,setMedicines] = useState([]);
 const [bills,setBills] = useState([]);
 const [supplier,setSupplier] = useState('');
 const [billNumber,setBillNumber] = useState('PB-'+Date.now().toString(36).toUpperCase());
 const [invoiceNumber,setInvoiceNumber] = useState('');
 const [invoiceDate,setInvoiceDate] = useState(today());
 const [receivedDate,setReceivedDate] = useState(today());
 const [billDiscount,setBillDiscount] = useState('0');
 const [roundOff,setRoundOff] = useState('0');
 const [lines,setLines] = useState([blankLine()]);
 const [busy,setBusy] = useState(false);
 const [medicineSearch,setMedicineSearch] = useState({});
 const loadRequest=useRef(0);

 async function load() {
  if(!tenantId){setBranches([]);setSuppliers([]);setMedicines([]);setBills([]);setBusy(false);return;}
  const request=++loadRequest.current;
  setBusy(true);
  try {
   const [b,s,m,p] = await Promise.all([
    db.from('branches').select('id,name,branch_code').eq('tenant_id',tenantId).eq('status','active').order('name'),
    db.from('pharmacy_suppliers').select('id,name,gstin').eq('tenant_id',tenantId).eq('status','active').order('name'),
    db.from('medicine_catalogue').select('id,name,strength,brand,unit,units_per_pack,hsn_code,gst_rate').eq('tenant_id',tenantId).eq('status','active').order('name').limit(2000),
    db.from('pharmacy_purchase_orders').select('id,branch_id,supplier_id,order_number,supplier_invoice_number,supplier_invoice_date,received_date,total,status').eq('tenant_id',tenantId).order('created_at',{ascending:false}).limit(100)
   ]);
   for(const x of [b,s,m,p]) if(x.error) throw x.error;
   if(request!==loadRequest.current)return;
   setBranches(b.data||[]); setSuppliers(s.data||[]); setMedicines(m.data||[]); setBills(p.data||[]);
   setBranch(x=>x||activeTenant?.branch_id||b.data?.[0]?.id||'');
  } catch(e) { if(request===loadRequest.current)toast.error(e.message || 'Unable to load purchase data'); }
  finally { if(request===loadRequest.current)setBusy(false); }
 }
 useEffect(()=>{loadRequest.current++;setBranch(activeTenant?.branch_id||'');setBranches([]);setSuppliers([]);setMedicines([]);setBills([]);setSupplier('');setLines([blankLine()]);setMedicineSearch({})},[tenantId,activeTenant?.branch_id]);
 useEffect(()=>{load()},[tenantId]);

 const updateLine = (key,patch) => setLines(xs=>xs.map(x=>x.key===key?{...x,...patch}:x));
 const totals = useMemo(()=>{
  const rows=lines.map(x=>{
   const qty=Number(x.qty)||0, rate=Number(x.rate)||0, disc=Number(x.discount)||0, gst=Number(x.gst)||0;
   const gross=qty*rate, discount=gross*disc/100, taxable=gross-discount;
   return {...x,gross,discount,taxable,tax:taxable*gst/100,total:taxable+taxable*gst/100};
  });
  const subtotal=rows.reduce((s,x)=>s+x.taxable,0);
  const billDisc=Math.min(Math.max(0,Number(billDiscount)||0),subtotal);
  const tax=rows.reduce((s,x)=>s+(subtotal?x.tax*(1-billDisc/subtotal):0),0);
  const taxable=subtotal-billDisc;
  return {rows,subtotal,billDisc,taxable,tax,total:taxable+tax+(Number(roundOff)||0)};
 },[lines,billDiscount,roundOff]);

 function chooseMedicine(key,id) {
  const m=medicines.find(x=>x.id===id);
  updateLine(key,{medicine:id,gst:String(m?.gst_rate??0),hsn:m?.hsn_code||'',pack:m?.unit||''});
 }
 async function saveBill(e) {
  e.preventDefault();
  if(!tenantId||!branch||!supplier||!invoiceNumber.trim()) return toast.error('Choose branch, supplier and enter supplier invoice number');
  if(!lines.length||lines.some(x=>!x.medicine||!x.batch.trim()||!x.expiry||Number(x.qty)<=0||Number(x.free)<0||Number(x.rate)<0)) return toast.error('Complete every medicine row with valid quantity, batch and expiry');
  if(totals.subtotal<=0) return toast.error('Bill value must be greater than zero');
  if(Number(billDiscount)>totals.subtotal) return toast.error('Bill discount cannot exceed taxable goods value');
  setBusy(true);
  try {
   const {data,error}=await db.rpc('pharmacy_create_purchase_bill',{
    p_tenant_id:tenantId,p_branch_id:branch,p_supplier_id:supplier,
    p_bill_number:billNumber.trim(),p_supplier_invoice_number:invoiceNumber.trim(),
    p_invoice_date:invoiceDate,p_received_date:receivedDate,
    p_bill_discount:Number(billDiscount)||0,p_round_off:Number(roundOff)||0,
    p_items:lines.map(x=>({
     medicine_id:x.medicine,pack_label:x.pack,batch_number:x.batch.trim(),expiry_date:x.expiry,
     quantity:Number(x.qty),free_quantity:Number(x.free)||0,purchase_rate:Number(x.rate),
     discount_percent:Number(x.discount)||0,gst_rate:Number(x.gst)||0,mrp:Number(x.mrp)||0,
     selling_rate:Number(x.selling)||0,hsn_code:x.hsn||null
    }))
   });
   if(error) throw error;
   toast.success('Purchase bill saved · stock and supplier ledger updated');
   setBillNumber('PB-'+Date.now().toString(36).toUpperCase());setInvoiceNumber('');
   setInvoiceDate(today());setReceivedDate(today());setBillDiscount('0');setRoundOff('0');setLines([blankLine()]);
   await load();
  } catch(e) { toast.error(e.message || 'Purchase bill could not be saved'); }
  finally { setBusy(false); }
 }

 if(!tenantId) return <Card><CardContent className="p-6">Select a workspace to use PharmaSuite.</CardContent></Card>;
 return <div className="mx-auto max-w-7xl space-y-5">
  <header className="rounded-2xl bg-primary px-6 py-6 text-primary-foreground">
   <p className="text-xs font-bold uppercase tracking-widest opacity-80">PharmaSuite · Inventory</p>
   <h1 className="mt-2 text-3xl font-black">Purchase</h1>
   <p className="mt-2 text-sm opacity-90">Record supplier invoices, receive medicine batches and update stock and distributor balances in one posting.</p>
  </header>
  <form onSubmit={saveBill} className="space-y-5">
   <Card><CardHeader><CardTitle>Purchase bill details</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <Field label="Branch"><Select value={branch} onValueChange={setBranch}><SelectTrigger><SelectValue placeholder="Select branch"/></SelectTrigger><SelectContent>{branches.map(x=><SelectItem key={x.id} value={x.id}>{x.name} · {x.branch_code}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Supplier / party ledger"><Select value={supplier} onValueChange={setSupplier}><SelectTrigger><SelectValue placeholder="Select supplier"/></SelectTrigger><SelectContent>{suppliers.map(x=><SelectItem key={x.id} value={x.id}>{x.name}{x.gstin?' · '+x.gstin:''}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Purchase bill number"><Input required value={billNumber} onChange={e=>setBillNumber(e.target.value)}/></Field>
    <Field label="Supplier invoice / party number"><Input required value={invoiceNumber} onChange={e=>setInvoiceNumber(e.target.value)} placeholder="Supplier's invoice number"/></Field>
    <Field label="Supplier invoice date"><Input required type="date" value={invoiceDate} onChange={e=>setInvoiceDate(e.target.value)}/></Field>
    <Field label="Goods received date"><Input required type="date" value={receivedDate} onChange={e=>setReceivedDate(e.target.value)}/></Field>
   </CardContent></Card>
   <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>Medicine items</CardTitle><Button type="button" variant="outline" onClick={()=>setLines(xs=>[...xs,blankLine()])}>+ Add medicine</Button></div></CardHeader><CardContent className="space-y-4">
    {lines.map((line,index)=><div key={line.key} className="rounded-xl border p-3 sm:p-4 space-y-3">
     <div className="flex items-center justify-between"><b className="text-sm">Item {index+1}</b>{lines.length>1&&<Button type="button" size="sm" variant="ghost" onClick={()=>setLines(xs=>xs.filter(x=>x.key!==line.key))}>Remove</Button>}</div>
     <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Medicine"><Select value={line.medicine} onValueChange={v=>chooseMedicine(line.key,v)}><SelectTrigger><SelectValue placeholder="Search / select medicine"/></SelectTrigger><SelectContent>{medicines.map(m=><SelectItem key={m.id} value={m.id}>{m.name} {m.strength||''} · {m.brand||m.unit}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Pack / packing"><Input value={line.pack} onChange={e=>updateLine(line.key,{pack:e.target.value})} placeholder="e.g. 10 tablets"/></Field>
      <Field label="Batch number"><Input required value={line.batch} onChange={e=>updateLine(line.key,{batch:e.target.value})} placeholder="Manufacturer batch"/></Field>
      <Field label="Expiry date"><Input required type="date" min={receivedDate||today()} value={line.expiry} onChange={e=>updateLine(line.key,{expiry:e.target.value})}/></Field>
      <Field label="Quantity"><Input required type="number" min="0.001" step="0.001" value={line.qty} onChange={e=>updateLine(line.key,{qty:e.target.value})}/></Field>
      <Field label="Free quantity"><Input type="number" min="0" step="0.001" value={line.free} onChange={e=>updateLine(line.key,{free:e.target.value})}/></Field>
      <Field label="Purchase rate / unit ₹"><Input required type="number" min="0" step="0.01" value={line.rate} onChange={e=>updateLine(line.key,{rate:e.target.value})}/></Field>
      <Field label="Line discount %"><Input type="number" min="0" max="100" step="0.01" value={line.discount} onChange={e=>updateLine(line.key,{discount:e.target.value})}/></Field>
      <Field label="GST %"><Input type="number" min="0" max="100" step="0.01" value={line.gst} onChange={e=>updateLine(line.key,{gst:e.target.value})}/></Field>
      <Field label="HSN code"><Input value={line.hsn} onChange={e=>updateLine(line.key,{hsn:e.target.value})}/></Field>
      <Field label="MRP ₹"><Input type="number" min="0" step="0.01" value={line.mrp} onChange={e=>updateLine(line.key,{mrp:e.target.value})}/></Field>
      <Field label="Selling rate ₹"><Input type="number" min="0" step="0.01" value={line.selling} onChange={e=>updateLine(line.key,{selling:e.target.value})}/></Field>
     </div>
     <div className="flex flex-wrap justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm"><span>Goods {money(totals.rows[index]?.gross)} · Discount {money(totals.rows[index]?.discount)} · GST {money(totals.rows[index]?.tax)}</span><b>Line total {money(totals.rows[index]?.total)}</b></div>
    </div>)}
   </CardContent></Card>
   <Card><CardHeader><CardTitle>Bill calculation</CardTitle></CardHeader><CardContent className="grid gap-4 lg:grid-cols-[1fr_1fr]">
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Additional bill discount ₹"><Input type="number" min="0" step="0.01" value={billDiscount} onChange={e=>setBillDiscount(e.target.value)}/></Field><Field label="Round off (+/-) ₹"><Input type="number" step="0.01" value={roundOff} onChange={e=>setRoundOff(e.target.value)}/></Field></div>
    <div className="rounded-xl bg-muted/50 p-4 space-y-2 text-sm"><div className="flex justify-between"><span>Net goods value</span><b>{money(totals.subtotal)}</b></div><div className="flex justify-between"><span>Bill discount</span><b>− {money(totals.billDisc)}</b></div><div className="flex justify-between"><span>Taxable value</span><b>{money(totals.taxable)}</b></div><div className="flex justify-between"><span>GST total</span><b>{money(totals.tax)}</b></div><div className="flex justify-between"><span>Round off</span><b>{money(roundOff)}</b></div><div className="border-t pt-2 flex justify-between text-lg"><b>Bill total</b><b>{money(totals.total)}</b></div></div>
    <div className="lg:col-span-2 flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={()=>{setLines([blankLine()]);setInvoiceNumber('');setBillDiscount('0');setRoundOff('0')}}>Clear bill</Button><Button type="submit" disabled={busy||!branch||!supplier||!invoiceNumber.trim()||!lines.length}>{busy?'Saving…':'Save purchase bill'}</Button></div>
   </CardContent></Card>
  </form>
  <Card><CardHeader><CardTitle>Recent purchase bills</CardTitle></CardHeader><CardContent className="space-y-2">
   {bills.filter(x=>x.branch_id===branch).map(x=><div key={x.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><b>{x.supplier_invoice_number||x.order_number}</b><p className="text-xs text-muted-foreground">Bill {x.order_number} · {x.supplier_invoice_date||x.received_date} · {suppliers.find(s=>s.id===x.supplier_id)?.name||'Supplier'}</p></div><div className="text-right"><b>{money(x.total)}</b><p className="text-xs text-muted-foreground">{x.status}</p></div></div>)}
   {!bills.some(x=>x.branch_id===branch)&&<p className="text-sm text-muted-foreground">No purchase bills recorded for this branch yet.</p>}
  </CardContent></Card>
 </div>;
}
