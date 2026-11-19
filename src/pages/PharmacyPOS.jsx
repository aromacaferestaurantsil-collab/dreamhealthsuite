import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/layouts/RootLayout';
import { requireSupabase } from '@/lib/supabase';
import { pharmacyCheckoutV2 } from '@/services/healthsuite';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export const route = { path: '/pharmacy/pos', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'ShoppingCart', label: 'POS', section: 'PharmaSuite', order: 11, profiles: ['Admin_c', 'Pharmacist'] };

const money = value => '₹' + Number(value || 0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});

export default function PharmacyPOS() {
  const { activeTenant } = useAuth();
  const tenantId = activeTenant?.tenant_id;
  const [branchId,setBranchId] = useState(activeTenant?.branch_id ?? '');
  const [branches,setBranches] = useState([]);
  const [medicines,setMedicines] = useState([]);
  const [stock,setStock] = useState([]);
  const [search,setSearch] = useState('');
  const [cart,setCart] = useState([]);
  const [payment,setPayment] = useState('cash');
  const [paymentConfirmed,setPaymentConfirmed] = useState(false);
  const [loading,setLoading] = useState(false);
  const [saving,setSaving] = useState(false);

  async function load() {
    if(!tenantId) return;
    setLoading(true);
    try {
      const db=requireSupabase();
      const [b,m,s]=await Promise.all([
        db.from('branches').select('id,name,branch_code').eq('tenant_id',tenantId).eq('status','active').order('name'),
        db.from('medicine_catalogue').select('id,name,generic_name,brand,strength,dosage_form,gst_rate,prescription_required,status').eq('tenant_id',tenantId).eq('status','active').order('name').limit(500),
        db.from('medicine_batches').select('id,medicine_id,batch_number,expiry_date,quantity_on_hand,selling_rate,mrp,branch_id').eq('tenant_id',tenantId).gt('quantity_on_hand',0).order('expiry_date').limit(1500),
      ]);
      if(b.error) throw b.error; if(m.error) throw m.error; if(s.error) throw s.error;
      setBranches(b.data??[]); setMedicines(m.data??[]); setStock(s.data??[]);
      setBranchId(current=>current || activeTenant?.branch_id || b.data?.[0]?.id || '');
    } catch(e) { toast.error(e.message || 'Unable to load pharmacy data'); }
    finally { setLoading(false); }
  }
  useEffect(()=>{load();},[tenantId]);

  const availableFor = medicineId => stock.filter(b=>b.medicine_id===medicineId && b.branch_id===branchId && b.expiry_date>=new Date().toISOString().slice(0,10));
  const filtered=useMemo(()=>medicines.filter(m=>[m.name,m.generic_name,m.brand,m.strength].some(v=>String(v??'').toLowerCase().includes(search.toLowerCase()))),[medicines,search]);
  const subtotal=cart.reduce((n,x)=>n+x.quantity*x.price,0);
  const tax=cart.reduce((n,x)=>n+x.quantity*x.price*x.gst/100,0);
  const total=subtotal+tax;

  function add(medicine) {
    const available=availableFor(medicine.id).reduce((n,b)=>n+Number(b.quantity_on_hand),0);
    const line=cart.find(x=>x.medicineId===medicine.id);
    if(available<=0) return toast.error('No unexpired stock for this medicine in the selected branch');
    if(line?.quantity>=available) return toast.error('Quantity exceeds available stock');
    setCart(old=>line?old.map(x=>x.medicineId===medicine.id?{...x,quantity:x.quantity+1}:x):[...old,{medicineId:medicine.id,name:medicine.name,strength:medicine.strength,quantity:1,price:Number(availableFor(medicine.id)[0]?.selling_rate??0),gst:Number(medicine.gst_rate??0)}]);
  }
  async function checkout() {
    if(!tenantId || !branchId || !cart.length) return toast.error('Select a branch and add at least one medicine');
    if(!paymentConfirmed) return toast.error('Confirm that payment has actually been received before completing the sale');
    setSaving(true);
    try {
      const invoiceNumber='HS-'+Date.now().toString(36).toUpperCase();
      const saleId=await pharmacyCheckoutV2({tenantId,branchId,invoiceNumber,items:cart.map(x=>({medicine_id:x.medicineId,quantity:x.quantity,unit_price:x.price})),paymentMethod:payment,paymentStatus:'paid',idempotencyKey:crypto.randomUUID()});
      toast.success('Sale completed · '+invoiceNumber);
      setCart([]);
      setPaymentConfirmed(false);
      await load();
    } catch(e) { toast.error(e.message || 'Checkout failed'); }
    finally { setSaving(false); }
  }

  if(!tenantId) return <Card><CardContent className="p-6">No active workspace. Create or join a tenant before using Pharmacy POS.</CardContent></Card>;
  return <div className="mx-auto max-w-7xl space-y-5">
    <section className="rounded-2xl bg-primary px-6 py-6 text-primary-foreground"><div className="text-xs font-bold uppercase tracking-widest opacity-80">PharmaSuite · Supabase</div><h1 className="mt-2 text-3xl font-black">Pharmacy POS</h1><p className="mt-2 text-sm opacity-85">Tenant-scoped stock lookup and atomic FEFO checkout.</p></section>
    <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <Card><CardHeader><CardTitle>Medicine catalogue</CardTitle></CardHeader><CardContent className="space-y-3">
        <select aria-label="Branch" value={branchId} onChange={e=>{setBranchId(e.target.value);setCart([]);}} className="w-full rounded-md border bg-background p-2 text-sm"><option value="">Select branch</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name} · {b.branch_code}</option>)}</select>
        <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search medicine, brand or strength" />
        {loading?<p className="text-sm text-muted-foreground">Loading inventory…</p>:<div className="max-h-[560px] space-y-2 overflow-auto">{filtered.map(m=>{const available=availableFor(m.id).reduce((n,b)=>n+Number(b.quantity_on_hand),0);return <div key={m.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><div className="font-semibold">{m.name} {m.strength}</div><div className="text-xs text-muted-foreground">{m.brand??m.generic_name??m.dosage_form??'Medicine'} · Stock {available}</div></div><Button size="sm" disabled={!available || !branchId} onClick={()=>add(m)}>Add</Button></div>;})}{!filtered.length&&<p className="text-sm text-muted-foreground">No medicines found.</p>}</div>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Current sale</CardTitle></CardHeader><CardContent className="space-y-3">
        {cart.map(line=><div key={line.medicineId} className="flex items-center justify-between gap-2 border-b pb-2 text-sm"><div className="min-w-0"><div className="font-medium">{line.name}</div><div className="text-xs text-muted-foreground">{money(line.price)} · GST {line.gst}%</div></div><div className="flex items-center gap-2"><Button size="sm" variant="outline" onClick={()=>setCart(old=>old.map(x=>x.medicineId===line.medicineId?{...x,quantity:Math.max(1,x.quantity-1)}:x))}>−</Button><span>{line.quantity}</span><Button size="sm" variant="outline" onClick={()=>add(medicines.find(m=>m.id===line.medicineId))}>+</Button><Button size="sm" variant="ghost" onClick={()=>setCart(old=>old.filter(x=>x.medicineId!==line.medicineId))}>×</Button></div></div>)}
        {!cart.length&&<p className="text-sm text-muted-foreground">Add medicines to begin a sale.</p>}
        <div className="space-y-1 border-t pt-3 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="flex justify-between"><span>GST</span><span>{money(tax)}</span></div><div className="flex justify-between text-base font-bold"><span>Total</span><span>{money(total)}</span></div></div>
        <select aria-label="Payment method" value={payment} onChange={e=>{setPayment(e.target.value);setPaymentConfirmed(false);}} className="w-full rounded-md border bg-background p-2 text-sm"><option value="cash">Cash</option><option value="card">Card</option><option value="upi">UPI</option><option value="bank_transfer">Bank transfer</option></select>
        <label className="flex items-start gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" checked={paymentConfirmed} onChange={e=>setPaymentConfirmed(e.target.checked)} className="mt-0.5" /><span>I confirm that the customer’s payment has actually been received by the selected method.</span></label>
        <Button className="w-full" disabled={saving || !cart.length || !branchId || !paymentConfirmed} onClick={checkout}>{saving?'Processing…':'Complete paid sale'}</Button>
        <p className="text-xs text-muted-foreground">Checkout is transactional and FEFO-based. A unique request key prevents accidental duplicate submissions; stock and sale records are committed together.</p>
      </CardContent></Card>
    </div>
  </div>;
}
