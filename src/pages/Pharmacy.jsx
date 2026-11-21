import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/layouts/RootLayout';
import { requireSupabase } from '@/lib/supabase';
import { pharmacyReceiveOpeningBatch } from '@/services/healthsuite';
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
export const nav = { icon: 'Pill', label: 'Inventory', section: 'PharmaSuite · Inventory', order: 10, profiles: ['Admin_c','Manager','Pharmacist'] };

const money = value => '₹' + Number(value || 0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const today = () => new Date().toISOString().slice(0,10);
const blankMedicine = () => ({sku:'',name:'',generic_name:'',brand:'',strength:'',dosage_form:'Tablet',unit:'unit',hsn_code:'',gst_rate:'0',reorder_level:'10',units_per_pack:'1',allow_loose_sale:true,prescription_required:false,status:'active'});
const blankSupplier = () => ({name:'',contact_person:'',phone:'',email:'',gstin:'',address:'',status:'active'});
const blankBatch = () => ({medicine_id:'',supplier_id:'',batch_number:'',expiry_date:'',quantity_on_hand:'',purchase_rate:'',mrp:'',selling_rate:''});

export default function Pharmacy() {
  const { activeTenant } = useAuth();
  const tenantId = activeTenant?.tenant_id;
  const [branchId,setBranchId] = useState(activeTenant?.branch_id ?? '');
  const [branches,setBranches] = useState([]);
  const [tab,setTab] = useState('overview');
  const [search,setSearch] = useState('');
  const [medicines,setMedicines] = useState([]);
  const [batches,setBatches] = useState([]);
  const [suppliers,setSuppliers] = useState([]);
  const [loading,setLoading] = useState(false);
  const [saving,setSaving] = useState(false);
  const [medicineOpen,setMedicineOpen] = useState(false);
  const [medicineEditId,setMedicineEditId] = useState('');
  const [supplierOpen,setSupplierOpen] = useState(false);
  const [supplierEditId,setSupplierEditId] = useState('');
  const [batchOpen,setBatchOpen] = useState(false);
  const [medicineForm,setMedicineForm] = useState(blankMedicine);
  const [supplierForm,setSupplierForm] = useState(blankSupplier);
  const [batchForm,setBatchForm] = useState(blankBatch);
  const loadRequest = useRef(0);

  async function load() {
    if(!tenantId) { setBranches([]);setMedicines([]);setBatches([]);setSuppliers([]);setLoading(false);return; }
    const request=++loadRequest.current;
    setLoading(true);
    try {
      const db=requireSupabase();
      const [b,m,sup] = await Promise.all([
        db.from('branches').select('id,name,branch_code,status').eq('tenant_id',tenantId).eq('status','active').order('name'),
        db.from('medicine_catalogue').select('id,sku,name,generic_name,brand,strength,dosage_form,unit,hsn_code,gst_rate,reorder_level,units_per_pack,allow_loose_sale,prescription_required,status').eq('tenant_id',tenantId).order('name').limit(500),
        db.from('pharmacy_suppliers').select('id,name,contact_person,phone,email,gstin,address,status').eq('tenant_id',tenantId).order('name').limit(500),
      ]);
      if(b.error) throw b.error; if(m.error) throw m.error; if(sup.error) throw sup.error;
      if(request!==loadRequest.current)return;
      const selectedBranch = branchId || activeTenant?.branch_id || b.data?.[0]?.id || '';
      setBranches(b.data??[]); setBranchId(selectedBranch);
      setMedicines(m.data??[]); setSuppliers(sup.data??[]);
      if(selectedBranch) {
        const {data,error}=await db.from('medicine_batches')
          .select('id,tenant_id,branch_id,medicine_id,supplier_id,batch_number,expiry_date,quantity_on_hand,purchase_rate,mrp,selling_rate,received_at')
          .eq('tenant_id',tenantId).eq('branch_id',selectedBranch).order('expiry_date').limit(2000);
        if(error) throw error;
        if(request===loadRequest.current)setBatches(data??[]);
      } else if(request===loadRequest.current)setBatches([]);
    } catch(e) { if(request===loadRequest.current)toast.error(e.message || 'Unable to load pharmacy records'); }
    finally { if(request===loadRequest.current)setLoading(false); }
  }
  useEffect(()=>{loadRequest.current++;setBranchId(activeTenant?.branch_id??'');setBranches([]);setMedicines([]);setBatches([]);setSuppliers([]);},[tenantId,activeTenant?.branch_id]);
  useEffect(()=>{load();},[tenantId,branchId]);

  const filtered=useMemo(()=>medicines.filter(m=>[m.name,m.generic_name,m.brand,m.sku,m.hsn_code].some(v=>String(v??'').toLowerCase().includes(search.toLowerCase()))),[medicines,search]);
  const totalUnits=batches.reduce((n,b)=>n+Number(b.quantity_on_hand||0),0);
  const onHand=medicineId=>batches.filter(b=>b.medicine_id===medicineId && b.expiry_date>=today()).reduce((n,b)=>n+Number(b.quantity_on_hand||0),0);
  const lowStock=medicines.filter(m=>onHand(m.id)<=Number(m.reorder_level||0)).length;
  const expiring=batches.filter(b=>b.expiry_date>=today()&&b.expiry_date<=new Date(Date.now()+90*86400000).toISOString().slice(0,10)&&Number(b.quantity_on_hand)>0).length;
  const previousPurchaseRate=medicineId=>batches.filter(b=>b.medicine_id===medicineId&&Number(b.purchase_rate)>0).sort((a,b)=>String(b.received_at||'').localeCompare(String(a.received_at||'')))[0]?.purchase_rate;
  const lastPurchaseRate=previousPurchaseRate(batchForm.medicine_id);
  const purchaseRateIncrease=lastPurchaseRate!==undefined&&Number(batchForm.purchase_rate)>Number(lastPurchaseRate);
  const purchaseRateChange=lastPurchaseRate!==undefined&&Number(lastPurchaseRate)>0?((Number(batchForm.purchase_rate)-Number(lastPurchaseRate))/Number(lastPurchaseRate))*100:0;
  const purchaseAsMrp=batchForm.mrp&&Number(batchForm.mrp)>0?(Number(batchForm.purchase_rate)/Number(batchForm.mrp))*100:0;
  const Field=({label,children})=><div className="space-y-1.5"><Label>{label}</Label>{children}</div>;

  async function saveMedicine(e) {
    e.preventDefault(); if(!tenantId) return;
    if(!medicineForm.name.trim()) return toast.error('Medicine name is required');
    const gst=Number(medicineForm.gst_rate||0),reorder=Number(medicineForm.reorder_level||0),pack=Number(medicineForm.units_per_pack||1);
    if(!Number.isFinite(gst)||gst<0||gst>100)return toast.error('GST rate must be between 0 and 100');
    if(!Number.isFinite(reorder)||reorder<0)return toast.error('Reorder level cannot be negative');
    if(!Number.isFinite(pack)||pack<=0)return toast.error('Units per pack must be greater than zero');
    setSaving(true);
    try {
      const payload={...medicineForm,tenant_id:tenantId,gst_rate:gst,reorder_level:reorder,units_per_pack:pack,allow_loose_sale:Boolean(medicineForm.allow_loose_sale)};
      const db=requireSupabase();
      const result=medicineEditId
        ? await db.from('medicine_catalogue').update(payload).eq('tenant_id',tenantId).eq('id',medicineEditId)
        : await db.from('medicine_catalogue').insert(payload);
      if(result.error) throw result.error;
      toast.success(medicineEditId?'Medicine updated':'Medicine added');
      setMedicineOpen(false);setMedicineEditId('');setMedicineForm(blankMedicine());await load();
    } catch(e){toast.error(e.message||'Unable to save medicine');}
    finally{setSaving(false);}
  }
  function editMedicine(m){
    setMedicineEditId(m.id);
    setMedicineForm({sku:m.sku??'',name:m.name??'',generic_name:m.generic_name??'',brand:m.brand??'',strength:m.strength??'',dosage_form:m.dosage_form??'Tablet',unit:m.unit??'unit',hsn_code:m.hsn_code??'',gst_rate:String(m.gst_rate??0),reorder_level:String(m.reorder_level??0),units_per_pack:String(m.units_per_pack??1),allow_loose_sale:Boolean(m.allow_loose_sale),prescription_required:Boolean(m.prescription_required),status:m.status??'active'});
    setMedicineOpen(true);
  }
  async function setMedicineStatus(m,status){
    setSaving(true);
    try{const {error}=await requireSupabase().from('medicine_catalogue').update({status}).eq('tenant_id',tenantId).eq('id',m.id);if(error)throw error;toast.success('Medicine status updated');await load();}
    catch(e){toast.error(e.message||'Unable to update medicine status');}
    finally{setSaving(false);}
  }
  async function saveSupplier(e) {
    e.preventDefault(); if(!tenantId) return;
    if(!supplierForm.name.trim()) return toast.error('Supplier name is required');
    setSaving(true);
    try {
      const payload={...supplierForm,tenant_id:tenantId,address:supplierForm.address?{line1:supplierForm.address}:{}};
      const db=requireSupabase();
      const result=supplierEditId
        ? await db.from('pharmacy_suppliers').update(payload).eq('tenant_id',tenantId).eq('id',supplierEditId)
        : await db.from('pharmacy_suppliers').insert(payload);
      if(result.error) throw result.error;
      toast.success(supplierEditId?'Supplier updated':'Supplier added');
      setSupplierOpen(false);setSupplierEditId('');setSupplierForm(blankSupplier());await load();
    } catch(e){toast.error(e.message||'Unable to save supplier');}
    finally{setSaving(false);}
  }
  function editSupplier(s){
    setSupplierEditId(s.id);
    const address=s.address?.line1??'';
    setSupplierForm({name:s.name??'',contact_person:s.contact_person??'',phone:s.phone??'',email:s.email??'',gstin:s.gstin??'',address,status:s.status??'active'});
    setSupplierOpen(true);
  }
  async function setSupplierStatus(s,status){
    setSaving(true);
    try{const {error}=await requireSupabase().from('pharmacy_suppliers').update({status}).eq('tenant_id',tenantId).eq('id',s.id);if(error)throw error;toast.success('Supplier status updated');await load();}
    catch(e){toast.error(e.message||'Unable to update supplier status');}
    finally{setSaving(false);}
  }
  async function saveBatch(e) {
    e.preventDefault(); if(!tenantId||!branchId) return toast.error('Select a branch first');
    const medicine=medicines.find(m=>m.id===batchForm.medicine_id);
    if(!medicine||!batchForm.batch_number.trim()||!batchForm.expiry_date||Number(batchForm.quantity_on_hand)<=0) return toast.error('Medicine, batch number, expiry and positive quantity are required');
    if(batchForm.expiry_date<today()) return toast.error('Cannot receive an already expired batch');
    setSaving(true);
    try {
      const qty=Number(batchForm.quantity_on_hand);
      await pharmacyReceiveOpeningBatch({
        tenantId,branchId,medicineId:medicine.id,supplierId:batchForm.supplier_id,
        batchNumber:batchForm.batch_number.trim(),expiryDate:batchForm.expiry_date,quantity:qty,
        purchaseRate:Number(batchForm.purchase_rate||0),mrp:Number(batchForm.mrp||0),sellingRate:Number(batchForm.selling_rate||0),
      });
      toast.success('Batch received and stock movement recorded');setBatchOpen(false);setBatchForm(blankBatch());await load();
    } catch(e){toast.error(e.message||'Unable to receive batch');}
    finally{setSaving(false);}
  }

  if(!tenantId) return <Card><CardContent className="p-6">Create or join a workspace before using PharmaSuite.</CardContent></Card>;
  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><div className="text-xs font-extrabold uppercase tracking-widest text-primary">HealthSuite 360 · Pharmacy operations</div><h1 className="brand-heading mt-1 text-3xl font-black">PharmaSuite</h1><p className="mt-1 text-sm text-muted-foreground">Tenant-scoped medicine catalogue, supplier register, batch inventory and expiry control.</p></div>
      <div className="flex flex-wrap gap-2">
        <Dialog open={medicineOpen} onOpenChange={open=>{setMedicineOpen(open);if(!open){setMedicineEditId('');setMedicineForm(blankMedicine());}}}><DialogTrigger asChild><Button onClick={()=>{setMedicineEditId('');setMedicineForm(blankMedicine());}}>Add medicine</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{medicineEditId?'Edit medicine':'Add medicine to catalogue'}</DialogTitle></DialogHeader><form onSubmit={saveMedicine} className="grid gap-4 sm:grid-cols-2">
          <Field label="Medicine name *"><Input value={medicineForm.name} onChange={e=>setMedicineForm({...medicineForm,name:e.target.value})} required/></Field><Field label="SKU"><Input value={medicineForm.sku} onChange={e=>setMedicineForm({...medicineForm,sku:e.target.value})}/></Field>
          <Field label="Generic / salt"><Input value={medicineForm.generic_name} onChange={e=>setMedicineForm({...medicineForm,generic_name:e.target.value})}/></Field><Field label="Brand"><Input value={medicineForm.brand} onChange={e=>setMedicineForm({...medicineForm,brand:e.target.value})}/></Field>
          <Field label="Strength"><Input value={medicineForm.strength} onChange={e=>setMedicineForm({...medicineForm,strength:e.target.value})} placeholder="e.g. 500 mg"/></Field><Field label="Dosage form"><Select value={medicineForm.dosage_form} onValueChange={v=>setMedicineForm({...medicineForm,dosage_form:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['Tablet','Capsule','Syrup','Suspension','Injection','Cream','Ointment','Drops','Inhaler','Other'].map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Unit"><Input value={medicineForm.unit} onChange={e=>setMedicineForm({...medicineForm,unit:e.target.value})}/></Field><Field label="HSN code"><Input value={medicineForm.hsn_code} onChange={e=>setMedicineForm({...medicineForm,hsn_code:e.target.value})}/></Field>
          <Field label="GST rate (%)"><Input type="number" min="0" max="100" step="0.01" value={medicineForm.gst_rate} onChange={e=>setMedicineForm({...medicineForm,gst_rate:e.target.value})}/></Field><Field label="Reorder level"><Input type="number" min="0" value={medicineForm.reorder_level} onChange={e=>setMedicineForm({...medicineForm,reorder_level:e.target.value})}/></Field><Field label="Units per pack"><Input type="number" min="0.001" step="0.001" value={medicineForm.units_per_pack} onChange={e=>setMedicineForm({...medicineForm,units_per_pack:e.target.value})}/></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={medicineForm.allow_loose_sale} onChange={e=>setMedicineForm({...medicineForm,allow_loose_sale:e.target.checked})}/> Allow loose-unit sales</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={medicineForm.prescription_required} onChange={e=>setMedicineForm({...medicineForm,prescription_required:e.target.checked})}/> Prescription required</label>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={()=>setMedicineOpen(false)}>Cancel</Button><Button disabled={saving}>{saving?'Saving…':medicineEditId?'Update medicine':'Save medicine'}</Button></div>
        </form></DialogContent></Dialog>
        <Dialog open={batchOpen} onOpenChange={setBatchOpen}><DialogTrigger asChild><Button variant="outline">Receive stock</Button></DialogTrigger><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Receive medicine batch</DialogTitle></DialogHeader><form onSubmit={saveBatch} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Medicine *"><Select value={batchForm.medicine_id} onValueChange={v=>{const m=medicines.find(x=>x.id===v);setBatchForm({...batchForm,medicine_id:v,mrp:batchForm.mrp||String(m?.mrp??''),selling_rate:batchForm.selling_rate||''});}}><SelectTrigger><SelectValue placeholder="Select medicine"/></SelectTrigger><SelectContent>{medicines.map(m=><SelectItem key={m.id} value={m.id}>{m.name} {m.strength||''}</SelectItem>)}</SelectContent></Select></Field></div>
          <Field label="Supplier"><Select value={batchForm.supplier_id||'none'} onValueChange={v=>setBatchForm({...batchForm,supplier_id:v==='none'?'':v})}><SelectTrigger><SelectValue placeholder="Optional supplier"/></SelectTrigger><SelectContent><SelectItem value="none">Not specified</SelectItem>{suppliers.filter(s=>s.status==='active').map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Batch number *"><Input value={batchForm.batch_number} onChange={e=>setBatchForm({...batchForm,batch_number:e.target.value})} required/></Field><Field label="Expiry date *"><Input type="date" min={today()} value={batchForm.expiry_date} onChange={e=>setBatchForm({...batchForm,expiry_date:e.target.value})} required/></Field>
          <Field label="Quantity received *"><Input type="number" min="0.001" step="0.001" value={batchForm.quantity_on_hand} onChange={e=>setBatchForm({...batchForm,quantity_on_hand:e.target.value})} required/></Field><Field label="Purchase rate (₹)"><Input type="number" min="0" step="0.01" value={batchForm.purchase_rate} className={purchaseRateIncrease?'border-red-500 bg-red-50 text-red-700 focus-visible:ring-red-500 dark:bg-red-950/30 dark:text-red-300':''} onChange={e=>setBatchForm({...batchForm,purchase_rate:e.target.value})}/>{lastPurchaseRate!==undefined&&<p className={`text-xs ${purchaseRateIncrease?'font-bold text-red-600 dark:text-red-400':'text-muted-foreground'}`}>Previous: {money(lastPurchaseRate)} · {purchaseRateIncrease?`Up ${purchaseRateChange.toFixed(1)}%`:`${purchaseRateChange.toFixed(1)}% vs previous`} · {purchaseAsMrp.toFixed(1)}% of MRP</p>}</Field>
          <Field label="MRP (₹)"><Input type="number" min="0" step="0.01" value={batchForm.mrp} onChange={e=>setBatchForm({...batchForm,mrp:e.target.value})}/></Field><Field label="Selling rate (₹)"><Input type="number" min="0" step="0.01" value={batchForm.selling_rate} onChange={e=>setBatchForm({...batchForm,selling_rate:e.target.value})}/></Field>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={()=>setBatchOpen(false)}>Cancel</Button><Button disabled={saving||!medicines.length}>{saving?'Saving…':'Receive stock'}</Button></div>
        </form></DialogContent></Dialog>
        <Dialog open={supplierOpen} onOpenChange={open=>{setSupplierOpen(open);if(!open){setSupplierEditId('');setSupplierForm(blankSupplier());}}}><DialogTrigger asChild><Button variant="ghost" onClick={()=>{setSupplierEditId('');setSupplierForm(blankSupplier());}}>Add supplier</Button></DialogTrigger><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{supplierEditId?'Edit supplier':'New supplier'}</DialogTitle></DialogHeader><form onSubmit={saveSupplier} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Supplier name *"><Input value={supplierForm.name} onChange={e=>setSupplierForm({...supplierForm,name:e.target.value})} required/></Field></div>
          <Field label="Contact person"><Input value={supplierForm.contact_person} onChange={e=>setSupplierForm({...supplierForm,contact_person:e.target.value})}/></Field><Field label="Phone"><Input value={supplierForm.phone} onChange={e=>setSupplierForm({...supplierForm,phone:e.target.value})}/></Field>
          <Field label="Email"><Input type="email" value={supplierForm.email} onChange={e=>setSupplierForm({...supplierForm,email:e.target.value})}/></Field><Field label="GSTIN"><Input value={supplierForm.gstin} onChange={e=>setSupplierForm({...supplierForm,gstin:e.target.value.toUpperCase()})} maxLength={15}/></Field>
          <div className="sm:col-span-2"><Field label="Address"><Input value={supplierForm.address} onChange={e=>setSupplierForm({...supplierForm,address:e.target.value})}/></Field></div>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={()=>setSupplierOpen(false)}>Cancel</Button><Button disabled={saving}>{saving?'Saving…':supplierEditId?'Update supplier':'Save supplier'}</Button></div>
        </form></DialogContent></Dialog>
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-3"><Label htmlFor="pharmacy-branch">Branch</Label><Select value={branchId} onValueChange={setBranchId}><SelectTrigger id="pharmacy-branch" className="w-64"><SelectValue placeholder="Select branch"/></SelectTrigger><SelectContent>{branches.map(b=><SelectItem key={b.id} value={b.id}>{b.name} · {b.branch_code}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="sm" onClick={load} disabled={loading}>{loading?'Refreshing…':'Refresh'}</Button></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[['Medicine catalogue',medicines.length],['Stock on hand',totalUnits.toLocaleString('en-IN')],['Low-stock medicines',lowStock],['Batches expiring in 90 days',expiring]].map(([label,value])=><Card key={label}><CardContent className="p-5"><div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div><div className="brand-heading mt-2 text-3xl font-black">{loading?'—':value}</div></CardContent></Card>)}
    </div>
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="flex h-auto flex-wrap justify-start"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="medicines">Add new items</TabsTrigger><TabsTrigger value="inventory">Stocks</TabsTrigger><TabsTrigger value="expired">Expired</TabsTrigger><TabsTrigger value="expiring">Expiring soon</TabsTrigger><TabsTrigger value="suppliers">Distributors</TabsTrigger></TabsList>
      <TabsContent value="overview" className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-base">Low-stock watchlist</CardTitle></CardHeader><CardContent>{medicines.filter(m=>onHand(m.id)<=Number(m.reorder_level||0)).slice(0,10).map(m=><div key={m.id} className="flex items-center justify-between border-b py-3 text-sm"><div><div className="font-bold">{m.name}</div><div className="text-xs text-muted-foreground">{m.generic_name||m.brand||'No generic mapping'}</div></div><Badge variant="destructive">Available {onHand(m.id)} · Reorder {m.reorder_level}</Badge></div>)}{!lowStock&&<p className="py-5 text-sm text-muted-foreground">No low-stock medicines based on current reorder levels.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Expiry monitoring</CardTitle></CardHeader><CardContent>{batches.filter(b=>b.expiry_date<=new Date(Date.now()+90*86400000).toISOString().slice(0,10)&&Number(b.quantity_on_hand)>0).slice(0,10).map(b=><div key={b.id} className="flex items-center justify-between border-b py-3 text-sm"><div><div className="font-bold">{medicines.find(m=>m.id===b.medicine_id)?.name||'Medicine'}</div><div className="text-xs text-muted-foreground">Batch {b.batch_number} · {b.expiry_date}</div></div><Badge variant={b.expiry_date<today()?'destructive':'secondary'}>{b.expiry_date<today()?'Expired':'Expiring'}</Badge></div>)}{!expiring&&<p className="py-5 text-sm text-muted-foreground">No batches expiring within 90 days.</p>}</CardContent></Card>
      </TabsContent>
      <TabsContent value="medicines"><Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="text-base">Medicine catalogue <Badge variant="secondary" className="ml-2">{filtered.length}</Badge></CardTitle><Input className="w-64" placeholder="Search name, generic, brand, SKU" value={search} onChange={e=>setSearch(e.target.value)}/></div></CardHeader><CardContent>{loading?<p className="py-8 text-sm text-muted-foreground">Loading medicines…</p>:<div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="py-3">Medicine</th><th>Generic / brand</th><th>Form</th><th>GST</th><th>Reorder level</th><th>Status</th><th>Actions</th></tr></thead><tbody className="divide-y">{filtered.map(m=><tr key={m.id}><td className="py-3 font-bold">{m.name}<div className="text-xs font-normal text-muted-foreground">{m.strength||'—'} · {m.sku||'No SKU'}</div></td><td>{m.generic_name||'—'}<div className="text-xs text-muted-foreground">{m.brand||'—'}</div></td><td>{m.dosage_form||'—'}</td><td>{m.gst_rate}%</td><td>{m.reorder_level}</td><td><Badge variant={m.status==='active'?'default':'secondary'}>{m.status}</Badge></td><td className="whitespace-nowrap"><Button size="sm" variant="outline" onClick={()=>editMedicine(m)}>Edit</Button><Button size="sm" variant="ghost" disabled={saving} onClick={()=>setMedicineStatus(m,m.status==='active'?'inactive':'active')}>{m.status==='active'?'Deactivate':'Activate'}</Button></td></tr>)}</tbody></table>{!filtered.length&&<p className="py-8 text-center text-sm text-muted-foreground">No medicines match this search.</p>}</div>}</CardContent></Card></TabsContent>
      <TabsContent value="inventory"><Card><CardHeader><CardTitle className="text-base">Batch-wise inventory</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="py-3">Medicine</th><th>Batch</th><th>Expiry</th><th>Qty</th><th>Purchase</th><th>MRP</th><th>Selling</th></tr></thead><tbody className="divide-y">{batches.map(b=><tr key={b.id}><td className="py-3 font-bold">{medicines.find(m=>m.id===b.medicine_id)?.name||'—'}</td><td>{b.batch_number}</td><td>{b.expiry_date}</td><td className="font-bold">{b.quantity_on_hand}</td><td>{money(b.purchase_rate)}</td><td>{money(b.mrp)}</td><td>{money(b.selling_rate)}</td></tr>)}</tbody></table>{!batches.length&&<p className="py-8 text-center text-sm text-muted-foreground">No batch stock recorded for this branch.</p>}</div></CardContent></Card></TabsContent>
      <TabsContent value="expired"><Card><CardHeader><CardTitle className="text-base">Expired medicines · blocked from sale</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="py-3">Medicine</th><th>Batch</th><th>Expiry</th><th>Quantity quarantined</th><th>Distributor</th></tr></thead><tbody className="divide-y">{batches.filter(b=>b.expiry_date<today()&&Number(b.quantity_on_hand)>0).map(b=><tr key={b.id}><td className="py-3 font-bold">{medicines.find(m=>m.id===b.medicine_id)?.name||'—'}</td><td>{b.batch_number}</td><td className="font-bold text-red-600">{b.expiry_date}</td><td>{b.quantity_on_hand}</td><td>{suppliers.find(s=>s.id===b.supplier_id)?.name||'—'}</td></tr>)}</tbody></table>{!batches.some(b=>b.expiry_date<today()&&Number(b.quantity_on_hand)>0)&&<p className="py-8 text-center text-sm text-muted-foreground">No expired stock recorded.</p>}</div><p className="mt-3 text-xs text-red-600">Expired batches are excluded from POS availability and cannot be sold.</p></CardContent></Card></TabsContent>
      <TabsContent value="expiring"><Card><CardHeader><CardTitle className="text-base">Expiring within 90 days</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="py-3">Medicine</th><th>Batch</th><th>Expiry</th><th>Quantity</th><th>Distributor</th></tr></thead><tbody className="divide-y">{batches.filter(b=>b.expiry_date>=today()&&b.expiry_date<=new Date(Date.now()+90*86400000).toISOString().slice(0,10)&&Number(b.quantity_on_hand)>0).map(b=><tr key={b.id}><td className="py-3 font-bold">{medicines.find(m=>m.id===b.medicine_id)?.name||'—'}</td><td>{b.batch_number}</td><td>{b.expiry_date}</td><td>{b.quantity_on_hand}</td><td>{suppliers.find(s=>s.id===b.supplier_id)?.name||'—'}</td></tr>)}</tbody></table>{!expiring&&<p className="py-8 text-center text-sm text-muted-foreground">No medicines expiring in the next 90 days.</p>}</div></CardContent></Card></TabsContent>
      <TabsContent value="suppliers"><Card><CardHeader><CardTitle className="text-base">Supplier register</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="py-3">Supplier</th><th>Contact person</th><th>Phone</th><th>Email</th><th>GSTIN</th><th>Status</th><th>Actions</th></tr></thead><tbody className="divide-y">{suppliers.map(s=><tr key={s.id}><td className="py-3 font-bold">{s.name}</td><td>{s.contact_person||'—'}</td><td>{s.phone||'—'}</td><td>{s.email||'—'}</td><td>{s.gstin||'—'}</td><td><Badge variant={s.status==='active'?'default':'secondary'}>{s.status}</Badge></td><td className="whitespace-nowrap"><Button size="sm" variant="outline" onClick={()=>editSupplier(s)}>Edit</Button><Button size="sm" variant="ghost" disabled={saving} onClick={()=>setSupplierStatus(s,s.status==='active'?'inactive':'active')}>{s.status==='active'?'Deactivate':'Activate'}</Button></td></tr>)}</tbody></table>{!suppliers.length&&<p className="py-8 text-center text-sm text-muted-foreground">No suppliers registered yet.</p>}</div></CardContent></Card></TabsContent>
    </Tabs>
    <p className="text-xs leading-5 text-muted-foreground">Inventory now separates add-new-items, stocks, expired batches and expiring-soon views. Expired batches are excluded from POS checkout. Purchase-rate entry compares the latest recorded purchase rate and highlights increases in red, while showing the purchase rate as a percentage of MRP.</p>
  </div>;
}
