import { useMemo, useState } from 'react';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export const route = { path: '/pharmacy/pos', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'ShoppingCart', label: 'Pharmacy POS', order: 11, profiles: ['Admin_c'] };

const money = value => '₹' + Number(value || 0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const medicineFields = ['medicine_name_c','generic_name_c','brand_c','strength_c','dosage_form_c','barcode_c','selling_price_c','mrp_c','gst_rate_c','prescription_required_c','status_c'];
const batchFields = ['medicine_c','batch_number_c','expiry_date_c','quantity_on_hand_c','selling_rate_c','mrp_c','purchase_rate_c','status_c'];

export default function PharmacyPOS() {
  const [search,setSearch] = useState('');
  const [cart,setCart] = useState([]);
  const [discount,setDiscount] = useState('0');
  const [payment,setPayment] = useState('Cash');
  const [paymentStatus,setPaymentStatus] = useState('Paid');
  const [prescription,setPrescription] = useState('');
  const [saving,setSaving] = useState(false);
  const medicines = useFetch(()=>sdk.table('medicine_catalogue_c').select(medicineFields).where(window.ApperSDK.CoreSDK.eq('status_c','Active')).limit(500).fetch().then(r=>{if(!r.success)throw new Error(r.message);return r.data||[]}),[]);
  const batches = useFetch(()=>sdk.table('medicine_batches_c').select(batchFields).where(window.ApperSDK.CoreSDK.eq('status_c','Available')).limit(1000).fetch().then(r=>{if(!r.success)throw new Error(r.message);return r.data||[]}),[]);
  const sales = useFetch(()=>sdk.table('pharmacy_sales_c').select(['invoice_number_c','sale_date_c','grand_total_c','payment_method_c','payment_status_c']).orderByDesc('CreatedOn').limit(12).fetch().then(r=>{if(!r.success)throw new Error(r.message);return r.data||[]}),[]);
  const productRows=medicines.data||[];
  const batchRows=batches.data||[];
  const availableFor = medicineId => batchRows
    .filter(b=>String(b.medicine_c?.Id||b.medicine_c)===String(medicineId)&&b.status_c==='Available'&&Number(b.quantity_on_hand_c)>0&&b.expiry_date_c&&new Date(b.expiry_date_c+'T23:59:59')>=new Date())
    .sort((a,b)=>String(a.expiry_date_c).localeCompare(String(b.expiry_date_c)));
  const filtered=productRows.filter(p=>[p.medicine_name_c,p.generic_name_c,p.brand_c,p.barcode_c].some(v=>String(v||'').toLowerCase().includes(search.toLowerCase())));
  const subtotal=cart.reduce((sum,line)=>sum+line.qty*line.price,0);
  const tax=cart.reduce((sum,line)=>sum+line.qty*line.price*line.gst/100,0);
  const discountAmount=Math.min(Math.max(0,Number(discount)||0),subtotal+tax);
  const total=Math.max(0,subtotal+tax-discountAmount);
  const prescriptionNeeded=cart.some(line=>line.prescriptionRequired);

  function addMedicine(medicine) {
    const batchesForMedicine=availableFor(medicine.Id);
    const current=cart.find(line=>String(line.medicineId)===String(medicine.Id));
    const available=batchesForMedicine.reduce((n,b)=>n+Number(b.quantity_on_hand_c||0),0);
    if(available<=0) return toast.error('No unexpired stock available for this medicine');
    if(current?.qty>=available) return toast.error('Requested quantity exceeds available stock');
    setCart(old=>current?old.map(line=>line.medicineId===medicine.Id?{...line,qty:line.qty+1}:line):[...old,{medicineId:medicine.Id,name:medicine.medicine_name_c,strength:medicine.strength_c,qty:1,price:Number(medicine.selling_price_c||medicine.mrp_c||0),gst:Number(medicine.gst_rate_c||0),prescriptionRequired:Boolean(medicine.prescription_required_c)}]);
  }
  function changeQty(medicineId,value) {
    const line=cart.find(x=>String(x.medicineId)===String(medicineId));
    const qty=Math.max(0,Math.floor(Number(value)||0));
    const available=availableFor(medicineId).reduce((n,b)=>n+Number(b.quantity_on_hand_c||0),0);
    if(qty>available) return toast.error('Quantity exceeds available unexpired stock');
    setCart(old=>qty===0?old.filter(x=>String(x.medicineId)!==String(medicineId)):old.map(x=>String(x.medicineId)===String(medicineId)?{...x,qty}:x));
  }
  async function checkout() {
    if(!cart.length) return toast.error('Add at least one medicine');
    if(prescriptionNeeded&&!prescription.trim()) return toast.error('A prescription reference is required for one or more selected medicines');
    setSaving(true);
    let saleId=null;
    const createdBatchChanges=[];
    try {
      const invoice='PH-' + new Date().toISOString().slice(0,10).replaceAll('-','') + '-' + Math.random().toString(36).slice(2,7).toUpperCase();
      const saleResult=await sdk.table('pharmacy_sales_c').create({
        invoice_number_c:invoice,
        sale_date_c:new Date().toISOString(),
        sale_type_c:prescriptionNeeded?'Prescription':'Retail',
        subtotal_c:subtotal,
        discount_c:discountAmount,
        tax_total_c:tax,
        grand_total_c:total,
        payment_method_c:payment,
        payment_status_c:paymentStatus,
        prescription_reference_c:prescription||''
      });
      if(!saleResult.success||!saleResult.data?.length) throw new Error(saleResult.messages?.[0]||saleResult.message||'Could not create invoice');
      saleId=saleResult.data[0].Id;
      for(const line of cart) {
        let remaining=line.qty;
        const allocations=availableFor(line.medicineId);
        const needed=allocations.reduce((n,b)=>n+Number(b.quantity_on_hand_c||0),0);
        if(needed<remaining) throw new Error('Stock changed during checkout for '+line.name+'. Refresh and retry.');
        for(const batch of allocations) {
          if(remaining<=0) break;
          const take=Math.min(remaining,Number(batch.quantity_on_hand_c||0));
          if(take<=0) continue;
          const unitCost=Number(batch.purchase_rate_c||0);
          const batchId=batch.Id;
          const itemResult=await sdk.table('pharmacy_sale_items_c').create({sale_c:saleId,medicine_c:line.medicineId,batch_c:batchId,quantity_c:take,unit_price_c:line.price,discount_c:0,gst_rate_c:line.gst,line_total_c:take*line.price*(1+line.gst/100)});
          if(!itemResult.success||!itemResult.data?.length) throw new Error(itemResult.messages?.[0]||'Could not save invoice item');
          const updateResult=await sdk.table('medicine_batches_c').update({Id:batchId,quantity_on_hand_c:Number(batch.quantity_on_hand_c)-take});
          if(!updateResult.success||!updateResult.data?.length) throw new Error(updateResult.messages?.[0]||'Could not deduct batch stock');
          createdBatchChanges.push({batchId,before:Number(batch.quantity_on_hand_c),take,medicineId:line.medicineId,unitCost});
          const movement=await sdk.table('pharmacy_stock_movements_c').create({medicine_c:line.medicineId,batch_c:batchId,movement_type_c:'Sale',reference_type_c:'Pharmacy sale',reference_id_c:String(saleId),quantity_delta_c:-take,unit_cost_c:unitCost,occurred_at_c:new Date().toISOString(),notes_c:invoice});
          if(!movement.success) throw new Error(movement.messages?.[0]||'Could not record stock movement');
          remaining-=take;
        }
      }
      toast.success('Invoice '+invoice+' recorded · '+money(total));
      setCart([]);
      setDiscount('0');
      setPrescription('');
      batches.run();
      sales.run();
    } catch(error) {
      toast.error('Checkout interrupted: '+error.message+'. Review the invoice and stock ledger before retrying; do not submit the same sale twice.');
    } finally {
      setSaving(false);
    }
  }

  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><Link to="/pharmacy" className="text-sm font-bold text-muted-foreground hover:text-foreground">← PharmaSuite</Link><div className="mt-2 text-xs font-extrabold uppercase tracking-widest text-primary">Retail and prescription billing</div><h1 className="brand-heading mt-1 text-3xl font-black">Pharmacy POS</h1><p className="mt-1 text-sm text-muted-foreground">Select medicines, allocate earliest-expiry stock and prepare an invoice.</p></div>
      <Badge variant="outline">FEFO batch allocation</Badge>
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <Card><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>Medicine selection</CardTitle><Badge variant="secondary">{filtered.length} items</Badge></div><Input placeholder="Search medicine, generic, brand or scan barcode" value={search} onChange={e=>setSearch(e.target.value)}/></CardHeader><CardContent className="max-h-[65vh] space-y-2 overflow-y-auto">
        {filtered.map(p=>{const qty=availableFor(p.Id).reduce((n,b)=>n+Number(b.quantity_on_hand_c||0),0);return <div key={p.Id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><div className="font-bold">{p.medicine_name_c} {p.strength_c||''}</div><div className="text-xs text-muted-foreground">{p.generic_name_c||p.brand_c||p.dosage_form_c} · Stock {qty} · {money(p.selling_price_c||p.mrp_c)}</div>{p.prescription_required_c&&<Badge variant="outline" className="mt-1">Prescription required</Badge>}</div><Button size="sm" disabled={qty<=0} onClick={()=>addMedicine(p)}><ApperIcon name="Plus" size={14} className="mr-1"/>Add</Button></div>})}
        {!filtered.length&&<p className="py-8 text-center text-sm text-muted-foreground">No matching medicines.</p>}
      </CardContent></Card>
      <div className="space-y-4">
        <Card><CardHeader><CardTitle>Current bill</CardTitle></CardHeader><CardContent className="space-y-3">
          {cart.map(line=><div key={line.medicineId} className="border-b pb-3"><div className="flex items-start justify-between gap-2"><div className="font-bold">{line.name} {line.strength}</div><Button size="icon" variant="ghost" onClick={()=>changeQty(line.medicineId,0)}><ApperIcon name="Trash2" size={15}/></Button></div><div className="mt-2 flex items-center justify-between gap-3"><Input className="w-20" type="number" min="1" value={line.qty} onChange={e=>changeQty(line.medicineId,e.target.value)}/><div className="text-right text-sm">{money(line.price)} × {line.qty}<div className="font-bold">{money(line.qty*line.price)}</div></div></div></div>)}
          {!cart.length&&<p className="py-6 text-center text-sm text-muted-foreground">No items added. Search and add medicines to begin.</p>}
          <div className="space-y-2 border-t pt-3 text-sm"><div className="flex justify-between"><span>Subtotal</span><b>{money(subtotal)}</b></div><div className="flex justify-between"><span>GST (calculated by item rate)</span><b>{money(tax)}</b></div><div className="flex items-center justify-between gap-3"><Label>Discount (₹)</Label><Input className="w-28" type="number" min="0" step="0.01" value={discount} onChange={e=>setDiscount(e.target.value)}/></div><div className="flex justify-between border-t pt-3 text-lg"><b>Total</b><b>{money(total)}</b></div></div>
          <div className="space-y-3"><div><Label>Payment method</Label><Select value={payment} onValueChange={setPayment}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['Cash','UPI','Card','Insurance','Credit','Mixed'].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div><div><Label>Payment status</Label><Select value={paymentStatus} onValueChange={setPaymentStatus}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['Paid','Partially Paid','Due'].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>{prescriptionNeeded&&<div><Label>Prescription reference *</Label><Input value={prescription} onChange={e=>setPrescription(e.target.value)} placeholder="Prescription / doctor reference"/></div>}</div>
          <Button className="w-full" disabled={!cart.length||saving} onClick={checkout}>{saving?'Processing invoice…':'Complete sale · '+money(total)}</Button>
          <Button className="w-full" variant="outline" disabled={!cart.length||saving} onClick={()=>setCart([])}>Clear bill</Button>
        </CardContent></Card>
        <Card><CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Recent invoices</CardTitle><Button variant="ghost" size="sm" onClick={sales.run}>Refresh</Button></div></CardHeader><CardContent className="space-y-2">{(sales.data||[]).map((s,i)=><div key={s.Id||i} className="flex items-center justify-between gap-3 border-b py-2 text-sm"><div><div className="font-bold">{s.invoice_number_c}</div><div className="text-xs text-muted-foreground">{s.sale_date_c?new Date(s.sale_date_c).toLocaleString():''} · {s.payment_status_c}</div></div><b>{money(s.grand_total_c)}</b></div>)}{!sales.loading&&!(sales.data||[]).length&&<p className="text-sm text-muted-foreground">No invoices recorded yet.</p>}</CardContent></Card>
      </div>
    </div>
    <p className="text-xs leading-5 text-muted-foreground">This first POS workflow uses FEFO allocation and writes sale, line items and stock movements. Multi-user concurrent stock protection and all-or-nothing database transactions require a server-side transactional operation; until that is added, reconcile interrupted checkouts before retrying. GST rates must be configured against the applicable medicine classification and invoice requirements before live tax filing.</p>
  </div>;
}
