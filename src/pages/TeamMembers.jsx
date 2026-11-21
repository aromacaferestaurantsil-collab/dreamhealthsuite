import { useCallback,useEffect,useState } from 'react';
import { useTenant } from '@/layouts/RootLayout';
import { requireSupabase } from '@/lib/supabase';
import ApperIcon from '@/components/ApperIcon';
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const roles=['manager','doctor','pharmacist','lab_technician','pathologist','care_worker','receptionist','analyst','staff'];
const statusVariant=value=>value==='active'?'default':value==='invited'?'secondary':'destructive';
function randomToken(){
 if(!globalThis.crypto?.getRandomValues)throw new Error('Secure random token generation is unavailable in this browser');
 const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
 return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function hashToken(token){
 if(!globalThis.crypto?.subtle)throw new Error('Secure token hashing is unavailable in this browser');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export const route={path:'/team-members',layout:'owner',access:'authenticated'};
export const nav={icon:'Users',label:'Team & access',order:5,profiles:['Admin_c','Manager']};
export default function TeamMembers(){
 const {activeTenant}=useTenant();const tenantId=activeTenant?.tenant_id;
 const [members,setMembers]=useState([]);const [branches,setBranches]=useState([]);const [invites,setInvites]=useState([]);
 const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);const [error,setError]=useState('');
 const [form,setForm]=useState({email:'',role:'staff',branch_id:activeTenant?.role==='manager'&&activeTenant?.branch_id?activeTenant.branch_id:'all',days:'7'});
 const [createdInvite,setCreatedInvite]=useState(null);
 const load=useCallback(async()=>{
  if(!tenantId){setMembers([]);setInvites([]);setBranches([]);setLoading(false);return;}
  setLoading(true);setError('');
  try{
   const db=requireSupabase();
   const [m,b,i]=await Promise.all([
    db.rpc('list_tenant_team_members',{p_tenant_id:tenantId,p_branch_id:activeTenant?.role==='manager'?activeTenant?.branch_id??null:null,p_role:null}),
    db.from('branches').select('id,name,branch_code').eq('tenant_id',tenantId).eq('status','active').order('name'),
    db.from('tenant_invitations').select('id,email,role,branch_id,expires_at,accepted_at,revoked_at,created_at').eq('tenant_id',tenantId).is('accepted_at',null).is('revoked_at',null).order('created_at',{ascending:false})
   ]);
   for(const q of [m,b,i])if(q.error)throw q.error;
   setMembers(m.data??[]);
   setBranches(b.data??[]);setInvites(i.data??[]);
  }catch(e){setError(e.message||'Unable to load team records');}
  finally{setLoading(false);}
 },[tenantId]);
 useEffect(()=>{load();},[load]);
 useEffect(()=>{
  setForm(current=>({...current,branch_id:activeTenant?.role==='manager'&&activeTenant?.branch_id?activeTenant.branch_id:'all'}));
  setCreatedInvite(null);
 },[tenantId,activeTenant?.role,activeTenant?.branch_id]);
 async function createInvitation(e){
  e.preventDefault();if(!tenantId)return;
  const email=form.email.trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return toast.error('Enter a valid email address');
  const days=Number(form.days);if(!Number.isInteger(days)||days<1||days>14)return toast.error('Invitation validity must be 1–14 days');
  if(activeTenant?.role==='manager'&&['manager'].includes(form.role))return toast.error('Managers cannot invite another manager');
  const token=randomToken();const tokenHash=await hashToken(token);
  const expiresAt=new Date(Date.now()+days*86400000).toISOString();
  setSaving(true);
  try{
   const {data,error}=await requireSupabase().rpc('create_tenant_invitation',{
    p_tenant_id:tenantId,p_email:email,p_role:form.role,p_branch_id:form.branch_id==='all'?null:form.branch_id,p_token_hash:tokenHash,p_expires_at:expiresAt
   });
   if(error)throw error;
   setCreatedInvite({email,role:form.role,token,expiresAt,id:data});
   setForm({email:'',role:'staff',branch_id:activeTenant?.role==='manager'&&activeTenant?.branch_id?activeTenant.branch_id:'all',days:'7'});
   toast.success('Invitation created. Copy the one-time token and send it securely to the invited person.');
   await load();
  }catch(e){toast.error(e.message||'Unable to create invitation');}
  finally{setSaving(false);}
 }
 async function revoke(id){
  if(!globalThis.confirm?.('Revoke this pending invitation?'))return;
  setSaving(true);try{const {error}=await requireSupabase().rpc('revoke_tenant_invitation',{p_invitation_id:id});if(error)throw error;toast.success('Invitation revoked');await load();}
  catch(e){toast.error(e.message||'Unable to revoke invitation');}finally{setSaving(false);}
 }
 if(!tenantId)return <Card><CardContent className="p-6">Select a workspace first.</CardContent></Card>;
 return <div className="mx-auto max-w-6xl space-y-6">
  <div><div className="text-xs font-bold uppercase tracking-widest text-primary">Workspace administration</div><h1 className="brand-heading mt-1 text-3xl font-black">Team and employee access</h1><p className="mt-1 text-sm text-muted-foreground">Invite employees into this organisation with a specific role and optional branch restriction.</p></div>
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  {createdInvite&&<Card className="border-primary/40"><CardHeader><CardTitle>New invitation created</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm">Send this token only to <strong>{createdInvite.email}</strong>. Role: <strong>{createdInvite.role}</strong>. Expires: {new Date(createdInvite.expiresAt).toLocaleString()}</p><div className="break-all rounded-lg border bg-muted p-3 font-mono text-xs">{createdInvite.token}</div><div className="flex flex-wrap gap-2"><Button onClick={()=>{navigator.clipboard?.writeText(createdInvite.token);toast.success('Invitation token copied')}}><ApperIcon name="Copy" size={15} className="mr-2"/>Copy token</Button><Button variant="outline" onClick={()=>setCreatedInvite(null)}>Close</Button></div><p className="text-xs text-muted-foreground">Email delivery is not configured in this deployment. Send the token through your approved secure channel. The token is shown only once here; the database stores only its SHA-256 hash.</p></CardContent></Card>}
  <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
   <Card><CardHeader><CardTitle>Invite employee</CardTitle></CardHeader><CardContent><form className="space-y-3" onSubmit={createInvitation}>
    <div className="space-y-1"><Label>Email address</Label><Input type="email" value={form.email} onChange={e=>setForm(x=>({...x,email:e.target.value}))} required/></div>
    <div className="space-y-1"><Label>Role</Label><Select value={form.role} onValueChange={role=>setForm(x=>({...x,role}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{roles.map(role=><SelectItem key={role} value={role}>{role.replaceAll('_',' ')}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-1"><Label>Branch access</Label><Select value={form.branch_id} onValueChange= {branch_id=>setForm(x=>({...x,branch_id}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{!(activeTenant?.role==='manager'&&activeTenant?.branch_id)&&<SelectItem value="all">All branches</SelectItem>}{branches.map(b=><SelectItem key={b.id} value={b.id}>{b.name} · {b.branch_code}</SelectItem>)}</SelectContent></Select></div>
    <div className="space-y-1"><Label>Token validity</Label><Select value={form.days} onValueChange={days=>setForm(x=>({...x,days}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['1','3','7','14'].map(d=><SelectItem key={d} value={d}>{d} days</SelectItem>)}</SelectContent></Select></div>
    <Button className="w-full" disabled={saving}>{saving?'Creating…':'Create invitation'}</Button>
   </form></CardContent></Card>
   <Card><CardHeader><div className="flex items-center justify-between gap-2"><CardTitle>Current members</CardTitle><Badge variant="secondary">{members.length}</Badge></div></CardHeader><CardContent>{loading?<p className="text-sm text-muted-foreground">Loading team…</p>:<div className="space-y-2">{members.map(m=><div key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><div className="font-semibold">{m.full_name}</div><div className="text-xs text-muted-foreground">{m.role.replaceAll('_',' ')} · {branches.find(b=>b.id===m.branch_id)?.name||'All branches'} · {m.user_id}</div></div><Badge variant={statusVariant(m.status)}>{m.status}</Badge></div>)}{!members.length&&<p className="py-5 text-center text-sm text-muted-foreground">No employee memberships found.</p>}</div>}</CardContent></Card>
  </div>
  <Card><CardHeader><div className="flex items-center justify-between"><CardTitle>Pending invitations</CardTitle><Badge variant="secondary">{invites.length}</Badge></div></CardHeader><CardContent><div className="space-y-2">{invites.map(i=><div key={i.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><div className="font-semibold">{i.email}</div><div className="text-xs text-muted-foreground">{i.role.replaceAll('_',' ')} · Expires {new Date(i.expires_at).toLocaleString()}</div></div><div className="flex items-center gap-2"><Badge variant="secondary">Pending</Badge><Button size="sm" variant="outline" disabled={saving} onClick={()=>revoke(i.id)}>Revoke</Button></div></div>)}{!invites.length&&<p className="py-5 text-center text-sm text-muted-foreground">No pending invitations.</p>}</div></CardContent></Card>
 </div>;
}
