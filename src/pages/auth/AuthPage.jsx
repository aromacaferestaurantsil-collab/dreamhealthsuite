import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase, requireSupabase } from '@/lib/supabase';
import AuthLayout from './AuthLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function AuthPage({ mode }) {
  const navigate = useNavigate();
  const { profile: profileParam } = useParams();
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [confirmPassword,setConfirmPassword] = useState('');
  const [fullName,setFullName] = useState('');
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const signup = mode === 'signup';

  async function submit(event) {
    event.preventDefault();
    setError(''); setNotice('');
    if (!supabase) { setError('Authentication is not configured. Set the Supabase URL and publishable key.'); return; }
    if (signup && password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const client = requireSupabase();
      if (signup) {
        const { data, error: authError } = await client.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            // Return confirmation links to the deployed web app, not a localhost default.
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (authError) throw authError;
        if (data.session && data.user) {
          await client.from('user_profiles').upsert({ user_id: data.user.id, full_name: fullName.trim() }, { onConflict: 'user_id' });
          navigate('/', { replace: true });
        } else {
          setNotice('Check your email to confirm your account. After confirmation, sign in and create or join a workspace.');
        }
      } else {
        const { error: authError } = await client.auth.signInWithPassword({
          email: email.trim().toLowerCase(), password,
        });
        if (authError) throw authError;
        navigate('/', { replace: true });
      }
    } catch (e) {
      setError(e?.message || 'Authentication failed.');
    } finally { setLoading(false); }
  }

  const base = profileParam ? `/${profileParam}` : '';
  return (
    <AuthLayout title={signup ? 'Create a HealthSuite account' : 'Welcome to HealthSuite 360'} description={signup ? 'Create your secure account. Workspace access is granted through tenant membership.' : 'Sign in to your secure healthcare workspace.'}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {signup && <div className="space-y-1"><Label htmlFor="fullName">Full name</Label><Input id="fullName" value={fullName} onChange={e=>setFullName(e.target.value)} required autoComplete="name" /></div>}
        <div className="space-y-1"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" /></div>
        <div className="space-y-1"><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} autoComplete={signup?'new-password':'current-password'} /></div>
        {signup && <div className="space-y-1"><Label htmlFor="confirmPassword">Confirm password</Label><Input id="confirmPassword" type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" /></div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
        <Button type="submit" disabled={loading} className="mt-2 w-full">{loading ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}</Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {signup ? <>Already registered? <Link className="text-primary hover:underline" to={`${base}/login`}>Sign in</Link></> : <>New to HealthSuite? <Link className="text-primary hover:underline" to={`${base}/signup`}>Create an account</Link></>}
      </p>
      {!signup && <p className="mt-3 text-center text-xs text-muted-foreground"><Link to="/forgot-password" className="hover:underline">Forgot password?</Link></p>}
    </AuthLayout>
  );
}
