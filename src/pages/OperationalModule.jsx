import { useMemo, useState } from 'react';
import { sdk } from '@/services/sdk';
import { useFetch } from '@/hooks/useFetch';
import { useProfile } from '@/hooks/useProfile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const asText = value => {
  if (value == null) return '—';
  if (typeof value === 'object') return value.Name || value.name || value.Id || '—';
  return String(value);
};

export default function OperationalModule({ config }) {
  const { profile } = useProfile();
  const [active, setActive] = useState(0);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const entity = config.entities[active] || config.entities[0];
  const fields = entity.fields;
  const rows = useFetch(() => sdk.table(entity.table).select(fields.map(f => f.name)).orderByDesc('CreatedOn').limit(200).fetch().then(r => {
    if (!r.success) throw new Error(r.message || 'Could not load records');
    return r.data || [];
  }), [entity.table]);
  const canAdmin = profile === 'Admin_c';
  const columns = useMemo(() => fields.filter(f => f.list !== false).slice(0, 7), [fields]);

  async function createRecord(event) {
    event.preventDefault();
    if (!canAdmin) return toast.error('Only authorised administrators can create records until staff roles and tenant access are configured.');
    setSaving(true);
    try {
      const payload = {};
      fields.forEach(field => {
        const value = values[field.name];
        if (value !== undefined && value !== '') payload[field.name] = field.type === 'Number' || field.type === 'Decimal' ? Number(value) : value;
      });
      const requiredMissing = fields.find(f => f.required && !payload[f.name]);
      if (requiredMissing) throw new Error(requiredMissing.label + ' is required');
      const result = await sdk.table(entity.table).create(payload);
      if (!result.success) throw new Error(result.messages?.[0] || result.message || 'Could not save record');
      toast.success(entity.singular + ' saved');
      setValues({});
      rows.run();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return <div className="mx-auto max-w-7xl space-y-6">
    <section className="rounded-2xl bg-primary px-6 py-7 text-primary-foreground">
      <div className="text-xs font-bold uppercase tracking-widest opacity-80">HealthSuite 360 · {config.audience}</div>
      <h1 className="brand-heading mt-2 text-3xl font-black">{config.title}</h1>
      <p className="mt-2 max-w-3xl text-sm opacity-85">{config.description}</p>
      <div className="mt-4 flex flex-wrap gap-2">{config.tags.map(tag => <Badge key={tag} variant="outline" className="border-primary-foreground/40 text-primary-foreground">{tag}</Badge>)}</div>
    </section>
    <div className="flex flex-wrap gap-2">{config.entities.map((item,index)=><Button key={item.table} size="sm" variant={active===index?'default':'outline'} onClick={()=>{setActive(index);setValues({});}}>{item.label}</Button>)}</div>
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <Card>
        <CardHeader><CardTitle>{entity.singular} entry</CardTitle></CardHeader>
        <CardContent>
          {canAdmin ? <form className="space-y-3" onSubmit={createRecord}>
            {fields.filter(f=>f.create!==false).map(field=><div key={field.name} className="space-y-1.5">
              <Label>{field.label}{field.required?' *':''}</Label>
              {field.options ? <Select value={values[field.name]||''} onValueChange={v=>setValues(old=>({...old,[field.name]:v}))}><SelectTrigger><SelectValue placeholder={'Select '+field.label.toLowerCase()}/></SelectTrigger><SelectContent>{field.options.map(option=><SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>
              : field.type==='MultilineText' ? <textarea className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" value={values[field.name]||''} onChange={e=>setValues(old=>({...old,[field.name]:e.target.value}))} placeholder={field.placeholder||field.label}/>
              : <Input type={field.type==='Number'||field.type==='Decimal'?'number':field.type==='DateTime'?'datetime-local':field.type==='Date'?'date':'text'} step={field.type==='Decimal'?'0.01':undefined} value={values[field.name]||''} onChange={e=>setValues(old=>({...old,[field.name]:e.target.value}))} placeholder={field.placeholder||field.label}/>}
            </div>)}
            <Button className="w-full" type="submit" disabled={saving}>{saving?'Saving…':'Save '+entity.singular}</Button>
          </form> : <div className="rounded-lg border p-4 text-sm text-muted-foreground">Read-only access. Tenant memberships, staff roles and tenant-scoped row policies must be configured before staff data entry is enabled.</div>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>{entity.label}</CardTitle><div className="flex items-center gap-2"><Badge variant="secondary">{(rows.data||[]).length} records</Badge><Button size="sm" variant="outline" onClick={rows.run}>Refresh</Button></div></div></CardHeader>
        <CardContent>
          {rows.loading ? <p className="py-8 text-sm text-muted-foreground">Loading records…</p> : rows.error ? <p className="py-6 text-sm text-destructive">{rows.error.message||String(rows.error)}</p> : <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr>{columns.map(f=><th key={f.name} className="py-3 pr-3">{f.label}</th>)}</tr></thead><tbody className="divide-y">{(rows.data||[]).map((row,index)=><tr key={row.Id||index}>{columns.map(f=><td key={f.name} className="max-w-56 truncate py-3 pr-3">{f.type==='DateTime'&&row[f.name]?new Date(row[f.name]).toLocaleString():asText(row[f.name])}</td>)}</tr>)}</tbody></table>
            {!rows.data?.length&&<p className="py-8 text-center text-sm text-muted-foreground">No records yet. Add the first {entity.singular.toLowerCase()} using the form.</p>}
          </div>}
        </CardContent>
      </Card>
    </div>
    <Card><CardHeader><CardTitle>Implementation and safety notes</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">{config.notes.map(note=><div key={note} className="rounded-lg border p-3">{note}</div>)}</CardContent></Card>
  </div>;
}
