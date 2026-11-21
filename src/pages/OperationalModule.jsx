import { useEffect, useMemo, useState } from 'react';
import { useTenant } from '@/layouts/RootLayout';
import { requireSupabase } from '@/lib/supabase';
import { useProfile } from '@/hooks/useProfile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const display = value => value == null || value === '' ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);

export default function OperationalModule({ config }) {
  const { activeTenant } = useTenant();
  const { profile } = useProfile();
  const [active, setActive] = useState(0);
  const [values, setValues] = useState({});
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [lookupRows, setLookupRows] = useState([]);
  const entity = config.entities[active] || config.entities[0];
  const columns = useMemo(() => entity.fields.filter(f => f.list !== false).slice(0, 7), [entity]);

  async function load() {
    if (!activeTenant?.tenant_id) { setRows([]); return; }
    setLoading(true); setError('');
    try {
      const client = requireSupabase();
      const { data, error: queryError } = await client.from(entity.table)
        .select('*').eq('tenant_id', activeTenant.tenant_id)
        .order(entity.orderBy || 'created_at', { ascending: false }).limit(200);
      if (queryError) throw queryError;
      setRows(data || []);
    } catch (e) { setError(e.message || 'Could not load records'); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [active, activeTenant?.tenant_id]);
  useEffect(() => {
    let alive = true;
    async function loadLookups() {
      const lookup = entity.lookup;
      if (!lookup || !activeTenant?.tenant_id) { setLookupRows([]); return; }
      try {
        let query = requireSupabase().from(lookup.table).select(lookup.select || 'id,patient_code,full_name')
          .eq('tenant_id', activeTenant.tenant_id).order(lookup.labelField || 'full_name').limit(500);
        if (lookup.branchScoped && activeTenant.branch_id) query = query.eq('branch_id', activeTenant.branch_id);
        const {data,error} = await query;
        if (error) throw error;
        if (alive) setLookupRows(data || []);
      } catch (e) {
        if (alive) { setLookupRows([]); setError(e.message || 'Unable to load related records'); }
      }
    }
    loadLookups();
    return () => { alive = false; };
  }, [entity.table, activeTenant?.tenant_id, activeTenant?.branch_id]);

  async function createRecord(event) {
    event.preventDefault();
    if (!activeTenant?.tenant_id) return toast.error('Select an active organisation first.');
    setSaving(true);
    try {
      const client = requireSupabase();
      const { data: auth } = await client.auth.getUser();
      const payload = { tenant_id: activeTenant.tenant_id };
      if (entity.branchScoped && activeTenant.branch_id) payload.branch_id = activeTenant.branch_id;
      if (entity.createdBy && !editingId) payload[entity.createdBy] = auth.user?.id;
      for (const field of entity.fields) {
        const value = values[field.name];
        if (value === undefined || value === '') continue;
        payload[field.name] = field.type === 'number' ? Number(value)
          : field.type === 'boolean' ? value === 'true'
          : field.type === 'json' ? (typeof value === 'string' ? { text: value } : value)
          : value;
      }
      const missing = entity.fields.find(f => f.required && (payload[f.name] === undefined || payload[f.name] === null || payload[f.name] === ''));
      if (missing) throw new Error(missing.label + ' is required');
      if (entity.lookup) {
        const lookupValue = payload[entity.lookup.field];
        if (!lookupRows.some(item => item.id === lookupValue)) throw new Error('Choose a valid related record from this workspace');
      }
      if (entity.table === 'patient_consents' && payload.granted === false && !payload.withdrawn_at) {
        payload.withdrawn_at = new Date().toISOString();
      }
      let request = client.from(entity.table);
      if (editingId) {
        const { error: updateError } = await request.update(payload).eq('tenant_id', activeTenant.tenant_id).eq('id', editingId);
        if (updateError) throw updateError;
        toast.success(entity.singular + ' updated');
      } else {
        const { error: insertError } = await request.insert(payload);
        if (insertError) throw insertError;
        toast.success(entity.singular + ' saved');
      }
      setValues({});
      setEditingId('');
      await load();
    } catch (e) { toast.error(e.message || 'Could not save record'); }
    finally { setSaving(false); }
  }

  function startEdit(row) {
    const next = {};
    for (const field of entity.fields) {
      const value = row[field.name];
      next[field.name] = value == null ? '' : field.type === 'boolean' ? String(Boolean(value)) : value;
    }
    setEditingId(row.id);
    setValues(next);
  }
  function cancelEdit() { setEditingId(''); setValues({}); }
  async function changeStatus(row, status) {
    if (!entity.statusField) return;
    setSaving(true);
    try {
      const payload = { [entity.statusField]: status };
      if (entity.withdrawConsent && entity.statusField === 'granted' && status === false) payload.withdrawn_at = new Date().toISOString();
      const {error} = await requireSupabase().from(entity.table).update(payload).eq('tenant_id',activeTenant.tenant_id).eq('id',row.id);
      if (error) throw error;
      toast.success(entity.singular + ' status updated');
      await load();
    } catch (e) { toast.error(e.message || 'Could not update status'); }
    finally { setSaving(false); }
  }

  return <div className="mx-auto max-w-7xl space-y-6">
    <section className="rounded-2xl bg-primary px-6 py-7 text-primary-foreground">
      <div className="text-xs font-bold uppercase tracking-widest opacity-80">HealthSuite 360 · {config.audience}</div>
      <h1 className="brand-heading mt-2 text-3xl font-black">{config.title}</h1>
      <p className="mt-2 max-w-3xl text-sm opacity-85">{config.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">{config.tags.map(tag => <Badge key={tag} variant="outline" className="border-primary-foreground/40 text-primary-foreground">{tag}</Badge>)}</div>
    </section>
    {!activeTenant ? <Card><CardContent className="p-5 text-sm">Choose or create an organisation workspace before accessing operational records.</CardContent></Card> : <>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-bold">{activeTenant.tenants?.display_name || 'Active workspace'}</div><div className="text-xs text-muted-foreground">Records are scoped to this tenant by Supabase Row Level Security.</div></div><div className="flex flex-wrap gap-2">{config.entities.map((item, index) => <Button key={item.table} size="sm" variant={active === index ? 'default' : 'outline'} onClick={() => { setActive(index); setValues({}); }}>{item.label}</Button>)}</div></div>
      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card><CardHeader><CardTitle>{editingId ? 'Edit ' + entity.singular : entity.singular + ' entry'}</CardTitle></CardHeader><CardContent>
          <form className="space-y-3" onSubmit={createRecord}>
            {entity.fields.filter(f => f.create !== false).map(field => <div key={field.name} className="space-y-1.5">
              <Label>{field.label}{field.required ? ' *' : ''}</Label>
              {field.lookup ? <Select value={values[field.name] || ''} onValueChange={v => setValues(old => ({ ...old, [field.name]: v }))}><SelectTrigger><SelectValue placeholder={'Select ' + field.label.toLowerCase()} /></SelectTrigger><SelectContent>{lookupRows.map(item => <SelectItem key={item.id} value={item.id}>{item[entity.lookup.labelField || 'full_name']}{item.patient_code ? ' · ' + item.patient_code : ''}</SelectItem>)}</SelectContent></Select>
              : field.options ? <Select value={values[field.name] || ''} onValueChange={v => setValues(old => ({ ...old, [field.name]: v }))}><SelectTrigger><SelectValue placeholder={'Select ' + field.label.toLowerCase()} /></SelectTrigger><SelectContent>{field.options.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>
              : field.type === 'multiline' ? <textarea className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" value={values[field.name] || ''} onChange={e => setValues(old => ({ ...old, [field.name]: e.target.value }))} />
              : <Input type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'datetime' ? 'datetime-local' : 'text'} step={field.type === 'number' ? '0.01' : undefined} value={values[field.name] || ''} onChange={e => setValues(old => ({ ...old, [field.name]: e.target.value }))} placeholder={field.placeholder || field.label} required={field.required} />}
            </div>)}
            <div className="flex gap-2"><Button className="flex-1" type="submit" disabled={saving}>{saving ? 'Saving…' : (editingId ? 'Update ' : 'Save ') + entity.singular}</Button>{editingId&&<Button type="button" variant="outline" onClick={cancelEdit}>Cancel</Button>}</div>
          </form>
        </CardContent></Card>
        <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>{entity.label}</CardTitle><div className="flex items-center gap-2"><Badge variant="secondary">{rows.length} records</Badge><Button size="sm" variant="outline" onClick={load}>Refresh</Button></div></div></CardHeader><CardContent>
          {loading ? <p className="py-8 text-sm text-muted-foreground">Loading records…</p> : error ? <p className="py-6 text-sm text-destructive">{error}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr>{columns.map(f => <th key={f.name} className="py-3 pr-3">{f.label}</th>)}<th className="py-3 text-right">Actions</th></tr></thead><tbody className="divide-y">{rows.map(row => <tr key={row.id}>{columns.map(f => <td key={f.name} className="max-w-56 truncate py-3 pr-3">{display(row[f.name])}</td>)}<td className="whitespace-nowrap py-3 text-right"><div className="flex justify-end gap-1">{entity.editable !== false&&<Button size="sm" variant="outline" disabled={saving} onClick={()=>startEdit(row)}>Edit</Button>}{entity.statusField&&entity.statusOptions?.map(option=>option!==row[entity.statusField]?<Button key={String(option)} size="sm" variant="ghost" disabled={saving} onClick={()=>changeStatus(row,option)}>{entity.statusField==='granted'&&option===false?'Withdraw':String(option)}</Button>:null)}</div></td></tr>)}</tbody></table>{!rows.length && <p className="py-8 text-center text-sm text-muted-foreground">No records yet.</p>}</div>}
        </CardContent></Card>
      </div>
    </>}
    <Card><CardHeader><CardTitle>Implementation and safety notes</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">{config.notes.map(note => <div key={note} className="rounded-lg border p-3">{note}</div>)}</CardContent></Card>
  </div>;
}
