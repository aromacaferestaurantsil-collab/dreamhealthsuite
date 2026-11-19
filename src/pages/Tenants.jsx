import { useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { useTenant } from '@/layouts/RootLayout';
import { requireSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ListSkeleton } from '@/components/PageSkeleton';
export const route={path:'/tenants',layout:'owner',access:'authenticated'};
export const nav={icon:'Building2',label:'Businesses',order:3,profiles:null};
export default function Tenants(){
 const {memberships}=useTenant(); const [search,setSearch]=useState(''); const [rows,setRows]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
 useEffect(()=>{let alive=true;(async()=>{try{const ids=memberships.map(m=>m.tenant_id);if(!ids.length){setRows([]);return;}const {data,error}=await requireSupabase().from('tenants').select('id,legal_name,display_name,slug,status,country_code,timezone').in('id',ids).order('display_name');if(error)throw error;if(alive)setRows(data||[]);}catch(e){if(alive)setError(e.message);}finally{if(alive)setLoading(false);}})();return()=>{alive=false};},[memberships]);
 const filtered=rows.filter(r=>(r.display_name+' '+r.legal_name+' '+r.slug).toLowerCase().includes(search.toLowerCase()));
 return <div className="mx-auto max-w-6xl space-y-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-xs font-bold uppercase tracking-widest text-primary">Workspace administration</div><h1 className="brand-heading mt-1 text-3xl font-black">Your businesses</h1><p className="mt-1 text-sm text-muted-foreground">Organisations where your account has an active membership.</p></div><Button asChild><Link to="/workspace/new">Create workspace</Link></Button></div><Card><CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle>Organisation memberships <Badge variant="secondary">{filtered.length}</Badge></CardTitle><Input className="max-w-xs" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search workspace…"/></CardHeader><CardContent>{loading?<ListSkeleton rows={4}/>:error?<p className="text-sm text-destructive">{error}</p>:filtered.length?<div className="divide-y">{filtered.map(r=><div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><div className="font-bold">{r.display_name}</div><div className="text-xs text-muted-foreground">{r.legal_name} · {r.slug}</div></div><div className="flex items-center gap-3"><Badge variant={r.status==='active'?'default':'secondary'}>{r.status}</Badge><Button asChild size="sm" variant="outline"><Link to={'/tenants/'+r.id}>View</Link></Button></div></div>)}</div>:<p className="py-8 text-center text-sm text-muted-foreground">No active organisation memberships were found.</p>}</CardContent></Card></div>;
}