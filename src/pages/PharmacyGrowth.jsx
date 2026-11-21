import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/layouts/RootLayout';
import { requireSupabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export const route = { path: '/pharmacy-growth', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'Gift', label: 'Loyalty & campaigns', section: 'PharmaSuite · Growth', order: 20, profiles: ['Admin_c','Manager','Pharmacist'] };

const money = value => '₹' + Number(value || 0).toLocaleString('en-IN',{maximumFractionDigits:2});
const dateTime = value => value ? new Date(value).toLocaleString('en-IN') : '—';
const emptyCampaign = () => ({campaign_name:'',campaign_code:'',discount_type:'percentage',discount_value:'5',minimum_bill_value:'0',maximum_discount:'',starts_at:new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16),ends_at:new Date(Date.now()+7*86400000-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16),usage_limit:'',per_customer_limit:'1',status:'draft'});

export default function PharmacyGrowth(){
 const {activeTenant,user}=useAuth();
 const tenantId=activeTenant?.tenant_id;
 const branchId=activeTenant?.branch_id||null;
 const isOwner=['owner','admin'].includes(activeTenant?.role);
 const db=requireSupabase();
 const [tab,setTab]=useState('loyalty');
 const [loading,setLoading]=useState(false);
 const [saving,setSaving]=useState(false);
 const [program,setProgram]=useState({is_enabled:false,earn_points_per_currency:'0.01',redemption_value_per_point:'1',minimum_redemption_points:'100',points_expiry_days:'',max_redemption_percent:'10'});
 const [campaigns,setCampaigns]=useState([]);
 const [transactions,setTransactions]=useState([]);
 const [referrals,setReferrals]=useState([]);
 const [form,setForm]=useState(emptyCampaign);
 const loadRequest=useRef(0);

 async function load(){
  if(!tenantId){setCampaigns([]);setTransactions([]);setReferrals([]);setLoading(false);return;}
  const request=++loadRequest.current;setLoading(true);
  try{
   const [p,c,t,r]=await Promise.all([
    db.from('pharmacy_loyalty_programs').select('*').eq('tenant_id',tenantId).is('branch_id',branchId).maybeSingle(),
    db.from('pharmacy_campaigns').select('id,campaign_name,campaign_code,discount_type,discount_value,minimum_bill_value,maximum_discount,starts_at,ends_at,status,usage_limit,per_customer_limit').eq('tenant_id',tenantId).order('created_at',{ascending:false}).limit(100),
    db.from('pharmacy_loyalty_transactions').select('id,patient_id,transaction_type,points,description,created_at').eq('tenant_id',tenantId).order('created_at',{ascending:false}).limit(250),
    db.from('pharmacy_referrals').select('id,referral_code,referral_status,reward_points,reward_type,reward_amount,created_at,released_at,reversed_at').eq('tenant_id',tenantId).order('created_at',{ascending:false}).limit(100)
   ]);
   for(const x of [p,c,t,r])if(x.error)throw x.error;
   if(request!==loadRequest.current)return;
   if(p.data)setProgram({is_enabled:p.data.is_enabled,earn_points_per_currency:String(p.data.earn_points_per_currency),redemption_value_per_point:String(p.data.redemption_value_per_point),minimum_redemption_points:String(p.data.minimum_redemption_points),points_expiry_days:p.data.points_expiry_days?String(p.data.points_expiry_days):'',max_redemption_percent:String(p.data.max_redemption_percent)});
   setCampaigns(c.data||[]);setTransactions(t.data||[]);setReferrals(r.data||[]);
  }catch(e){if(request===loadRequest.current)toast.error(e.message||'Unable to load growth settings')}
  finally{if(request===loadRequest.current)setLoading(false)}
 }
 useEffect(()=>{loadRequest.current++;setCampaigns([]);setTransactions([]);setReferrals([]);setProgram({is_enabled:false,earn_points_per_currency:'0.01',redemption_value_per_point:'1',minimum_redemption_points:'100',points_expiry_days:'',max_redemption_percent:'10'})},[tenantId,branchId]);
 useEffect(()=>{load()},[tenantId,branchId]);

 const balance=useMemo(()=>transactions.reduce((n,t)=>n+(t.transaction_type==='earned'||t.transaction_type==='adjusted'?Number(t.points):t.transaction_type==='reversed'||t.transaction_type==='redeemed'||t.transaction_type==='expired'?-Number(t.points):0),0),[transactions]);
 async function saveProgram(){
  if(!isOwner)return toast.error('Only an owner or admin can change loyalty rules');
  setSaving(true);
  try{
   const payload={tenant_id:tenantId,branch_id:branchId,is_enabled:program.is_enabled,earn_points_per_currency:Number(program.earn_points_per_currency),redemption_value_per_point:Number(program.redemption_value_per_point),minimum_redemption_points:Number(program.minimum_redemption_points),points_expiry_days:program.points_expiry_days?Number(program.points_expiry_days):null,max_redemption_percent:Number(program.max_redemption_percent),updated_by:user?.id};
   const {error}=await db.from('pharmacy_loyalty_programs').upsert(payload,{onConflict:'tenant_id,branch_id'});
   if(error)throw error;toast.success('Loyalty programme settings saved');await load();
  }catch(e){toast.error(e.message||'Could not save loyalty settings')}
  finally{setSaving(false)}
 }
 async function createCampaign(e){
  e.preventDefault();if(!isOwner)return toast.error('Only an owner or admin can create campaigns');
  if(!form.campaign_name.trim()||!form.starts_at||!form.ends_at)return toast.error('Campaign name and dates are required');
  if(new Date(form.ends_at)<=new Date(form.starts_at))return toast.error('End date must be after start date');
  setSaving(true);
  try{
   const payload={tenant_id:tenantId,branch_id:branchId,campaign_name:form.campaign_name.trim(),campaign_code:form.campaign_code.trim().toUpperCase()||null,discount_type:form.discount_type,discount_value:Number(form.discount_value),minimum_bill_value:Number(form.minimum_bill_value||0),maximum_discount:form.maximum_discount?Number(form.maximum_discount):null,starts_at:new Date(form.starts_at).toISOString(),ends_at:new Date(form.ends_at).toISOString(),usage_limit:form.usage_limit?Number(form.usage_limit):null,per_customer_limit:form.per_customer_limit?Number(form.per_customer_limit):null,status:form.status,created_by:user?.id,updated_by:user?.id};
   const {error}=await db.from('pharmacy_campaigns').insert(payload);if(error)throw error;
   toast.success('Campaign saved as '+form.status);setForm(emptyCampaign());await load();
  }catch(e){toast.error(e.message||'Could not save campaign')}
  finally{setSaving(false)}
 }
 async function updateCampaignStatus(id,status){
  if(!isOwner)return toast.error('Only an owner or admin can change campaign status');
  const {error}=await db.from('pharmacy_campaigns').update({status,updated_by:user?.id}).eq('tenant_id',tenantId).eq('id',id);
  if(error)toast.error(error.message);else{toast.success('Campaign status updated');await load()}
 }
 if(!tenantId)return <Card><CardContent className="p-6">Join a workspace to manage PharmaSuite growth features.</CardContent></Card>;
 return <div className="mx-auto max-w-7xl space-y-6">
  <div><div className="text-xs font-extrabold uppercase tracking-widest text-primary">PharmaSuite · Customer growth</div><h1 className="mt-1 text-3xl font-black">Loyalty & campaigns</h1><p className="mt-1 text-sm text-muted-foreground">Configure customer rewards, manage discount campaigns and review referral activity.</p></div>
  <div className="grid gap-3 sm:grid-cols-3">
   <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Ledger entries loaded</div><div className="text-2xl font-bold">{transactions.length}</div></CardContent></Card>
   <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Net points in recent entries</div><div className="text-2xl font-bold">{balance.toFixed(3)}</div></CardContent></Card>
   <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Referral records</div><div className="text-2xl font-bold">{referrals.length}</div></CardContent></Card>
  </div>
  <Tabs value={tab} onValueChange={setTab}>
   <TabsList className="flex h-auto flex-wrap"><TabsTrigger value="loyalty">Loyalty rules</TabsTrigger><TabsTrigger value="campaigns">Discount campaigns</TabsTrigger><TabsTrigger value="referrals">Referrals</TabsTrigger><TabsTrigger value="ledger">Points ledger</TabsTrigger></TabsList>
   <TabsContent value="loyalty"><Card><CardHeader><CardTitle>Loyalty programme</CardTitle></CardHeader><CardContent className="space-y-4">
    <div className="flex items-center justify-between rounded-lg border p-3"><div><div className="font-medium">Enable loyalty programme</div><p className="text-sm text-muted-foreground">Switch on only after earn/redeem checkout rules are configured.</p></div><Switch checked={program.is_enabled} onCheckedChange={v=>setProgram(x=>({...x,is_enabled:v}))} disabled={!isOwner}/></div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
     <div className="space-y-1"><Label>Points earned per ₹1</Label><Input type="number" min="0" step="0.0001" value={program.earn_points_per_currency} onChange={e=>setProgram(x=>({...x,earn_points_per_currency:e.target.value}))} disabled={!isOwner}/></div>
     <div className="space-y-1"><Label>₹ value per point</Label><Input type="number" min="0" step="0.0001" value={program.redemption_value_per_point} onChange={e=>setProgram(x=>({...x,redemption_value_per_point:e.target.value}))} disabled={!isOwner}/></div>
     <div className="space-y-1"><Label>Minimum points to redeem</Label><Input type="number" min="0" step="1" value={program.minimum_redemption_points} onChange={e=>setProgram(x=>({...x,minimum_redemption_points:e.target.value}))} disabled={!isOwner}/></div>
     <div className="space-y-1"><Label>Points expiry (days, blank = never)</Label><Input type="number" min="1" step="1" value={program.points_expiry_days} onChange={e=>setProgram(x=>({...x,points_expiry_days:e.target.value}))} disabled={!isOwner}/></div>
     <div className="space-y-1"><Label>Maximum bill redemption (%)</Label><Input type="number" min="0" max="100" step="0.01" value={program.max_redemption_percent} onChange={e=>setProgram(x=>({...x,max_redemption_percent:e.target.value}))} disabled={!isOwner}/></div>
    </div>
    <p className="text-sm text-muted-foreground">Default earn rate is 1 point per ₹100. These are configuration values only; live checkout accrual and redemption are not enabled yet.</p>
    {isOwner&&<Button onClick={saveProgram} disabled={saving}>{saving?'Saving…':'Save loyalty rules'}</Button>}
   </CardContent></Card></TabsContent>
   <TabsContent value="campaigns"><div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
    <Card><CardHeader><CardTitle>Create campaign</CardTitle></CardHeader><CardContent><form onSubmit={createCampaign} className="space-y-3">
     <div className="space-y-1"><Label>Campaign name</Label><Input value={form.campaign_name} onChange={e=>setForm(x=>({...x,campaign_name:e.target.value}))} required/></div>
     <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label>Coupon code</Label><Input value={form.campaign_code} onChange={e=>setForm(x=>({...x,campaign_code:e.target.value.toUpperCase()}))}/></div><div className="space-y-1"><Label>Discount type</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.discount_type} onChange={e=>setForm(x=>({...x,discount_type:e.target.value}))}><option value="percentage">Percentage</option><option value="fixed">Fixed amount</option><option value="buy_x_get_y">Buy X get Y (definition only)</option></select></div></div>
     <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label>Discount value</Label><Input type="number" min="0" step="0.01" value={form.discount_value} onChange={e=>setForm(x=>({...x,discount_value:e.target.value}))}/></div><div className="space-y-1"><Label>Minimum bill (₹)</Label><Input type="number" min="0" step="0.01" value={form.minimum_bill_value} onChange={e=>setForm(x=>({...x,minimum_bill_value:e.target.value}))}/></div></div>
     <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label>Maximum discount (₹)</Label><Input type="number" min="0" step="0.01" value={form.maximum_discount} onChange={e=>setForm(x=>({...x,maximum_discount:e.target.value}))}/></div><div className="space-y-1"><Label>Per-customer uses</Label><Input type="number" min="1" step="1" value={form.per_customer_limit} onChange={e=>setForm(x=>({...x,per_customer_limit:e.target.value}))}/></div></div>
     <div className="space-y-1"><Label>Starts</Label><Input type="datetime-local" value={form.starts_at} onChange={e=>setForm(x=>({...x,starts_at:e.target.value}))}/></div><div className="space-y-1"><Label>Ends</Label><Input type="datetime-local" value={form.ends_at} onChange={e=>setForm(x=>({...x,ends_at:e.target.value}))}/></div>
     <div className="space-y-1"><Label>Initial status</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={form.status} onChange={e=>setForm(x=>({...x,status:e.target.value}))}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="active">Active</option></select></div>
     {isOwner&&<Button className="w-full" disabled={saving}>{saving?'Saving…':'Save campaign'}</Button>}
    </form></CardContent></Card>
    <Card><CardHeader><CardTitle>Campaign list</CardTitle></CardHeader><CardContent className="space-y-3">{campaigns.length===0?<p className="text-sm text-muted-foreground">No campaigns created yet.</p>:campaigns.map(c=><div key={c.id} className="rounded-lg border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-semibold">{c.campaign_name} {c.campaign_code&&<span className="font-mono text-xs text-muted-foreground">· {c.campaign_code}</span>}</div><Badge variant="outline">{c.status}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{c.discount_type==='percentage'?c.discount_value+'%':c.discount_type==='fixed'?money(c.discount_value):'Buy X get Y'} · Min bill {money(c.minimum_bill_value)}</p><p className="text-xs text-muted-foreground">{dateTime(c.starts_at)} – {dateTime(c.ends_at)}</p>{isOwner&&<div className="mt-2 flex gap-2">{c.status!=='paused'&&c.status!=='ended'&&<Button size="sm" variant="outline" onClick={()=>updateCampaignStatus(c.id,'paused')}>Pause</Button>}{c.status==='paused'&&<Button size="sm" variant="outline" onClick={()=>updateCampaignStatus(c.id,'active')}>Activate</Button>}{c.status!=='archived'&&<Button size="sm" variant="ghost" onClick={()=>updateCampaignStatus(c.id,'archived')}>Archive</Button>}</div>}</div>)}</CardContent></Card>
   </div></TabsContent>
   <TabsContent value="referrals"><Card><CardHeader><CardTitle>Referral activity</CardTitle></CardHeader><CardContent className="space-y-2">{referrals.length===0?<p className="text-sm text-muted-foreground">No referral records found. Existing referral capture is retained; reward release and fraud checks are not yet automated.</p>:referrals.map(r=><div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><div><div className="font-mono font-semibold">{r.referral_code}</div><div className="text-xs text-muted-foreground">{dateTime(r.created_at)} · {r.reward_type} reward</div></div><div className="text-right"><Badge variant="outline">{r.referral_status}</Badge><div className="text-sm">{r.reward_type==='points'?r.reward_points+' points':money(r.reward_amount)}</div></div></div>)}</CardContent></Card></TabsContent>
   <TabsContent value="ledger"><Card><CardHeader><CardTitle>Recent loyalty transactions</CardTitle></CardHeader><CardContent className="space-y-2">{transactions.length===0?<p className="text-sm text-muted-foreground">No points have been earned or redeemed yet.</p>:transactions.map(t=><div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><div><div className="font-medium capitalize">{t.transaction_type}</div><div className="text-xs text-muted-foreground">{t.description||t.patient_id} · {dateTime(t.created_at)}</div></div><div className="font-semibold tabular-nums">{t.transaction_type==='redeemed'||t.transaction_type==='expired'||t.transaction_type==='reversed'?'-':''}{Number(t.points).toFixed(3)} pts</div></div>)}</CardContent></Card></TabsContent>
  </Tabs>
  {loading&&<p className="text-xs text-muted-foreground">Refreshing records…</p>}
 </div>;
}
