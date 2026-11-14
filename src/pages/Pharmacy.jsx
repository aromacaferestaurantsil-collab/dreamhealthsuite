import { useMemo, useState } from 'react';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

export const route = { path: '/pharmacy', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'Pill', label: 'PharmaSuite', order: 10, profiles: ['Admin_c'] };

const medicineFields = ['medicine_name_c','generic_name_c','brand_c','strength_c','dosage_form_c','pack_size_c','barcode_c','mrp_c','selling_price_c','purchase_price_c','reorder_level_c','status_c'];
const batchFields = ['medicine_c','branch_c','batch_number_c','expiry_date_c','quantity_on_hand_c','purchase_rate_c','mrp_c','selling_rate_c','status_c'];
const supplierFields = ['supplier_name_c','contact_person_c','phone_c','email_c','gstin_c','address_c','status_c'];
const money = value => '₹' + Number(value || 0).toLocaleString('en-IN',{maximumFractionDigits:2});
const relatedName = value => value?.medicine_name_c || value?.Name || value?.supplier_name_c || '—';

export default function Pharmacy() {
  const [tab,setTab] = useState('overview');
  const [search,setSearch] = useState('');
  const [medicineOpen,setMedicineOpen] = useState(false);
  const [supplierOpen,setSupplierOpen] = useState(false);
  const [batchOpen,setBatchOpen] = useState(false);
  const [saving,setSaving] = useState(false);
  const [medicineForm,setMedicineForm] = useState({medicine_name_c:'',generic_name_c:'',brand_c:'',strength_c:'',dosage_form_c:'Tablet',pack_size_c:'',barcode_c:'',mrp_c:'',selling_price_c:'',purchase_price_c:'',reorder_level_c:'10',prescription_required_c:false,status_c:'Active'});
  const [supplierForm,setSupplierForm] = useState({supplier_name_c:'',contact_person_c:'',phone_c:'',email_c:'',gstin_c:'',address_c:'',status_c:'Active'});
  const [batchForm,setBatchForm] = useState({medicine_c:'',batch_number_c:'',expiry_date_c:'',quantity_on_hand_c:'',purchase_rate_c:'',mrp_c:'',selling_rate_c:'',status_c:'Available'});

  const medicines = useFetch(()=>sdk.table('medicine_catalogue_c').select(medicineFields).orderByDesc('CreatedOn').limit(300).fetch().then(r=>{if(!r.success)throw new Error(r.message);return r.data||[]}),[]);
  const batches = useFetch(()=>sdk.table('medicine_batches_c').select(batchFields).orderByDesc('CreatedOn').limit(500).fetch().then(r=>{if(!r.success)throw new Error(r.message);return r.data||[]}),[]);
  const suppliers = useFetch(()=>sdk.table('pharmacy_suppliers_c').select(supplierFields).orderByDesc('CreatedOn').limit(200).fetch().then(r=>{if(!r.success)throw new Error(r.message);return r.data||[]}),[]);
  const products = medicines.data || [];
  const stock = batches.data || [];
  const vendors = suppliers.data || [];
  const filtered = useMemo(()=>products.filter(item=>[item.medicine_name_c,item.generic_name_c,item.brand_c,item.barcode_c].some(v=>String(v||'').toLowerCase().includes(search.toLowerCase()))),[products,search]);
  const totalUnits = stock.reduce((sum,b)=>sum+Number(b.quantity_on_hand_c||0),0);
  const lowStock = products.filter(p=>stock.filter(b=>(b.medicine_c?.Id||b.medicine_c)===p.Id && b.status_c==='Available').reduce((n,b)=>n+Number(b.quantity_on_hand_c||0),0)<=Number(p.reorder_level_c||0)).length;
  const expiring = stock.filter(b=>b.expiry_date_c && new Date(b.expiry_date_c+'T23:59:59')<new Date(Date.now()+90*86400000) && new Date(b.expiry_date_c+'T23:59:59')>=new Date()).length;

  async function createRecord(table,form,success,after) {
    setSaving(true);
    try {
      const result=await sdk.table(table).create(form);
      if(!result.success || !result.data?.length) throw new Error(result.messages?.[0]||result.message||'Record could not be saved');
      toast.success(success);
      after?.();
      return result.data[0];
    } catch(error) { toast.error(error.message||'Unable to save record'); }
    finally { setSaving(false); }
  }
  async function saveMedicine(e) {
    e.preventDefault();
    if(!medicineForm.medicine_name_c.trim()) return toast.error('Medicine name is required');
    const saved=await createRecord('medicine_catalogue_c',{...medicineForm,mrp_c:Number(medicineForm.mrp_c||0),selling_price_c:Number(medicineForm.selling_price_c||0),purchase_price_c:Number(medicineForm.purchase_price_c||0),reorder_level_c:Number(medicineForm.reorder_level_c||0)},'Medicine added',()=>{setMedicineOpen(false);setMedicineForm({medicine_name_c:'',generic_name_c:'',brand_c:'',strength_c:'',dosage_form_c:'Tablet',pack_size_c:'',barcode_c:'',mrp_c:'',selling_price_c:'',purchase_price_c:'',reorder_level_c:'10',prescription_required_c:false,status_c:'Active'});medicines.run();});
    return saved;
  }
  async function saveSupplier(e) {
    e.preventDefault();
    if(!supplierForm.supplier_name_c.trim()) return toast.error('Supplier name is required');
    await createRecord('pharmacy_suppliers_c',supplierForm,'Supplier added',()=>{setSupplierOpen(false);setSupplierForm({supplier_name_c:'',contact_person_c:'',phone_c:'',email_c:'',gstin_c:'',address_c:'',status_c:'Active'});suppliers.run();});
  }
  async function saveBatch(e) {
    e.preventDefault();
    if(!batchForm.medicine_c||!batchForm.batch_number_c||!batchForm.expiry_date_c||Number(batchForm.quantity_on_hand_c)<=0) return toast.error('Medicine, batch, expiry and a positive quantity are required');
    const medicine=products.find(p=>String(p.Id)===String(batchForm.medicine_c));
    if(!medicine) return toast.error('Select a valid medicine');
    const payload={...batchForm,medicine_c:medicine.Id,quantity_on_hand_c:Number(batchForm.quantity_on_hand_c),purchase_rate_c:Number(batchForm.purchase_rate_c||medicine.purchase_price_c||0),mrp_c:Number(batchForm.mrp_c||medicine.mrp_c||0),selling_rate_c:Number(batchForm.selling_rate_c||medicine.selling_price_c||0)};
    const created=await createRecord('medicine_batches_c',payload,'Batch stock received',async()=>{
      setBatchOpen(false);setBatchForm({medicine_c:'',batch_number_c:'',expiry_date_c:'',quantity_on_hand_c:'',purchase_rate_c:'',mrp_c:'',selling_rate_c:'',status_c:'Available'});batches.run();
    });
    if(created) {
      await sdk.table('pharmacy_stock_movements_c').create({medicine_c:medicine.Id,batch_c:created.Id,movement_type_c:'Purchase',quantity_delta_c:payload.quantity_on_hand_c,unit_cost_c:payload.purchase_rate_c,occurred_at_c:new Date().toISOString(),reference_type_c:'Opening stock'});
    }
  }

  const Field=({label,children})=><div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
  const Refresh=({run})=><Button variant="outline" size="sm" onClick={run}><ApperIcon name="RefreshCw" size={14} className="mr-2"/>Refresh</Button>;

  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><div className="text-xs font-extrabold uppercase tracking-widest text-primary">HealthSuite 360 · Pharmacy operations</div><h1 className="brand-heading mt-1 text-3xl font-black">PharmaSuite</h1><p className="mt-1 text-sm text-muted-foreground">Medicine catalogue, batch inventory, supplier register and stock control.</p></div>
      <div className="flex flex-wrap gap-2">
        <Dialog open={medicineOpen} onOpenChange={setMedicineOpen}><DialogTrigger asChild><Button><ApperIcon name="Plus" size={15} className="mr-2"/>Add medicine</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Add medicine to catalogue</DialogTitle></DialogHeader><form onSubmit={saveMedicine} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Medicine name *"><Input value={medicineForm.medicine_name_c} onChange={e=>setMedicineForm({...medicineForm,medicine_name_c:e.target.value})} required/></Field></div>
          <Field label="Generic / salt"><Input value={medicineForm.generic_name_c} onChange={e=>setMedicineForm({...medicineForm,generic_name_c:e.target.value})}/></Field><Field label="Brand"><Input value={medicineForm.brand_c} onChange={e=>setMedicineForm({...medicineForm,brand_c:e.target.value})}/></Field>
          <Field label="Strength"><Input value={medicineForm.strength_c} onChange={e=>setMedicineForm({...medicineForm,strength_c:e.target.value})} placeholder="e.g. 500 mg"/></Field><Field label="Dosage form"><Select value={medicineForm.dosage_form_c} onValueChange={v=>setMedicineForm({...medicineForm,dosage_form_c:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['Tablet','Capsule','Syrup','Suspension','Injection','Cream','Ointment','Drops','Inhaler','Other'].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Pack size"><Input value={medicineForm.pack_size_c} onChange={e=>setMedicineForm({...medicineForm,pack_size_c:e.target.value})}/></Field><Field label="Barcode"><Input value={medicineForm.barcode_c} onChange={e=>setMedicineForm({...medicineForm,barcode_c:e.target.value})}/></Field>
          <Field label="MRP (₹)"><Input type="number" min="0" step="0.01" value={medicineForm.mrp_c} onChange={e=>setMedicineForm({...medicineForm,mrp_c:e.target.value})}/></Field><Field label="Selling price (₹)"><Input type="number" min="0" step="0.01" value={medicineForm.selling_price_c} onChange={e=>setMedicineForm({...medicineForm,selling_price_c:e.target.value})}/></Field>
          <Field label="Purchase price (₹)"><Input type="number" min="0" step="0.01" value={medicineForm.purchase_price_c} onChange={e=>setMedicineForm({...medicineForm,purchase_price_c:e.target.value})}/></Field><Field label="Reorder level (units)"><Input type="number" min="0" value={medicineForm.reorder_level_c} onChange={e=>setMedicineForm({...medicineForm,reorder_level_c:e.target.value})}/></Field>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={()=>setMedicineOpen(false)}>Cancel</Button><Button disabled={saving}>{saving?'Saving…':'Save medicine'}</Button></div>
        </form></DialogContent></Dialog>
        <Dialog open={batchOpen} onOpenChange={setBatchOpen}><DialogTrigger asChild><Button variant="outline"><ApperIcon name="PackagePlus" size={15} className="mr-2"/>Receive stock</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Receive medicine batch</DialogTitle></DialogHeader><form onSubmit={saveBatch} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Medicine *"><Select value={batchForm.medicine_c} onValueChange={v=>setBatchForm({...batchForm,medicine_c:v})}><SelectTrigger><SelectValue placeholder="Select medicine"/></SelectTrigger><SelectContent>{products.map(p=><SelectItem key={p.Id} value={String(p.Id)}>{p.medicine_name_c} {p.strength_c||''}</SelectItem>)}</SelectContent></Select></Field></div>
          <Field label="Batch number *"><Input value={batchForm.batch_number_c} onChange={e=>setBatchForm({...batchForm,batch_number_c:e.target.value})} required/></Field><Field label="Expiry date *"><Input type="date" value={batchForm.expiry_date_c} onChange={e=>setBatchForm({...batchForm,expiry_date_c:e.target.value})} required/></Field>
          <Field label="Quantity received *"><Input type="number" min="1" value={batchForm.quantity_on_hand_c} onChange={e=>setBatchForm({...batchForm,quantity_on_hand_c:e.target.value})} required/></Field><Field label="Purchase rate (₹)"><Input type="number" min="0" step="0.01" value={batchForm.purchase_rate_c} onChange={e=>setBatchForm({...batchForm,purchase_rate_c:e.target.value})}/></Field>
          <Field label="MRP (₹)"><Input type="number" min="0" step="0.01" value={batchForm.mrp_c} onChange={e=>setBatchForm({...batchForm,mrp_c:e.target.value})}/></Field><Field label="Selling rate (₹)"><Input type="number" min="0" step="0.01" value={batchForm.selling_rate_c} onChange={e=>setBatchForm({...batchForm,selling_rate_c:e.target.value})}/></Field>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={()=>setBatchOpen(false)}>Cancel</Button><Button disabled={saving||!products.length}>{saving?'Saving…':'Receive stock'}</Button></div>
        </form></DialogContent></Dialog>
        <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}><DialogTrigger asChild><Button variant="ghost"><ApperIcon name="Building2" size={15} className="mr-2"/>Add supplier</Button></DialogTrigger><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>New supplier</DialogTitle></DialogHeader><form onSubmit={saveSupplier} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Supplier name *"><Input value={supplierForm.supplier_name_c} onChange={e=>setSupplierForm({...supplierForm,supplier_name_c:e.target.value})} required/></Field></div>
          <Field label="Contact person"><Input value={supplierForm.contact_person_c} onChange={e=>setSupplierForm({...supplierForm,contact_person_c:e.target.value})}/></Field><Field label="Phone"><Input value={supplierForm.phone_c} onChange={e=>setSupplierForm({...supplierForm,phone_c:e.target.value})}/></Field>
          <Field label="Email"><Input type="email" value={supplierForm.email_c} onChange={e=>setSupplierForm({...supplierForm,email_c:e.target.value})}/></Field><Field label="GSTIN"><Input value={supplierForm.gstin_c} onChange={e=>setSupplierForm({...supplierForm,gstin_c:e.target.value.toUpperCase()})} maxLength={15}/></Field>
          <div className="sm:col-span-2"><Field label="Address"><Input value={supplierForm.address_c} onChange={e=>setSupplierForm({...supplierForm,address_c:e.target.value})}/></Field></div>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={()=>setSupplierOpen(false)}>Cancel</Button><Button disabled={saving}>{saving?'Saving…':'Save supplier'}</Button></div>
        </form></DialogContent></Dialog>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[['Medicine catalogue',products.length,'Pill'],['Stock on hand',totalUnits.toLocaleString('en-IN'),'Boxes'],['Low-stock items',lowStock,'AlertTriangle'],['Batches expiring in 90 days',expiring,'CalendarClock']].map(([label,value,icon])=><Card key={label}><CardContent className="flex items-center justify-between p-5"><div><div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div><div className="brand-heading mt-2 text-3xl font-black">{medicines.loading||batches.loading?'—':value}</div></div><div className="rounded-xl bg-secondary p-3 text-primary"><ApperIcon name={icon} size={21}/></div></CardContent></Card>)}
    </div>
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="flex h-auto flex-wrap justify-start"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="medicines">Medicine catalogue</TabsTrigger><TabsTrigger value="inventory">Batch inventory</TabsTrigger><TabsTrigger value="suppliers">Suppliers</TabsTrigger></TabsList>
      <TabsContent value="overview" className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Low stock watchlist</CardTitle><Refresh run={()=>{medicines.run();batches.run();}}/></CardHeader><CardContent>{products.filter(p=>stock.filter(b=>(b.medicine_c?.Id||b.medicine_c)===p.Id&&b.status_c==='Available').reduce((n,b)=>n+Number(b.quantity_on_hand_c||0),0)<=Number(p.reorder_level_c||0)).slice(0,8).map(p=><div key={p.Id} className="flex items-center justify-between border-b py-3 text-sm"><div><div className="font-bold">{p.medicine_name_c}</div><div className="text-xs text-muted-foreground">{p.generic_name_c||p.brand_c||'No generic mapping'}</div></div><Badge variant="destructive">Reorder ≤ {p.reorder_level_c||0}</Badge></div>)}{!lowStock&&<p className="py-5 text-sm text-muted-foreground">No low-stock items based on current reorder levels.</p>}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">Expiry monitoring</CardTitle></CardHeader><CardContent>{stock.filter(b=>b.expiry_date_c&&new Date(b.expiry_date_c+'T23:59:59')<new Date(Date.now()+90*86400000)).slice(0,8).map(b=><div key={b.Id} className="flex items-center justify-between border-b py-3 text-sm"><div><div className="font-bold">{relatedName(b.medicine_c)}</div><div className="text-xs text-muted-foreground">Batch {b.batch_number_c} · {b.expiry_date_c}</div></div><Badge variant={new Date(b.expiry_date_c)<new Date()?'destructive':'secondary'}>{new Date(b.expiry_date_c)<new Date()?'Expired':'Expiring'}</Badge></div>)}{!expiring&&<p className="py-5 text-sm text-muted-foreground">No batches expiring within 90 days.</p>}</CardContent></Card>
        </div>
        <Card><CardHeader><CardTitle className="text-base">Getting started</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3">{[['1','Create medicine catalogue','Add medicine name, generic, brand, strength and prices.'],['2','Register suppliers','Maintain distributor contact and GST details.'],['3','Receive batch stock','Record batch number, expiry and quantities for traceable stock.']].map(([n,t,d])=><div key={n} className="rounded-lg border p-4"><div className="text-xs font-black text-primary">STEP {n}</div><div className="mt-2 font-bold">{t}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{d}</p></div>)}</CardContent></Card>
      </TabsContent>
      <TabsContent value="medicines"><Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="text-base">Medicine catalogue <Badge variant="secondary" className="ml-2">{filtered.length}</Badge></CardTitle><div className="flex gap-2"><Input className="w-64" placeholder="Search name, generic, brand, barcode" value={search} onChange={e=>setSearch(e.target.value)}/><Refresh run={medicines.run}/></div></div></CardHeader><CardContent>{medicines.loading?<p className="py-8 text-sm text-muted-foreground">Loading medicines…</p>:medicines.error?<p className="text-sm text-destructive">{medicines.error}</p>:<div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="py-3">Medicine</th><th>Generic / brand</th><th>Form</th><th>Barcode</th><th>MRP</th><th>Selling</th><th>Status</th></tr></thead><tbody className="divide-y">{filtered.map(p=><tr key={p.Id}><td className="py-3 font-bold">{p.medicine_name_c}<div className="text-xs font-normal text-muted-foreground">{p.strength_c} · {p.pack_size_c}</div></td><td>{p.generic_name_c||'—'}<div className="text-xs text-muted-foreground">{p.brand_c}</div></td><td>{p.dosage_form_c}</td><td>{p.barcode_c||'—'}</td><td>{money(p.mrp_c)}</td><td>{money(p.selling_price_c)}</td><td><Badge variant={p.status_c==='Active'?'default':'secondary'}>{p.status_c}</Badge></td></tr>)}</tbody></table>{!filtered.length&&<p className="py-8 text-center text-sm text-muted-foreground">No medicines match this search.</p>}</div>}</CardContent></Card></TabsContent>
      <TabsContent value="inventory"><Card><CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Batch-wise inventory</CardTitle><Refresh run={batches.run}/></div></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="py-3">Medicine</th><th>Batch</th><th>Expiry</th><th>Qty</th><th>Purchase rate</th><th>Selling rate</th><th>Status</th></tr></thead><tbody className="divide-y">{stock.map(b=><tr key={b.Id}><td className="py-3 font-bold">{relatedName(b.medicine_c)}</td><td>{b.batch_number_c}</td><td>{b.expiry_date_c}</td><td className="font-bold">{b.quantity_on_hand_c}</td><td>{money(b.purchase_rate_c)}</td><td>{money(b.selling_rate_c)}</td><td><Badge variant={b.status_c==='Available'?'default':'secondary'}>{b.status_c}</Badge></td></tr>)}</tbody></table>{!stock.length&&<p className="py-8 text-center text-sm text-muted-foreground">No batch stock recorded yet. Use Receive stock to add the first batch.</p>}</div></CardContent></Card></TabsContent>
      <TabsContent value="suppliers"><Card><CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Supplier register</CardTitle><Refresh run={suppliers.run}/></div></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="py-3">Supplier</th><th>Contact person</th><th>Phone</th><th>Email</th><th>GSTIN</th><th>Status</th></tr></thead><tbody className="divide-y">{vendors.map(v=><tr key={v.Id}><td className="py-3 font-bold">{v.supplier_name_c}</td><td>{v.contact_person_c||'—'}</td><td>{v.phone_c||'—'}</td><td>{v.email_c||'—'}</td><td>{v.gstin_c||'—'}</td><td><Badge variant={v.status_c==='Active'?'default':'secondary'}>{v.status_c}</Badge></td></tr>)}</tbody></table>{!vendors.length&&<p className="py-8 text-center text-sm text-muted-foreground">No suppliers registered yet.</p>}</div></CardContent></Card></TabsContent>
    </Tabs>
    <p className="text-xs leading-5 text-muted-foreground">Initial release: catalogue, supplier register, batch intake, stock ledger and expiry/reorder visibility. GST invoice/POS, purchase reconciliation, returns, barcode scanning, inter-branch transfers and transactional stock deduction are being added in the next PharmaSuite build step. Do not treat this release as a complete pharmacy billing system yet.</p>
  </div>;
}
