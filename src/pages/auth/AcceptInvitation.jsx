import { useMemo,useState } from 'react';
import { useLocation,useNavigate,Link } from 'react-router-dom';
import { requireSupabase } from '@/lib/supabase';
import AuthLayout from './AuthLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/layouts/RootLayout';

async function hashToken(token) {
  if (!globalThis.crypto?.subtle) throw new Error('Secure token hashing is not available in this browser');
  const bytes = new TextEncoder().encode(token.trim());
  const digest = await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export default function AcceptInvitation() {
 const location=useLocation(); const navigate=useNavigate(); const {user}=useAuth();
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
   toast.success('Invitation accepted. Your workspace access is active.');
   window.location.replace('/');
  }catch(e){setError(e.message||'Unable to accept invitation');}
  finally{setBusy(false);}
 }
 const returnPath='/accept-invite?token='+encodeURIComponent(token||initialToken);
 const loginHref='/login?redirect='+encodeURIComponent(returnPath);
 const signupHref='/signup?redirect='+encodeURIComponent(returnPath);
 return <AuthLayout title="Accept workspace invitation" icon="UserPlus" description="Use the token sent by your organisation administrator. Your signed-in, verified email must match the invitation.">
  {!user&&<div className="mb-3 rounded-lg border p-3 text-sm"><p className="text-muted-foreground">First sign in or create an account with the same email address this invitation was sent to.</p><div className="mt-2 flex gap-2"><Button asChild size="sm"><Link to={loginHref}>Sign in</Link></Button><Button asChild size="sm" variant="outline"><Link to={signupHref}>Create account</Link></Button></div></div>}
  <form onSubmit={accept} className="space-y-3">
   <div className="space-y-1"><Label htmlFor="invite-token">Invitation token</Label><Input id="invite-token" value={token} onChange={e=>setToken(e.target.value)} autoComplete="off" required placeholder="Paste your invitation token"/></div>
   {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
   <Button type="submit" className="w-full" disabled={busy||!user}>{busy?'Verifying invitation…':'Accept invitation'}</Button>
   <p className="text-xs text-center text-muted-foreground">This invitation is one-use and expires. If it does not match your signed-in email, ask the administrator to issue a new one.</p>
  </form>
 </AuthLayout>;
}
