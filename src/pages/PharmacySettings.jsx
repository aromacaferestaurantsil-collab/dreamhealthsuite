import { useEffect, useState } from 'react';
import { useAuth } from '@/layouts/RootLayout';
import { requireSupabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export const route = { path: '/pharmacy-settings', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'Settings', label: 'Settings', section: 'PharmaSuite · Settings', order: 15, profiles: ['Admin_c','Manager','Pharmacist'] };
const Field=({label,children})=><div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
const groups = {
 credit: { title:'Customer khata & credit', fields:[['customer_credit_limit','Default customer credit limit (₹)','0'],['customer_credit_days','Default credit days','0'],['customer_overdue_hold_days','Block new credit after overdue days','0'],['customer_reminder_days','Reminder interval (days)','7']] },
 distributor: { title:'Distributor terms', fields:[['distributor_credit_days','Default distributor credit days','30'],['distributor_statement_tolerance','Statement variance tolerance (₹)','1'],['distributor_license_alert_days','Drug licence alert before expiry (days)','30']] },
 finance: { title:'Cashbook & day close', fields:[['cash_variance_approval_limit','Cash variance approval threshold (₹)','100'],['cash_close_required','Require shift/day close (true/false)','true'],['financial_year_start','Financial year starts (MM-DD)','04-01'],['invoice_prefix','Invoice prefix','PH']] },
 operations: { title:'Operational defaults', fields:[['default_payment_methods','Payment methods (comma separated)','cash,upi,card,bank,credit'],['allow_part_payment','Allow part payments (true/false)','true'],['auto_allocate_receipts','Auto allocate receipts FIFO (true/false)','true']] }
};
export default function PharmacySettings(){
 const {activeTenant,user}=useAuth(); const tenantId=activeTenant?.tenant_id; const branchId=activeTenant?.branch_id||null; const db=requireSupabase();
 const [values,setValues]=useState({}); const [branch,setBranch]=useState(branchId||'workspace'); const [loading,setLoading]=useState(false); const [saving,setSaving]=useState(false);
 const isAdmin=['owner','admin'].includes(activeTenant?.role);
 async function load(){if(!tenantId)return;setLoading(true);try{let q=db.from('pharmacy_settings').select('setting_key,setting_value,branch_id').eq('tenant_id',tenantId);if(branch==='workspace')q=q.is('branch_id',null);else q=q.eq('branch_id',branch);const {data,error}=await q;if(error)throw error;const next={};for(const row of data||[])next[row.setting_key]=row.setting_value?.value??row.setting_value;setValues(next)}catch(e){toast.error(e.message||'Could not load settings')}finally{setLoading(false)}}
 useEffect(()=>{setBranch(branchId||'workspace')},[tenantId,branchId]);
 useEffect(()=>{load()},[tenantId,branch]);
 function update(k,v){setValues(x=>({...x,[k]:v}))}
 async function saveGroup(group){setSaving(true);try{const rows=groups[group].fields.map(([key])=>({tenant_id:tenantId,branch_id:branch==='workspace'?null:branch,setting_key:key,setting_value:{value:values[key]??groups[group].fields.find(f=>f[0]===key)?.[2]},updated_by:user?.id}));for(const row of rows){const {error}=await db.from('pharmacy_settings').upsert(row,{onConflict:'tenant_id,branch_id,setting_key'});if(error)throw error}toast.success(groups[group].title+' saved')}catch(e){toast.error(e.message||'Settings could not be saved')}finally{setSaving(false)}}
 async function createExportRequest(){try{const {error}=await db.from('pharmacy_backup_jobs').insert({tenant_id:tenantId,requested_by:user.id,backup_type:'export',status:'requested',record_manifest:{scope:'pharmacy_suite',requested_from:'pharmacy_settings'}});if(error)throw error;toast.success('Export request recorded. A configured secure backup worker is still required to produce the backup file.')}catch(e){toast.error(e.message||'Could not record export request')}}
 if(!tenantId)return <Card><CardContent className="p-6">Select a workspace first.</CardContent></Card>;
 return <div className="mx-auto max-w-6xl space-y-5">
  <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">PharmaSuite</p><h1 className="text-3xl font-black">Settings</h1><p className="text-sm text-muted-foreground">Credit, distributor terms, cash controls, access and data protection settings.</p></div><div className="w-64"><Field label="Settings scope"><Select value={branch} onValueChange={setBranch}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="workspace">Workspace default</SelectItem>{branchId&&<SelectItem value={branchId}>My assigned branch</SelectItem>}</SelectContent></Select></Field></div></header>
  <Tabs defaultValue="credit"><TabsList className="flex h-auto flex-wrap"><TabsTrigger value="credit">Khata & credit</TabsTrigger><TabsTrigger value="distributor">Distributor</TabsTrigger><TabsTrigger value="finance">Cashbook & finance</TabsTrigger><TabsTrigger value="operations">Operations</TabsTrigger><TabsTrigger value="access">Roles & access</TabsTrigger><TabsTrigger value="backup">Backup & audit</TabsTrigger></TabsList>
   {Object.entries(groups).map(([key,g])=><TabsContent key={key} value={key}><Card><CardHeader><CardTitle>{g.title}</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 sm:grid-cols-2">{g.fields.map(([k,label,def])=><Field key={k} label={label}><Input value={String(values[k]??def)} onChange={e=>update(k,e.target.value)} disabled={loading}/></Field>)}</div><div className="flex justify-end"><Button onClick={()=>saveGroup(key)} disabled={saving||loading}>{saving?'Saving…':'Save settings'}</Button></div></CardContent></Card></TabsContent>)}
   <TabsContent value="access"><Card><CardHeader><CardTitle>PharmaSuite role permissions</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Fine-grained permission overrides are stored per workspace/branch. Only the workspace owner or administrator should change them. Until the permission-aware API checks are enabled for every action, these records are configuration only and do not replace database RLS.</p>{!isAdmin?<p className="text-sm">Only an owner or administrator can manage access settings.</p>:<div className="rounded-lg border p-3 text-sm">Permission matrix foundation is active in the database. Action-level enforcement and the role editor are pending; existing membership roles and RLS remain authoritative.</div>}</CardContent></Card></TabsContent>
   <TabsContent value="backup"><Card><CardHeader><CardTitle>Backup, restore & audit</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Financial and operational writes are audit logged. Ledger entries are append-only and corrections must use reversal entries.</p><div className="rounded-lg border p-3 text-sm">Backup job tracking is available. A secure backup worker, encrypted file storage, checksum verification and restore drill must be configured before backups can be considered operational.</div><Button variant="outline" onClick={createExportRequest} disabled={!isAdmin}>Record backup/export request</Button></CardContent></Card></TabsContent>
  </Tabs>
  {loading&&<p className="text-sm text-muted-foreground">Loading settings…</p>}
 </div>;
}
