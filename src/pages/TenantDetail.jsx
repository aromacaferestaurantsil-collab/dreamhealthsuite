import { useEffect,useState } from 'react';
import { Link,useParams } from 'react-router-dom';
import { requireSupabase } from '@/lib/supabase';
import { useTenant } from '@/layouts/RootLayout';
import { Button } from '@/components/ui/button';
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
export const route={path:'/tenants/:id',layout:'owner',access:'authenticated'};
export default function TenantDetail(){const {id}=useParams();const {memberships,setActiveTenant}=useTenant();const [row,setRow]=useState(null);const [error,setError]=useState('');
 useEffect(()=>{let alive=true;(async()=>{const {data,error}=await requireSupabase().from('tenants').select('id,legal_name,display_name,slug,status,country_code,timezone,created_at').eq('id',id).single();if(!alive)return;if(error)setError(error.message);else setRow(data)})();return()=>{alive=false}},[id]);
 if(error)return <p className="text-sm text-destructive">{error}</p>;if(!row)return <p className="text-sm text-muted-foreground">Loading workspace…</p>;
 const membership=memberships.find(m=>m.tenant_id===id);
 return <div className="mx-auto max-w-4xl space-y-6"><Link to="/tenants" className="text-sm text-muted-foreground">← Back to businesses</Link><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="brand-heading text-3xl font-black">{row.display_name}</h1><p className="text-sm text-muted-foreground">{row.legal_name}</p></div><Badge>{row.status}</Badge></div><Card><CardHeader><CardTitle>Workspace profile</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 text-sm"><div><div className="text-muted-foreground">Workspace key</div><strong>{row.slug}</strong></div><div><div className="text-muted-foreground">Country</div><strong>{row.country_code||'—'}</strong></div><div><div className="text-muted-foreground">Timezone</div><strong>{row.timezone||'—'}</strong></div><div><div className="text-muted-foreground">Your role</div><strong>{membership?.role||'No active membership'}</strong></div></CardContent></Card><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={()=>setActiveTenant(id)}>Set as active workspace</Button><Button asChild><Link to={'/tenants/'+id+'/edit'}>Edit profile</Link></Button></div></div>;
}