import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTenant } from '@/services/healthsuite';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export const route = { path: '/workspace/new', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'Building2', label: 'Create workspace', order: 1, profiles: ['NoTenant'] };

const slugify = value => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48);

export default function WorkspaceOnboarding() {
  const navigate=useNavigate();
  const [legalName,setLegalName]=useState('');
  const [displayName,setDisplayName]=useState('');
  const [slug,setSlug]=useState('');
  const [branchName,setBranchName]=useState('Main Branch');
  const [branchCode,setBranchCode]=useState('MAIN');
  const [saving,setSaving]=useState(false);
  async function submit(event) {
    event.preventDefault();
    if(!legalName.trim() || !displayName.trim() || !slug.trim() || !branchName.trim() || !branchCode.trim()) {
      toast.error('Complete all required fields'); return;
    }
    setSaving(true);
    try {
      await createTenant({legalName:legalName.trim(),displayName:displayName.trim(),slug:slug.trim(),branchName:branchName.trim(),branchCode:branchCode.trim().toUpperCase()});
      toast.success('Workspace created. Loading your tenant access…');
      window.location.assign('/');
    } catch(error) { toast.error(error.message || 'Workspace creation failed'); }
    finally { setSaving(false); }
  }
  return <main className="mx-auto flex min-h-[75vh] max-w-2xl items-center px-4 py-10">
    <Card className="w-full">
      <CardHeader><div className="text-xs font-bold uppercase tracking-widest text-primary">HealthSuite 360 · Setup</div><CardTitle className="text-2xl">Create your healthcare workspace</CardTitle><p className="text-sm text-muted-foreground">Your account is authenticated. Create an organisation and its first branch to begin. You will become its owner.</p></CardHeader>
      <CardContent><form onSubmit={submit} className="space-y-4">
        <div className="space-y-1"><Label htmlFor="legal">Legal organisation name *</Label><Input id="legal" value={legalName} onChange={e=>{setLegalName(e.target.value);if(!displayName)setDisplayName(e.target.value);if(!slug)setSlug(slugify(e.target.value));}} required maxLength={160}/></div>
        <div className="space-y-1"><Label htmlFor="display">Workspace name *</Label><Input id="display" value={displayName} onChange={e=>setDisplayName(e.target.value)} required maxLength={100}/></div>
        <div className="space-y-1"><Label htmlFor="slug">Workspace URL key *</Label><Input id="slug" value={slug} onChange={e=>setSlug(slugify(e.target.value))} required maxLength={48} pattern="[a-z0-9]+(-[a-z0-9]+)*"/><p className="text-xs text-muted-foreground">Lowercase letters, numbers and hyphens; must be unique.</p></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor="branch">First branch *</Label><Input id="branch" value={branchName} onChange={e=>setBranchName(e.target.value)} required maxLength={100}/></div><div className="space-y-1"><Label htmlFor="code">Branch code *</Label><Input id="code" value={branchCode} onChange={e=>setBranchCode(e.target.value.toUpperCase())} required maxLength={20}/></div></div>
        <Button className="w-full" type="submit" disabled={saving}>{saving?'Creating workspace…':'Create workspace'}</Button>
      </form></CardContent>
    </Card>
  </main>;
}
