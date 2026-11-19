import { useState } from 'react';
import { requireSupabase } from '@/lib/supabase';
import { Card,CardContent,CardHeader,CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export const route={path:'/demo-workspace',layout:'public',access:'authenticated'};
export default function DemoWorkspaceClaim(){
 const [busy,setBusy]=useState(false);
 async function claim(){setBusy(true);try{const {data,error}=await requireSupabase().rpc('claim_demo_workspace');if(error)throw error;toast.success('Demo workspace connected. Loading your workspace…');window.location.assign(import.meta.env.BASE_URL)}catch(e){toast.error(e.message||'Could not claim the demo workspace')}finally{setBusy(false)}}
 return <main className="mx-auto max-w-xl p-4 md:p-10"><Card><CardHeader><p className="text-xs font-bold uppercase tracking-widest text-primary">HealthBuddy 360 · Development</p><CardTitle className="text-2xl">Claim the demo workspace</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Connect your signed-in account to the seeded synthetic workspace. It contains fictional patients, products, stock, sales, purchases, supplier schemes, expenses and a prescription-review example. It contains no live customer data.</p><ul className="list-disc space-y-1 pl-5 text-sm"><li>Admin and all six module entitlements</li><li>PharmaSuite sales and purchase history</li><li>Supplier scheme and creditor test records</li><li>Expiry, quarantine and barcode examples</li><li>Customer order awaiting pharmacist review</li></ul><Button onClick={claim} disabled={busy}>{busy?'Connecting…':'Claim demo workspace'}</Button><p className="text-xs text-muted-foreground">The shared demo workspace can be claimed by one tester account. This is a development-only workspace.</p></CardContent></Card></main>;
}
