import { useEffect,useMemo,useState } from 'react';
import { useAuth } from '@/layouts/RootLayout';
import { requireSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export const route={path:'/pharmacy/finance',layout:'owner',access:'authenticated'};
export const nav={icon:'Wallet',label:'Khata & cashbook',section:'PharmaSuite · Finance',order:12,profiles:['Admin_c','Manager','Pharmacist']};
const money=v=>'₹'+Number(v||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const today=()=>new Date().toISOString().slice(0,10);

export default function PharmacyFinance(){
 const {activeTenant}=useAuth(); const db=requireSupabase();
 const tenantId=activeTenant?.tenant_id;
 const [branch,setBranch]=useState(activeTenant?.branch_id||'');
 const [branches,setBranches]=useState([]); const [patients,setPatients]=useState([]); const [ledger,setLedger]=useState([]);
 const [allocations,setAllocations]=useState([]); const [sessions,setSessions]=useState([]); const [entries,setEntries]=useState([]);
 const [patient,setPatient]=useState(''); const [receipt,setReceipt]=useState({number:'RC-'+Date.now().toString(36).toUpperCase(),amount:'',method:'cash',reference:'',invoice:'',allocation:''});
 const [opening,setOpening]=useState(''); const [counted,setCounted]=useState(''); const [notes,setNotes]=useState('');
 const [busy,setBusy]=useState(false);
 async function load(){
  if(!tenantId)return;
  const [b,p,l,a,s]=await Promise.all([
   db.from('branches').select('id,name').eq('tenant_id',tenantId).eq('status','active').order('name'),
   db.from('patients').select('id,full_name,patient_code').eq('tenant_id',tenantId).eq('status','active').order('full_name').limit(1000),
   db.from('pharmacy_customer_ledger').select('*').eq('tenant_id',tenantId).order('entry_date',{ascending:false}).limit(2000),
   db.from('pharmacy_ledger_allocations').select('*').eq('tenant_id',tenantId).eq('ledger_type','customer').limit(3000),
   db.from('pharmacy_cash_sessions').select('*').eq('tenant_id',tenantId).order('opened_at',{ascending:false}).limit(100),
  ]);
  for(const x of [b,p,l,a,s])if(x.error)throw x.error;
  setBranches(b.data||[]);setPatients(p.data||[]);setLedger(l.data||[]);setAllocations(a.data||[]);setSessions(s.data||[]);
  setBranch(v=>v||activeTenant?.branch_id||b.data?.[0]?.id||'');
  const open=(s.data||[]).find(x=>x.branch_id===branch&&x.status==='open');
  if(open){const {data,e}=await db.from('pharmacy_cashbook_entries').select('*').eq('tenant_id',tenantId).eq('session_id',open.id).order('occurred_at',{ascending:false});if(e)throw e;setEntries(data||[])}else setEntries([]);
 }
 useEffect(()=>{load().catch(e=>toast.error(e.message||'Unable to load finance records'))},[tenantId,branch]);
 const scoped=ledger.filter(x=>x.branch_id===branch);
 const invoices=useMemo(()=>scoped.filter(x=>x.patient_id===patient&&['invoice','opening'].includes(x.entry_type)&&Number(x.debit)>0).map(x=>({...x,paid:allocations.filter(a=>a.invoice_entry_id===x.id).reduce((n,a)=>n+Number(a.amount),0)})).map(x=>({...x,due:Math.max(0,Number(x.debit)-x.paid)})).filter(x=>x.due>0),[scoped,patient,allocations]);
 const selectedSession=sessions.find(x=>x.branch_id===branch&&x.status==='open');
 const customerBalance=patient?scoped.filter(x=>x.patient_id===patient).reduce((n,x)=>n+Number(x.debit)-Number(x.credit),0):0;
 async function postReceipt(e){
  e.preventDefault();if(!patient)return toast.error('Select a customer');
  const amount=Number(receipt.amount);if(!amount||amount<=0)return toast.error('Enter a valid receipt amount');
  const allocation=Number(receipt.allocation||0);if(allocation>amount)return toast.error('Allocated amount cannot exceed receipt amount');
  setBusy(true);try{
   const rows=allocation&&receipt.invoice?[{invoice_entry_id:receipt.invoice,amount:allocation}]:[];
   const {error}=await db.rpc('pharmacy_post_customer_receipt',{p_tenant_id:tenantId,p_branch_id:branch,p_patient_id:patient,p_receipt_number:receipt.number,p_amount:amount,p_payment_method:receipt.method,p_reference:receipt.reference||null,p_allocations:rows});
   if(error)throw error;toast.success('Receipt posted to customer ledger'+(rows.length?' and allocated to invoice':''));setReceipt({number:'RC-'+Date.now().toString(36).toUpperCase(),amount:'',method:'cash',reference:'',invoice:'',allocation:''});await load();
  }catch(e){toast.error(e.message||'Receipt could not be posted')}finally{setBusy(false)}
 }
 async function openSession(e){e.preventDefault();setBusy(true);try{const {error}=await db.rpc('pharmacy_open_cash_session',{p_tenant_id:tenantId,p_branch_id:branch,p_opening_cash:Number(opening||0)});if(error)throw error;toast.success('Cash session opened');setOpening('');await load()}catch(e){toast.error(e.message)}finally{setBusy(false)}}
 async function closeSession(e){e.preventDefault();if(!selectedSession)return;setBusy(true);try{const {error}=await db.rpc('pharmacy_close_cash_session',{p_session_id:selectedSession.id,p_counted_cash:Number(counted),p_notes:notes||null});if(error)throw error;toast.success('Cash session closed and variance recorded');setCounted('');setNotes('');await load()}catch(e){toast.error(e.message)}finally{setBusy(false)}}
 if(!tenantId)return <Card><CardContent className="p-6">Select a workspace to use finance.</CardContent></Card>;
 return <main className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
  <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">PharmaSuite · Finance</p><h1 className="text-3xl font-black">Customer Khata & cashbook</h1><p className="text-sm text-muted-foreground">Append-only customer ledger, invoice allocation and cashier shift reconciliation.</p></div><select className="rounded-md border bg-background p-2 text-sm" value={branch} onChange={e=>setBranch(e.target.value)}>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></header>
  <div className="grid gap-4 lg:grid-cols-2">
   <Card><CardHeader><CardTitle>Customer account</CardTitle></CardHeader><CardContent className="space-y-3">
    <Label>Customer / patient</Label><select className="w-full rounded-md border bg-background p-2 text-sm" value={patient} onChange={e=>{setPatient(e.target.value);setReceipt(v=>({...v,invoice:'',allocation:''}))}}><option value="">Select customer</option>{patients.map(p=><option key={p.id} value={p.id}>{p.full_name} · {p.patient_code}</option>)}</select>
    <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Current balance · debit less credit</p><p className="text-2xl font-bold">{money(customerBalance)}</p></div>
    <form onSubmit={postReceipt} className="space-y-2 border-t pt-3">
     <p className="font-semibold">Post customer receipt</p><Input required value={receipt.number} onChange={e=>setReceipt({...receipt,number:e.target.value})} placeholder="Receipt number"/>
     <Input required type="number" min=".01" step=".01" value={receipt.amount} onChange={e=>setReceipt({...receipt,amount:e.target.value})} placeholder="Receipt amount"/>
     <select className="w-full rounded-md border bg-background p-2 text-sm" value={receipt.method} onChange={e=>setReceipt({...receipt,method:e.target.value})}>{['cash','upi','card','bank_transfer','cheque','other'].map(x=><option key={x} value={x}>{x}</option>)}</select>
     <Input value={receipt.reference} onChange={e=>setReceipt({...receipt,reference:e.target.value})} placeholder="Transaction / cheque reference"/>
     <Label>Allocate to invoice (optional)</Label><select className="w-full rounded-md border bg-background p-2 text-sm" value={receipt.invoice} onChange={e=>{const x=invoices.find(i=>i.id===e.target.value);setReceipt(v=>({...v,invoice:e.target.value,allocation:x?String(x.due):''}))}}><option value="">Keep as unallocated advance</option>{invoices.map(x=><option key={x.id} value={x.id}>{x.reference_number||x.id.slice(0,8)} · due {money(x.due)}</option>)}</select>
     <Input type="number" min="0" step=".01" value={receipt.allocation} onChange={e=>setReceipt({...receipt,allocation:e.target.value})} placeholder="Allocation amount"/>
     <Button disabled={busy||!patient} className="w-full">{busy?'Posting…':'Post receipt'}</Button>
    </form>
   </CardContent></Card>
   <Card><CardHeader><CardTitle>Cashier shift control</CardTitle></CardHeader><CardContent className="space-y-3">
    {selectedSession?<><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Open since {new Date(selectedSession.opened_at).toLocaleString('en-IN')}</p><p className="text-xl font-bold">{money(selectedSession.opening_cash)} opening cash</p><p className="text-xs text-muted-foreground">Entries: {entries.length}</p></div>
     <form onSubmit={closeSession} className="space-y-2"><Label>Physical cash counted</Label><Input required type="number" min="0" step=".01" value={counted} onChange={e=>setCounted(e.target.value)} placeholder="Counted cash"/><Input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Closing notes / variance explanation"/><Button disabled={busy} className="w-full">Close shift & record variance</Button></form>
     <div className="max-h-56 overflow-auto text-sm">{entries.map(x=><div key={x.id} className="flex justify-between border-b py-2"><span>{x.entry_type.replaceAll('_',' ')} · {x.description||x.reference_number||'—'}</span><b className={x.direction==='in'?'text-emerald-700':'text-red-600'}>{x.direction==='in'?'+':'−'}{money(x.amount)}</b></div>)}</div>
    </>:<form onSubmit={openSession} className="space-y-2"><p className="text-sm text-muted-foreground">No open cashier shift for this branch.</p><Label>Opening cash</Label><Input type="number" min="0" step=".01" value={opening} onChange={e=>setOpening(e.target.value)} placeholder="Opening cash balance"/><Button disabled={busy} className="w-full">Open cashier shift</Button></form>}
   </CardContent></Card>
  </div>
  <Card><CardHeader><CardTitle>Customer ledger entries</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Date</th><th className="p-2">Customer</th><th className="p-2">Type</th><th className="p-2">Reference</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th></tr></thead><tbody>{scoped.map(x=><tr key={x.id} className="border-b"><td className="p-2">{x.entry_date}</td><td className="p-2">{patients.find(p=>p.id===x.patient_id)?.full_name||'—'}</td><td className="p-2">{x.entry_type}</td><td className="p-2">{x.reference_number||'—'}</td><td className="p-2 text-right">{Number(x.debit)?money(x.debit):'—'}</td><td className="p-2 text-right">{Number(x.credit)?money(x.credit):'—'}</td></tr>)}</tbody></table>{!scoped.length&&<p className="py-6 text-center text-sm text-muted-foreground">No ledger entries for this branch.</p>}</div></CardContent></Card>
  <p className="text-xs text-muted-foreground">Receipts are immutable ledger credits. Invoice allocations are separately recorded and cannot exceed invoice outstanding. Cash shift close calculates expected cash from posted cashbook entries; payment integrations post into the cashbook as connected workflows are enabled.</p>
 </main>;
}
