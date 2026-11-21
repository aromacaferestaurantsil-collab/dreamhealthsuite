import { useMemo,useState } from 'react';
import { useLocation,useNavigate } from 'react-router-dom';
import { requireSupabase } from '@/lib/supabase';
import { getMyMemberships } from '@/services/healthsuite';
import AuthLayout from './AuthLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

async function hashToken(token) {
  if (!globalThis.crypto?.subtle) throw new Error('Secure token hashing is not available in this browser');
  const bytes = new TextEncoder().encode(token.trim());
  const digest = await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export default function AcceptInvitation() {
 const location=useLocation(); const navigate=useNavigate();
 const initialToken=useMemo(()=>new URLSearchParams(location.search).get('token')||'', [location.search]);
 const [token,setToken]=useState(initialToken); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
 async function accept(event){
  event.preventDefault();setError('');
  if(!token.trim())return setError('Enter the invitation token from your organisation administrator.');
  setBusy(true);
  try{
   const client=requireSupabase();
   const {data:userData,error:userError}=await client.auth.getUser();
   if(userError)throw userError;
   if(!userData.user)throw new Error('Sign in with the invited email address before accepting this invitation.');
   if(!userData.user.email_confirmed_at)throw new Error('Verify your email address before accepting the invitation.');
   const tokenHash=await hashToken(token);
   const {error:redeemError}=await client.rpc('redeem_tenant_invitation',{p_token_hash:tokenHash});
   if(redeemError)throw redeemError;
   const memberships=await getMyMemberships();
   if(!memberships.length)throw new Error('Invitation redeemed, but no active workspace membership could be loaded. Sign out and sign back in.');
   toast.success('Invitation accepted. Your workspace access is active.');
   navigate('/',{replace:true});
  }catch(e){setError(e.message||'Unable to accept invitation');}
  finally{setBusy(false);}
 }
 return <AuthLayout title="Accept workspace invitation" icon="UserPlus" description="Use the token sent by your organisation administrator. Your signed-in, verified email must match the invitation.">
  <form onSubmit={accept} className="space-y-3">
   <div className="space-y-1"><Label htmlFor="invite-token">Invitation token</Label><Input id="invite-token" value={token} onChange={e=>setToken(e.target.value)} autoComplete="off" required placeholder="Paste your invitation token"/></div>
   {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
   <Button type="submit" className="w-full" disabled={busy}>{busy?'Verifying invitation…':'Accept invitation'}</Button>
   <p className="text-xs text-center text-muted-foreground">This invitation is one-use and expires. If it does not match your signed-in email, ask the administrator to issue a new one.</p>
  </form>
 </AuthLayout>;
}
