import { useEffect,useState } from 'react';
import { Link,useNavigate,useParams } from 'react-router-dom';
import { requireSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
export const route={path:'/tenants/:id/edit',layout:'owner',access:'authenticated'};
export default function TenantEdit(){const {id}=useParams();const navigate=useNavigate();const [row,setRow]=useState(null);const [name,setName]=useState('');const [legal,setLegal]=useState('');const [saving,setSaving]=useState(false);const [error,setError]=useState('');
 useEffect(()=>{let alive=true;(async()=>{const {data,error}=await requireSupabase().from('tenants').select('id,legal_name,display_name,slug,status').eq('id',id).single();if(!alive)return;if(error)setError(error.message);else{setRow(data);setName(data.display_name);setLegal(data.legal_name);}})();return()=>{alive=false}},[id]);
 async function save(e){e.preventDefault();setSaving(true);try{const {error}=await requireSupabase().from('tenants').update({display_name:name.trim(),legal_name:legal.trim()}).eq('id',id);if(error)throw error;toast.success('Workspace profile updated');navigate('/tenants/'+id);}catch(e){toast.error(e.message);}finally{setSaving(false)}}
 if(error)return <p className="text-sm text-destructive">{error}</p>;if(!row)return <p className="text-sm text-muted-foreground">Loading workspace…</p>;
 return <div className="mx-auto max-w-2xl space-y-5"><Link to={'/tenants/'+id} className="text-sm text-muted-foreground">← Back to workspace</Link><h1 className="brand-heading text-3xl font-black">Edit workspace</h1><Card><CardHeader><CardTitle>Organisation details</CardTitle></CardHeader><CardContent><form onSubmit={save} className="space-y-4"><div className="space-y-2"><Label>Display name</Label><Input value={name} onChange={e=>setName(e.target.value)} required maxLength={100}/></div><div className="space-y-2"><Label>Legal name</Label><Input value={legal} onChange={e=>setLegal(e.target.value)} required maxLength={160}/></div><div className="text-xs text-muted-foreground">Workspace slug and status are managed separately to avoid accidental URL or access changes.</div><Button disabled={saving}>{saving?'Saving…':'Save changes'}</Button></form></CardContent></Card></div>;
}