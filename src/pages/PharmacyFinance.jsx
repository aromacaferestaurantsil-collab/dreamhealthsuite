import { useEffect,useMemo,useRef,useState } from 'react';
import { useAuth } from '@/layouts/RootLayout';
import { requireSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs,TabsContent,TabsList,TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

export const route={path:'/pharmacy/finance',layout:'owner',access:'authenticated'};
export const nav={icon:'Wallet',label:'Khata & cashbook',section:'PharmaSuite · Finance',order:12,profiles:['Admin_c','Manager','Pharmacist']};
const money=v=>'₹'+Number(v||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const today=()=>new Date().toISOString().slice(0,10);
const methods=['cash','upi','card','bank_transfer','cheque','other'];

export default function PharmacyFinance(){
 const {activeTenant,user}=useAuth(); const db=requireSupabase();
 const tenantId=activeTenant?.tenant_id;
 const [branch,setBranch]=useState(activeTenant?.branch_id||'');
 const [branches,setBranches]=useState([]),[patients,setPatients]=useState([]),[suppliers,setSuppliers]=useState([]);
 const [ledger,setLedger]=useState([]),[allocations,setAllocations]=useState([]),[sessions,setSessions]=useState([]),[entries,setEntries]=useState([]);
 const [orders,setOrders]=useState([]),[supplierPayments,setSupplierPayments]=useState([]),[expenses,setExpenses]=useState([]),[expensePayments,setExpensePayments]=useState([]);
 const [patient,setPatient]=useState('');
 const [receipt,setReceipt]=useState({number:'RC-'+Date.now().toString(36).toUpperCase(),amount:'',method:'cash',reference:'',invoice:'',allocation:''});
 const [supplierPayment,setSupplierPayment]=useState({order:'',amount:'',method:'bank_transfer',reference:''});
 const [expensePayment,setExpensePayment]=useState({expense:'',amount:'',method:'cash',reference:''});
 const [expenseForm,setExpenseForm]=useState({category:'rent',description:'',amount:'',date:today(),supplier:''});
 const [opening,setOpening]=useState(''),[counted,setCounted]=useState(''),[notes,setNotes]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const loadRequest=useRef(0);

 async function load(){
  if(!tenantId){setBranches([]);setPatients([]);setSuppliers([]);setLedger([]);setAllocations([]);setSessions([]);setEntries([]);setOrders([]);setSupplierPayments([]);setExpenses([]);setExpensePayments([]);setLoading(false);return;}
  const request=++loadRequest.current;
  setLoading(true);
  try{
   const [b,p,s,l,a,cs,po,sp,ex,ep]=await Promise.all([
    db.from('branches').select('id,name').eq('tenant_id',tenantId).eq('status','active').order('name'),
    db.from('patients').select('id,full_name,patient_code').eq('tenant_id',tenantId).eq('status','active').order('full_name').limit(1000),
    db.from('pharmacy_suppliers').select('id,name,gstin').eq('tenant_id',tenantId).eq('status','active').order('name').limit(1000),
    db.from('pharmacy_customer_ledger').select('*').eq('tenant_id',tenantId).order('entry_date',{ascending:false}).limit(5000),
    db.from('pharmacy_ledger_allocations').select('*').eq('tenant_id',tenantId).eq('ledger_type','customer').limit(5000),
    db.from('pharmacy_cash_sessions').select('*').eq('tenant_id',tenantId).order('opened_at',{ascending:false}).limit(100),
    db.from('pharmacy_purchase_orders').select('id,branch_id,supplier_id,order_number,supplier_invoice_number,total,status,order_date').eq('tenant_id',tenantId).order('order_date',{ascending:false}).limit(2000),
    db.from('pharmacy_supplier_payments').select('*').eq('tenant_id',tenantId).order('paid_at',{ascending:false}).limit(5000),
    db.from('pharmacy_expenses').select('*').eq('tenant_id',tenantId).order('expense_date',{ascending:false}).limit(5000),
    db.from('pharmacy_expense_payments').select('*').eq('tenant_id',tenantId).order('paid_at',{ascending:false}).limit(5000),
   ]);
   for(const x of [b,p,s,l,a,cs,po,sp,ex,ep])if(x.error)throw x.error;
   if(request!==loadRequest.current)return;
   setBranches(b.data||[]);setPatients(p.data||[]);setSuppliers(s.data||[]);setLedger(l.data||[]);setAllocations(a.data||[]);
   setSessions(cs.data||[]);setOrders(po.data||[]);setSupplierPayments(sp.data||[]);setExpenses(ex.data||[]);setExpensePayments(ep.data||[]);
   const selected=(b.data||[]).some(x=>x.id===branch)?branch:(activeTenant?.branch_id||b.data?.[0]?.id||'');
   setBranch(selected);
   const open=(cs.data||[]).find(x=>x.branch_id===selected&&x.status==='open');
   if(open){const {data,error}=await db.from('pharmacy_cashbook_entries').select('*').eq('tenant_id',tenantId).eq('session_id',open.id).order('occurred_at',{ascending:false}).limit(1000);if(error)throw error;if(request===loadRequest.current)setEntries(data||[])}else if(request===loadRequest.current)setEntries([]);
  }catch(e){if(request===loadRequest.current)toast.error(e.message||'Unable to load finance records')}
  finally{if(request===loadRequest.current)setLoading(false)}
 }
 useEffect(()=>{loadRequest.current++;setBranch(activeTenant?.branch_id||'');setBranches([]);setPatients([]);setSuppliers([]);setLedger([]);setAllocations([]);setSessions([]);setEntries([]);setOrders([]);setSupplierPayments([]);setExpenses([]);setExpensePayments([])},[tenantId,activeTenant?.branch_id]);
 useEffect(()=>{load()},[tenantId,branch]);
 const scoped=ledger.filter(x=>x.branch_id===branch);
 const scopedOrders=orders.filter(x=>x.branch_id===branch);
 const scopedExpenses=expenses.filter(x=>x.branch_id===branch);
 const scopedSupplierPayments=supplierPayments.filter(x=>x.branch_id===branch);
 const scopedExpensePayments=expensePayments.filter(p=>scopedExpenses.some(e=>e.id===p.expense_id));
 const invoices=useMemo(()=>scoped.filter(x=>x.patient_id===patient&&['invoice','opening'].includes(x.entry_type)&&Number(x.debit)>0).map(x=>({...x,paid:allocations.filter(a=>a.invoice_entry_id===x.id).reduce((n,a)=>n+Number(a.amount),0)})).map(x=>({...x,due:Math.max(0,Number(x.debit)-x.paid)})).filter(x=>x.due>0),[scoped,patient,allocations]);
 const selectedSession=sessions.find(x=>x.branch_id===branch&&x.status==='open');
 const customerBalance=patient?scoped.filter(x=>x.patient_id===patient).reduce((n,x)=>n+Number(x.debit)-Number(x.credit),0):0;
 const expensePaid=id=>scopedExpensePayments.filter(x=>x.expense_id===id).reduce((n,x)=>n+Number(x.amount),0);
 const orderPaid=id=>scopedSupplierPayments.filter(x=>x.purchase_order_id===id).reduce((n,x)=>n+Number(x.amount),0);
 const openOrders=scopedOrders.filter(o=>['received','partially_received','part_received'].includes(o.status)&&Number(o.total)-orderPaid(o.id)>.009);
 const unpaidExpenses=scopedExpenses.filter(e=>Number(e.amount)-expensePaid(e.id)>.009);
 const selectedOrder=openOrders.find(x=>x.id===supplierPayment.order);
 const selectedExpense=unpaidExpenses.find(x=>x.id===expensePayment.expense);
 const totalCustomerDue=scoped.reduce((n,x)=>n+Number(x.debit)-Number(x.credit),0);
 const totalSupplierDue=scopedOrders.filter(o=>['received','partially_received','part_received'].includes(o.status)).reduce((n,o)=>n+Math.max(0,Number(o.total)-orderPaid(o.id)),0);
 const totalExpenseDue=unpaidExpenses.reduce((n,e)=>n+Math.max(0,Number(e.amount)-expensePaid(e.id)),0);

 async function postReceipt(e){
  e.preventDefault();if(!patient)return toast.error('Select a customer');
  const amount=Number(receipt.amount);if(!amount||amount<=0)return toast.error('Enter a valid receipt amount');
  const allocation=Number(receipt.allocation||0);if(allocation>amount)return toast.error('Allocated amount cannot exceed receipt amount');
  if(allocation&&(!receipt.invoice||allocation>(invoices.find(i=>i.id===receipt.invoice)?.due||0)))return toast.error('Allocation exceeds the selected invoice balance');
  setBusy(true);try{
   const rows=allocation&&receipt.invoice?[{invoice_entry_id:receipt.invoice,amount:allocation}]:[];
   const {error}=await db.rpc('pharmacy_post_customer_receipt',{p_tenant_id:tenantId,p_branch_id:branch,p_patient_id:patient,p_receipt_number:receipt.number,p_amount:amount,p_payment_method:receipt.method,p_reference:receipt.reference||null,p_allocations:rows});
   if(error)throw error;toast.success('Receipt posted to customer ledger'+(rows.length?' and allocated to invoice':''));setReceipt({number:'RC-'+Date.now().toString(36).toUpperCase(),amount:'',method:'cash',reference:'',invoice:'',allocation:''});await load();
  }catch(e){toast.error(e.message||'Receipt could not be posted')}finally{setBusy(false)}
 }
 async function openSession(e){e.preventDefault();setBusy(true);try{const {error}=await db.rpc('pharmacy_open_cash_session',{p_tenant_id:tenantId,p_branch_id:branch,p_opening_cash:Number(opening||0)});if(error)throw error;toast.success('Cash session opened');setOpening('');await load()}catch(e){toast.error(e.message)}finally{setBusy(false)}}
 async function closeSession(e){e.preventDefault();if(!selectedSession)return;setBusy(true);try{const {error}=await db.rpc('pharmacy_close_cash_session',{p_session_id:selectedSession.id,p_counted_cash:Number(counted),p_notes:notes||null});if(error)throw error;toast.success('Cash session closed and variance recorded');setCounted('');setNotes('');await load()}catch(e){toast.error(e.message)}finally{setBusy(false)}}
 async function createExpense(e){
  e.preventDefault();if(!branch||!expenseForm.description.trim()||Number(expenseForm.amount)<=0)return toast.error('Enter a branch, description and positive amount');
  setBusy(true);try{
   const {error}=await db.from('pharmacy_expenses').insert({tenant_id:tenantId,branch_id:branch,category:expenseForm.category,description:expenseForm.description.trim(),amount:Number(expenseForm.amount),expense_date:expenseForm.date,payment_status:'unpaid',supplier_id:expenseForm.supplier||null,created_by:user?.id||null});
   if(error)throw error;toast.success('Expense recorded');setExpenseForm({category:'rent',description:'',amount:'',date:today(),supplier:''});await load();
  }catch(e){toast.error(e.message||'Expense could not be recorded')}finally{setBusy(false)}
 }
 async function payExpense(e){
  e.preventDefault();if(!selectedExpense)return toast.error('Select an expense');
  const amount=Number(expensePayment.amount),due=Number(selectedExpense.amount)-expensePaid(selectedExpense.id);
  if(!amount||amount<=0||amount>due+.001)return toast.error('Enter a payment within the outstanding expense balance');
  setBusy(true);try{
   const {error}=await db.rpc('pharmacy_record_expense_payment',{p_tenant_id:tenantId,p_expense_id:selectedExpense.id,p_amount:amount,p_payment_method:expensePayment.method,p_reference:expensePayment.reference||null});
   if(error)throw error;toast.success('Expense payment posted');setExpensePayment({expense:'',amount:'',method:'cash',reference:''});await load();
  }catch(e){toast.error(e.message||'Expense payment could not be posted')}finally{setBusy(false)}
 }
 async function paySupplier(e){
  e.preventDefault();if(!selectedOrder)return toast.error('Select a received purchase bill');
  const amount=Number(supplierPayment.amount),due=Number(selectedOrder.total)-orderPaid(selectedOrder.id);
  if(!amount||amount<=0||amount>due+.001)return toast.error('Enter a payment within the supplier bill balance');
  setBusy(true);try{
   const {error}=await db.rpc('pharmacy_record_supplier_payment',{p_tenant_id:tenantId,p_order_id:selectedOrder.id,p_amount:amount,p_payment_method:supplierPayment.method,p_reference:supplierPayment.reference||null});
   if(error)throw error;toast.success('Supplier payment posted');setSupplierPayment({order:'',amount:'',method:'bank_transfer',reference:''});await load();
  }catch(e){toast.error(e.message||'Supplier payment could not be posted')}finally{setBusy(false)}
 }
 if(!tenantId)return <Card><CardContent className="p-6">Select a workspace to use finance.</CardContent></Card>;
 return <main className="mx-auto max-w-7xl space-y-5 p-4 md:p-8">
  <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">PharmaSuite · Finance</p><h1 className="text-3xl font-black">Accounts, expenses & cashbook</h1><p className="text-sm text-muted-foreground">Customer khata, supplier settlements, operating expenses and cashier shift reconciliation.</p></div><select className="rounded-md border bg-background p-2 text-sm" value={branch} onChange={e=>setBranch(e.target.value)}>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></header>
  <div className="grid gap-3 sm:grid-cols-3"><Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Customer net debit</p><p className="text-xl font-bold">{money(totalCustomerDue)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Supplier bill balance</p><p className="text-xl font-bold">{money(totalSupplierDue)}</p></CardContent></Card><Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Unpaid expenses</p><p className="text-xl font-bold">{money(totalExpenseDue)}</p></CardContent></Card></div>
  <Tabs defaultValue="customers"><TabsList className="flex h-auto flex-wrap"><TabsTrigger value="customers">Customer khata</TabsTrigger><TabsTrigger value="suppliers">Supplier payments</TabsTrigger><TabsTrigger value="expenses">Expenses</TabsTrigger><TabsTrigger value="cashbook">Cashbook</TabsTrigger></TabsList>
   <TabsContent value="customers" className="space-y-4">
    <Card><CardHeader><CardTitle>Customer account & receipt</CardTitle></CardHeader><CardContent className="space-y-3">
     <Label>Customer / patient</Label><select className="w-full rounded-md border bg-background p-2 text-sm" value={patient} onChange={e=>{setPatient(e.target.value);setReceipt(v=>({...v,invoice:'',allocation:''}))}}><option value="">Select customer</option>{patients.map(p=><option key={p.id} value={p.id}>{p.full_name} · {p.patient_code}</option>)}</select>
     <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Current balance · debit less credit</p><p className="text-2xl font-bold">{money(customerBalance)}</p></div>
     <form onSubmit={postReceipt} className="grid gap-2 sm:grid-cols-2 border-t pt-3">
      <p className="font-semibold sm:col-span-2">Post customer receipt</p><Input required value={receipt.number} onChange={e=>setReceipt({...receipt,number:e.target.value})} placeholder="Receipt number"/>
      <Input required type="number" min=".01" step=".01" value={receipt.amount} onChange={e=>setReceipt({...receipt,amount:e.target.value})} placeholder="Receipt amount"/>
      <select className="rounded-md border bg-background p-2 text-sm" value={receipt.method} onChange={e=>setReceipt({...receipt,method:e.target.value})}>{methods.map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select>
      <Input value={receipt.reference} onChange={e=>setReceipt({...receipt,reference:e.target.value})} placeholder="Transaction / cheque reference"/>
      <div className="space-y-1 sm:col-span-2"><Label>Allocate to invoice (optional)</Label><select className="w-full rounded-md border bg-background p-2 text-sm" value={receipt.invoice} onChange={e=>{const x=invoices.find(i=>i.id===e.target.value);setReceipt(v=>({...v,invoice:e.target.value,allocation:x?String(x.due):''}))}}><option value="">Keep as unallocated advance</option>{invoices.map(x=><option key={x.id} value={x.id}>{x.reference_number||x.id.slice(0,8)} · due {money(x.due)}</option>)}</select></div>
      <Input type="number" min="0" step=".01" value={receipt.allocation} onChange={e=>setReceipt({...receipt,allocation:e.target.value})} placeholder="Allocation amount"/>
      <Button disabled={busy||!patient}>{busy?'Posting…':'Post receipt'}</Button>
     </form>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Customer ledger entries</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Date</th><th className="p-2">Customer</th><th className="p-2">Type</th><th className="p-2">Reference</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th></tr></thead><tbody>{scoped.map(x=><tr key={x.id} className="border-b"><td className="p-2">{x.entry_date}</td><td className="p-2">{patients.find(p=>p.id===x.patient_id)?.full_name||'—'}</td><td className="p-2">{x.entry_type}</td><td className="p-2">{x.reference_number||'—'}</td><td className="p-2 text-right">{Number(x.debit)?money(x.debit):'—'}</td><td className="p-2 text-right">{Number(x.credit)?money(x.credit):'—'}</td></tr>)}</tbody></table>{!scoped.length&&<p className="py-6 text-center text-sm text-muted-foreground">No ledger entries for this branch.</p>}</div></CardContent></Card>
   </TabsContent>
   <TabsContent value="suppliers" className="space-y-4">
    <Card><CardHeader><CardTitle>Record supplier payment</CardTitle></CardHeader><CardContent><form onSubmit={paySupplier} className="grid gap-3 sm:grid-cols-2">
     <div className="space-y-1 sm:col-span-2"><Label>Received purchase bill</Label><select className="w-full rounded-md border bg-background p-2 text-sm" value={supplierPayment.order} onChange={e=>{const o=openOrders.find(x=>x.id===e.target.value);setSupplierPayment(v=>({...v,order:e.target.value,amount:o?String(Math.max(0,Number(o.total)-orderPaid(o.id))):''}))}}><option value="">Select bill</option>{openOrders.map(o=><option key={o.id} value={o.id}>{suppliers.find(s=>s.id===o.supplier_id)?.name||'Supplier'} · {o.supplier_invoice_number||o.order_number} · due {money(Number(o.total)-orderPaid(o.id))}</option>)}</select></div>
     <div className="space-y-1"><Label>Payment amount ₹</Label><Input type="number" min=".01" step=".01" value={supplierPayment.amount} onChange={e=>setSupplierPayment(v=>({...v,amount:e.target.value}))} required/></div>
     <div className="space-y-1"><Label>Payment method</Label><select className="w-full rounded-md border bg-background p-2 text-sm" value={supplierPayment.method} onChange={e=>setSupplierPayment(v=>({...v,method:e.target.value}))}>{methods.map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></div>
     <Input value={supplierPayment.reference} onChange={e=>setSupplierPayment(v=>({...v,reference:e.target.value}))} placeholder="UTR / cheque / reference"/>
     <Button disabled={busy||!selectedOrder}>Post supplier payment</Button>
    </form></CardContent></Card>
    <Card><CardHeader><CardTitle>Outstanding supplier bills</CardTitle></CardHeader><CardContent className="space-y-2">{openOrders.map(o=><div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><div><b>{suppliers.find(s=>s.id===o.supplier_id)?.name||'Supplier'}</b><p className="text-xs text-muted-foreground">{o.supplier_invoice_number||o.order_number} · {o.order_date} · {o.status}</p></div><div className="text-right"><b>{money(Math.max(0,Number(o.total)-orderPaid(o.id)))}</b><p className="text-xs text-muted-foreground">Bill {money(o.total)} · paid {money(orderPaid(o.id))}</p></div></div>)}{!openOrders.length&&<p className="py-5 text-center text-sm text-muted-foreground">No received supplier bills are outstanding.</p>}</CardContent></Card>
    <Card><CardHeader><CardTitle>Supplier payment history</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Paid at</th><th className="p-2">Supplier</th><th className="p-2">Reference</th><th className="p-2">Method</th><th className="p-2 text-right">Amount</th></tr></thead><tbody>{scopedSupplierPayments.map(p=><tr key={p.id} className="border-b"><td className="p-2">{new Date(p.paid_at).toLocaleString('en-IN')}</td><td className="p-2">{suppliers.find(s=>s.id===p.supplier_id)?.name||'—'}</td><td className="p-2">{p.reference_number||'—'}</td><td className="p-2">{p.payment_method}</td><td className="p-2 text-right">{money(p.amount)}</td></tr>)}</tbody></table>{!scopedSupplierPayments.length&&<p className="py-5 text-center text-sm text-muted-foreground">No supplier payments recorded.</p>}</div></CardContent></Card>
   </TabsContent>
   <TabsContent value="expenses" className="space-y-4">
    <Card><CardHeader><CardTitle>Record operating expense</CardTitle></CardHeader><CardContent><form onSubmit={createExpense} className="grid gap-3 sm:grid-cols-2">
     <div className="space-y-1"><Label>Category</Label><select className="w-full rounded-md border bg-background p-2 text-sm" value={expenseForm.category} onChange={e=>setExpenseForm(v=>({...v,category:e.target.value}))}>{['rent','salary','utilities','transport','maintenance','professional_fees','marketing','other'].map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></div>
     <div className="space-y-1"><Label>Expense date</Label><Input type="date" max={today()} value={expenseForm.date} onChange={e=>setExpenseForm(v=>({...v,date:e.target.value}))} required/></div>
     <div className="space-y-1 sm:col-span-2"><Label>Description</Label><Input value={expenseForm.description} onChange={e=>setExpenseForm(v=>({...v,description:e.target.value}))} required maxLength={240} placeholder="e.g. shop rent for November"/></div>
     <div className="space-y-1"><Label>Amount ₹</Label><Input type="number" min=".01" step=".01" value={expenseForm.amount} onChange={e=>setExpenseForm(v=>({...v,amount:e.target.value}))} required/></div>
     <div className="space-y-1"><Label>Supplier (optional)</Label><select className="w-full rounded-md border bg-background p-2 text-sm" value={expenseForm.supplier} onChange={e=>setExpenseForm(v=>({...v,supplier:e.target.value}))}><option value="">No supplier</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
     <div className="sm:col-span-2"><Button disabled={busy}>Save expense</Button></div>
    </form></CardContent></Card>
    <Card><CardHeader><CardTitle>Pay an expense</CardTitle></CardHeader><CardContent><form onSubmit={payExpense} className="grid gap-3 sm:grid-cols-2">
     <div className="space-y-1 sm:col-span-2"><Label>Outstanding expense</Label><select className="w-full rounded-md border bg-background p-2 text-sm" value={expensePayment.expense} onChange={e=>{const x=unpaidExpenses.find(y=>y.id===e.target.value);setExpensePayment(v=>({...v,expense:e.target.value,amount:x?String(Math.max(0,Number(x.amount)-expensePaid(x.id))):''}))}}><option value="">Select expense</option>{unpaidExpenses.map(x=><option key={x.id} value={x.id}>{x.category} · {x.description} · due {money(Number(x.amount)-expensePaid(x.id))}</option>)}</select></div>
     <div className="space-y-1"><Label>Payment amount ₹</Label><Input type="number" min=".01" step=".01" value={expensePayment.amount} onChange={e=>setExpensePayment(v=>({...v,amount:e.target.value}))} required/></div>
     <div className="space-y-1"><Label>Payment method</Label><select className="w-full rounded-md border bg-background p-2 text-sm" value={expensePayment.method} onChange={e=>setExpensePayment(v=>({...v,method:e.target.value}))}>{methods.map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></div>
     <Input value={expensePayment.reference} onChange={e=>setExpensePayment(v=>({...v,reference:e.target.value}))} placeholder="Transaction reference"/>
     <Button disabled={busy||!selectedExpense}>Post expense payment</Button>
    </form></CardContent></Card>
    <Card><CardHeader><CardTitle>Expense register</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Date</th><th className="p-2">Category</th><th className="p-2">Description</th><th className="p-2">Status</th><th className="p-2 text-right">Amount</th><th className="p-2 text-right">Balance</th></tr></thead><tbody>{scopedExpenses.map(x=><tr key={x.id} className="border-b"><td className="p-2">{x.expense_date}</td><td className="p-2">{x.category}</td><td className="p-2">{x.description}</td><td className="p-2">{x.payment_status}</td><td className="p-2 text-right">{money(x.amount)}</td><td className="p-2 text-right">{money(Math.max(0,Number(x.amount)-expensePaid(x.id)))}</td></tr>)}</tbody></table>{!scopedExpenses.length&&<p className="py-5 text-center text-sm text-muted-foreground">No expenses recorded.</p>}</div></CardContent></Card>
   </TabsContent>
   <TabsContent value="cashbook" className="space-y-4">
    <Card><CardHeader><CardTitle>Cashier shift control</CardTitle></CardHeader><CardContent className="space-y-3">
     {selectedSession?<><div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Open since {new Date(selectedSession.opened_at).toLocaleString('en-IN')}</p><p className="text-xl font-bold">{money(selectedSession.opening_cash)} opening cash</p><p className="text-xs text-muted-foreground">Entries: {entries.length}</p></div><form onSubmit={closeSession} className="space-y-2"><Label>Physical cash counted</Label><Input required type="number" min="0" step=".01" value={counted} onChange={e=>setCounted(e.target.value)} placeholder="Counted cash"/><Input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Closing notes / variance explanation"/><Button disabled={busy} className="w-full">Close shift & record variance</Button></form><div className="max-h-72 overflow-auto text-sm">{entries.map(x=><div key={x.id} className="flex justify-between border-b py-2"><span>{x.entry_type.replaceAll('_',' ')} · {x.description||x.reference_number||'—'}</span><b className={x.direction==='in'?'text-emerald-700':'text-red-600'}>{x.direction==='in'?'+':'−'}{money(x.amount)}</b></div>)}</div></>:<form onSubmit={openSession} className="space-y-2"><p className="text-sm text-muted-foreground">No open cashier shift for this branch.</p><Label>Opening cash</Label><Input type="number" min="0" step=".01" value={opening} onChange={e=>setOpening(e.target.value)} placeholder="Opening cash balance"/><Button disabled={busy} className="w-full">Open cashier shift</Button></form>}
    </CardContent></Card>
   </TabsContent>
  </Tabs>
  <p className="text-xs text-muted-foreground">Supplier and expense payments are posted through server-side RPCs with balance validation. Customer receipts and cashier sessions are immutable ledger operations. Records are restricted to the selected branch by row-level security.</p>
 </main>;
}
