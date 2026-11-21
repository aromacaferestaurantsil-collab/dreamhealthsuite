import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/layouts/RootLayout';
import { requireSupabase } from '@/lib/supabase';
import { verifyLabResult, labCreateSample, labUpdateSampleStatus, labEnterResult } from '@/services/healthsuite';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

export const route = { path: '/laboratory', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'Microscope', label: 'LabSuite', order: 11, profiles: ['Admin_c', 'Pathologist', 'LabTechnician'] };

const money = value => '₹' + Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const dateTime = value => value ? new Date(value).toLocaleString('en-IN') : '—';
const statusTone = status => {
  if (['released', 'verified', 'completed', 'active'].includes(String(status).toLowerCase())) return 'default';
  if (['rejected', 'cancelled', 'critical'].includes(String(status).toLowerCase())) return 'destructive';
  return 'secondary';
};

function Stat({ label, value }) {
  return <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="brand-heading mt-2 text-3xl font-black">{value}</p></CardContent></Card>;
}

export default function Laboratory() {
  const { activeTenant, user } = useAuth();
  const tenantId = activeTenant?.tenant_id;
  const [tests, setTests] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [samples, setSamples] = useState([]);
  const [results, setResults] = useState([]);
  const [bookingItems, setBookingItems] = useState([]);
  const [sampleForm, setSampleForm] = useState({ bookingItemId: '', sampleCode: '', specimenType: '' });
  const [resultForm, setResultForm] = useState({ bookingItemId: '', resultText: '', abnormalFlag: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifyingId, setVerifyingId] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ test_code: '', name: '', department: '', specimen_type: '', price: '', turnaround_hours: '' });
  const [editingTestId,setEditingTestId]=useState('');
  const [bookingActionId,setBookingActionId]=useState('');
  const [tab, setTab] = useState('overview');

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError('');
    try {
      const db = requireSupabase();
      const [testRes, bookingRes, itemRes, sampleRes, resultRes] = await Promise.all([
        db.from('lab_test_catalogue').select('id,test_code,name,department,specimen_type,price,turnaround_hours,status,created_at').eq('tenant_id', tenantId).order('name').limit(500),
        db.from('lab_bookings').select('id,booking_number,booking_status,booked_at,scheduled_at,total_amount,payment_status,patient_id').eq('tenant_id', tenantId).order('booked_at', { ascending: false }).limit(200),
        db.from('lab_booking_items').select('id,booking_id,test_id,item_status').eq('tenant_id', tenantId).limit(500),
        db.from('lab_samples').select('id,booking_item_id,sample_code,specimen_type,sample_status,collected_at,received_at,rejection_reason').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200),
        db.from('lab_results').select('id,booking_item_id,result_text,abnormal_flag,result_status,verified_by,verified_at,released_at,created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200),
      ]);
      for (const result of [testRes, bookingRes, itemRes, sampleRes, resultRes]) if (result.error) throw result.error;
      setTests(testRes.data || []);
      setBookings(bookingRes.data || []);
      setBookingItems(itemRes.data || []);
      setSamples(sampleRes.data || []);
      setResults(resultRes.data || []);
    } catch (e) {
      setError(e.message || 'Unable to load LabSuite records');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const resultCounts = useMemo(() => ({
    draft: results.filter(r => r.result_status === 'draft').length,
    entered: results.filter(r => r.result_status === 'entered').length,
    verified: results.filter(r => r.result_status === 'verified').length,
    released: results.filter(r => r.result_status === 'released').length,
  }), [results]);

  async function saveTest(event) {
    event.preventDefault();
    if (!tenantId) return toast.error('Select an active workspace first.');
    if (!form.name.trim()) return toast.error('Test name is required.');
    const price=Number(form.price||0),tat=form.turnaround_hours?Number(form.turnaround_hours):null;
    if(!Number.isFinite(price)||price<0)return toast.error('Test price cannot be negative');
    if(tat!==null&&(!Number.isInteger(tat)||tat<1||tat>720))return toast.error('Turnaround time must be between 1 and 720 hours');
    setSaving(true);
    try {
      const payload={tenant_id:tenantId,test_code:form.test_code.trim()||null,name:form.name.trim(),department:form.department.trim()||null,specimen_type:form.specimen_type.trim()||null,price,turnaround_hours:tat,status:'active'};
      const db=requireSupabase();
      const result=editingTestId
        ? await db.from('lab_test_catalogue').update(payload).eq('tenant_id',tenantId).eq('id',editingTestId)
        : await db.from('lab_test_catalogue').insert(payload);
      if(result.error)throw result.error;
      toast.success(editingTestId?'Test updated':'Test added to the catalogue.');
      setForm({test_code:'',name:'',department:'',specimen_type:'',price:'',turnaround_hours:''});setEditingTestId('');
      await load();
    } catch (e) { toast.error(e.message || 'Could not save test'); }
    finally { setSaving(false); }
  }
  function editTest(test){
    setEditingTestId(test.id);
    setForm({test_code:test.test_code||'',name:test.name||'',department:test.department||'',specimen_type:test.specimen_type||'',price:String(test.price??0),turnaround_hours:test.turnaround_hours?String(test.turnaround_hours):''});
  }
  async function setTestStatus(test,status){
    setSaving(true);try{
      const {error}=await requireSupabase().from('lab_test_catalogue').update({status}).eq('tenant_id',tenantId).eq('id',test.id);
      if(error)throw error;toast.success('Test status updated');await load();
    }catch(e){toast.error(e.message||'Unable to change test status');}finally{setSaving(false);}
  }
  async function reviewBooking(bookingId,decision){
    if(!['confirmed','rejected'].includes(decision))return;
    setBookingActionId(bookingId);
    try{
      const {error}=await requireSupabase().rpc('lab_review_booking_request',{p_booking_id:bookingId,p_decision:decision,p_notes:null});
      if(error)throw error;toast.success(decision==='confirmed'?'Booking confirmed':'Booking request rejected');await load();
    }catch(e){toast.error(e.message||'Unable to review booking request');}
    finally{setBookingActionId('');}
  }

  const bookingItemLabel = item => {
    const booking = bookings.find(b => b.id === item.booking_id);
    const test = tests.find(t => t.id === item.test_id);
    return `${booking?.booking_number || 'Booking'} · ${test?.name || 'Test'}`;
  };

  async function createSample(event) {
    event.preventDefault();
    if (!sampleForm.bookingItemId || !sampleForm.sampleCode.trim() || !sampleForm.specimenType.trim()) {
      toast.error('Select a booking item and enter the sample code and specimen type.');
      return;
    }
    setSaving(true);
    try {
      await labCreateSample({ tenantId, bookingItemId: sampleForm.bookingItemId, sampleCode: sampleForm.sampleCode, specimenType: sampleForm.specimenType });
      toast.success('Sample registered.');
      setSampleForm({ bookingItemId: '', sampleCode: '', specimenType: '' });
      await load();
    } catch (e) {
      toast.error(e.message || 'Could not register sample');
    } finally {
      setSaving(false);
    }
  }

  async function changeSampleStatus(sampleId, newStatus) {
    setSaving(true);
    try {
      await labUpdateSampleStatus({ tenantId, sampleId, newStatus });
      toast.success(`Sample marked ${newStatus}.`);
      await load();
    } catch (e) {
      toast.error(e.message || 'Could not update sample status');
    } finally {
      setSaving(false);
    }
  }

  async function saveResult(event) {
    event.preventDefault();
    if (!resultForm.bookingItemId || !resultForm.resultText.trim()) {
      toast.error('Select a processed booking item and enter the result.');
      return;
    }
    setSaving(true);
    try {
      await labEnterResult({
        tenantId,
        bookingItemId: resultForm.bookingItemId,
        resultText: resultForm.resultText,
        abnormalFlag: resultForm.abnormalFlag,
      });
      toast.success('Result entered and sent to the pathologist verification queue.');
      setResultForm({ bookingItemId: '', resultText: '', abnormalFlag: false });
      await load();
    } catch (e) {
      toast.error(e.message || 'Could not enter result');
    } finally {
      setSaving(false);
    }
  }

  async function verifyResult(resultId, release) {
    setVerifyingId(resultId);
    try {
      await verifyLabResult(resultId, release);
      toast.success(release ? 'Result verified and released.' : 'Result verified.');
      await load();
    } catch (e) {
      toast.error(e.message || 'Verification was rejected by the server.');
    } finally {
      setVerifyingId('');
    }
  }

  const isPathologist = String(activeTenant?.role || user?.role || '').toLowerCase() === 'pathologist';

  return <div className="mx-auto max-w-7xl space-y-6">
    <section className="rounded-2xl bg-primary px-6 py-7 text-primary-foreground">
      <div className="text-xs font-bold uppercase tracking-widest opacity-80">HealthSuite 360 · Diagnostic centre operations</div>
      <h1 className="brand-heading mt-2 text-3xl font-black">LabSuite</h1>
      <p className="mt-2 max-w-3xl text-sm opacity-85">Manage test definitions, bookings, sample tracking and protected result verification within the active organisation.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {['Test catalogue', 'Bookings', 'Sample chain of custody', 'Independent verification'].map(tag => <Badge key={tag} variant="outline" className="border-primary-foreground/40 text-primary-foreground">{tag}</Badge>)}
      </div>
    </section>

    {!tenantId && <Card><CardContent className="p-6 text-sm text-muted-foreground">No active workspace is selected. Choose an organisation before opening LabSuite.</CardContent></Card>}
    {error && <Card><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}

    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{activeTenant?.tenants?.display_name || 'Active workspace'} · tenant-scoped records</p>
      <Button variant="outline" size="sm" onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh data'}</Button>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Stat label="Active tests" value={tests.filter(t => t.status === 'active').length} />
      <Stat label="Bookings" value={bookings.length} />
      <Stat label="Samples" value={samples.length} />
      <Stat label="Awaiting verification" value={resultCounts.entered} />
      <Stat label="Released reports" value={resultCounts.released} />
    </div>

    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="flex h-auto flex-wrap justify-start">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="catalogue">Test catalogue</TabsTrigger>
        <TabsTrigger value="bookings">Bookings</TabsTrigger>
        <TabsTrigger value="samples">Samples</TabsTrigger>
        <TabsTrigger value="results">Results & verification</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-base">Recent bookings</CardTitle></CardHeader><CardContent className="space-y-3">
          {bookings.slice(0, 6).map(b => <div key={b.id} className="flex items-center justify-between gap-3 border-b pb-3 text-sm"><div><p className="font-semibold">{b.booking_number}</p><p className="text-xs text-muted-foreground">{dateTime(b.booked_at)}</p></div><Badge variant={statusTone(b.booking_status)}>{b.booking_status}</Badge></div>)}
          {!bookings.length && <p className="py-5 text-sm text-muted-foreground">No lab bookings in this workspace yet.</p>}
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Result release queue</CardTitle></CardHeader><CardContent className="space-y-3">
          {results.slice(0, 6).map(r => <div key={r.id} className="flex items-center justify-between gap-3 border-b pb-3 text-sm"><div><p className="font-semibold">Result {r.id.slice(0, 8)}</p><p className="text-xs text-muted-foreground">Created {dateTime(r.created_at)}</p></div><Badge variant={statusTone(r.result_status)}>{r.result_status}</Badge></div>)}
          {!results.length && <p className="py-5 text-sm text-muted-foreground">No result records are available.</p>}
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="catalogue" className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card><CardHeader><CardTitle className="text-base">{editingTestId?'Edit diagnostic test':'Add diagnostic test'}</CardTitle></CardHeader><CardContent>
          <form onSubmit={saveTest} className="space-y-3">
            <div className="space-y-1"><Label>Test name *</Label><Input value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} required maxLength={160} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label>Test code</Label><Input value={form.test_code} onChange={e => setForm(v => ({ ...v, test_code: e.target.value }))} maxLength={40} /></div>
              <div className="space-y-1"><Label>Department</Label><Input value={form.department} onChange={e => setForm(v => ({ ...v, department: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Specimen type</Label><Input value={form.specimen_type} onChange={e => setForm(v => ({ ...v, specimen_type: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Price (₹)</Label><Input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(v => ({ ...v, price: e.target.value }))} /></div>
              <div className="space-y-1 sm:col-span-2"><Label>Turnaround time (hours)</Label><Input type="number" min="1" step="1" value={form.turnaround_hours} onChange={e => setForm(v => ({ ...v, turnaround_hours: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2"><Button type="submit" className="flex-1" disabled={saving}>{saving?'Saving…':editingTestId?'Update test':'Add test'}</Button>{editingTestId&&<Button type="button" variant="outline" onClick={()=>{setEditingTestId('');setForm({test_code:'',name:'',department:'',specimen_type:'',price:'',turnaround_hours:''})}}>Cancel</Button>}</div>
          </form>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Diagnostic test catalogue</CardTitle></CardHeader><CardContent>
          <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="py-3">Test</th><th>Department</th><th>Specimen</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead><tbody className="divide-y">
            {tests.map(t => <tr key={t.id}><td className="py-3 font-semibold">{t.name}<div className="text-xs font-normal text-muted-foreground">{t.test_code || 'No code'} · {t.turnaround_hours ? t.turnaround_hours + 'h' : 'TAT not set'}</div></td><td>{t.department || '—'}</td><td>{t.specimen_type || '—'}</td><td>{money(t.price)}</td><td><Badge variant={statusTone(t.status)}>{t.status}</Badge></td><td className="whitespace-nowrap"><Button size="sm" variant="outline" onClick={()=>editTest(t)}>Edit</Button><Button size="sm" variant="ghost" disabled={saving} onClick={()=>setTestStatus(t,t.status==='active'?'inactive':'active')}>{t.status==='active'?'Deactivate':'Activate'}</Button></td></tr>)}
          </tbody></table>{!tests.length && <p className="py-8 text-center text-sm text-muted-foreground">No tests configured yet. Add the first test to begin.</p>}</div>
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="bookings"><Card><CardHeader><CardTitle className="text-base">Lab bookings</CardTitle></CardHeader><CardContent>
        <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="py-3">Booking</th><th>Booked</th><th>Scheduled</th><th>Amount</th><th>Payment</th><th>Status</th><th>Action</th></tr></thead><tbody className="divide-y">
          {bookings.map(b => <tr key={b.id}><td className="py-3 font-semibold">{b.booking_number}</td><td>{dateTime(b.booked_at)}</td><td>{dateTime(b.scheduled_at)}</td><td>{money(b.total_amount)}</td><td>{b.payment_status}</td><td><Badge variant={statusTone(b.booking_status)}>{b.booking_status}</Badge></td><td>{b.booking_status==='requested'&&['owner','admin','manager','receptionist'].includes(activeTenant?.role)?<div className="flex gap-1"><Button size="sm" disabled={bookingActionId===b.id} onClick={()=>reviewBooking(b.id,'confirmed')}>Confirm</Button><Button size="sm" variant="outline" disabled={bookingActionId===b.id} onClick={()=>reviewBooking(b.id,'rejected')}>Reject</Button></div>:<span className="text-xs text-muted-foreground">{b.booking_status==='confirmed'?'Confirmed':'—'}</span>}</td></tr>)}
        </tbody></table>{!bookings.length && <p className="py-8 text-center text-sm text-muted-foreground">No bookings found.</p>}</div>
      </CardContent></Card></TabsContent>

      <TabsContent value="samples" className="space-y-4">
        <Card><CardHeader><CardTitle className="text-base">Register a sample</CardTitle></CardHeader><CardContent>
          <form onSubmit={createSample} className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1"><Label>Booking item</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={sampleForm.bookingItemId} onChange={e => setSampleForm(v => ({ ...v, bookingItemId: e.target.value }))} required>
              <option value="">Select booking item</option>
              {bookingItems.filter(i => !samples.some(s => s.booking_item_id === i.id)).map(i => <option key={i.id} value={i.id}>{bookingItemLabel(i)}</option>)}
            </select></div>
            <div className="space-y-1"><Label>Sample code</Label><Input value={sampleForm.sampleCode} onChange={e => setSampleForm(v => ({ ...v, sampleCode: e.target.value }))} required maxLength={80} /></div>
            <div className="space-y-1"><Label>Specimen type</Label><Input value={sampleForm.specimenType} onChange={e => setSampleForm(v => ({ ...v, specimenType: e.target.value }))} required maxLength={80} /></div>
            <div className="md:col-span-3"><Button type="submit" disabled={saving || !sampleForm.bookingItemId}>Register sample</Button></div>
          </form>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Sample chain of custody</CardTitle></CardHeader><CardContent>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="py-3">Sample code</th><th>Booking item</th><th>Specimen</th><th>Collected</th><th>Received</th><th>Status</th><th>Next action</th></tr></thead><tbody className="divide-y">
            {samples.map(s => <tr key={s.id}><td className="py-3 font-semibold">{s.sample_code}</td><td>{bookingItemLabel(bookingItems.find(i => i.id === s.booking_item_id) || {})}</td><td>{s.specimen_type || '—'}</td><td>{dateTime(s.collected_at)}</td><td>{dateTime(s.received_at)}</td><td><Badge variant={statusTone(s.sample_status)}>{s.sample_status}</Badge></td><td>
              {s.sample_status === 'pending' ? <Button size="sm" variant="outline" disabled={saving} onClick={() => changeSampleStatus(s.id, 'collected')}>Collect</Button> :
               s.sample_status === 'collected' ? <Button size="sm" variant="outline" disabled={saving} onClick={() => changeSampleStatus(s.id, 'received')}>Receive</Button> :
               s.sample_status === 'received' ? <Button size="sm" variant="outline" disabled={saving} onClick={() => changeSampleStatus(s.id, 'processed')}>Mark processed</Button> :
               <span className="text-xs text-muted-foreground">—</span>}
            </td></tr>)}
          </tbody></table>{!samples.length && <p className="py-8 text-center text-sm text-muted-foreground">No samples are recorded yet.</p>}</div>
        </CardContent></Card>
      </TabsContent>

      <TabsContent value="results" className="space-y-4">
        <Card><CardHeader><CardTitle className="text-base">Enter test result</CardTitle></CardHeader><CardContent>
          <form onSubmit={saveResult} className="space-y-3">
            <div className="space-y-1"><Label>Processed booking item</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={resultForm.bookingItemId} onChange={e => setResultForm(v => ({ ...v, bookingItemId: e.target.value }))} required>
              <option value="">Select processed test</option>
              {bookingItems.filter(i => samples.some(s => s.booking_item_id === i.id && s.sample_status === 'processed') && !results.some(r => r.booking_item_id === i.id)).map(i => <option key={i.id} value={i.id}>{bookingItemLabel(i)}</option>)}
            </select></div>
            <div className="space-y-1"><Label>Result / observations</Label><Textarea rows={4} value={resultForm.resultText} onChange={e => setResultForm(v => ({ ...v, resultText: e.target.value }))} required placeholder="Enter the measured value and interpretation" /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={resultForm.abnormalFlag} onChange={e => setResultForm(v => ({ ...v, abnormalFlag: e.target.checked }))} /> Flag as abnormal</label>
            <Button type="submit" disabled={saving || !resultForm.bookingItemId}>Save result for independent verification</Button>
          </form>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Result verification and release</CardTitle></CardHeader><CardContent>
          <p className="mb-4 text-sm text-muted-foreground">Results are entered only after a sample is processed. A separate pathologist verifies and releases each report.</p>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="py-3">Result</th><th>Abnormal flag</th><th>Status</th><th>Verified</th><th>Released</th><th>Action</th></tr></thead><tbody className="divide-y">
            {results.map(r => <tr key={r.id}><td className="py-3 font-semibold">{r.id.slice(0, 8)}</td><td>{r.abnormal_flag ? <Badge variant="destructive">Abnormal</Badge> : 'No flag'}</td><td><Badge variant={statusTone(r.result_status)}>{r.result_status}</Badge></td><td>{dateTime(r.verified_at)}</td><td>{dateTime(r.released_at)}</td><td>{isPathologist && r.result_status === 'entered' ? <Button size="sm" disabled={verifyingId === r.id} onClick={() => verifyResult(r.id, false)}>{verifyingId === r.id ? 'Verifying…' : 'Verify result'}</Button> : isPathologist && r.result_status === 'verified' ? <Button size="sm" disabled={verifyingId === r.id} onClick={() => verifyResult(r.id, true)}>{verifyingId === r.id ? 'Releasing…' : 'Release report'}</Button> : <span className="text-xs text-muted-foreground">{r.result_status === 'released' ? 'Released' : r.result_status === 'draft' ? 'Awaiting result entry' : 'Pathologist action required'}</span>}</td></tr>)}
          </tbody></table>{!results.length && <p className="py-8 text-center text-sm text-muted-foreground">No result records found.</p>}</div>
        </CardContent></Card>
      </TabsContent>
    </Tabs>

    <Card><CardHeader><CardTitle className="text-base">Clinical safety and current scope</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
      <p className="rounded-lg border p-3">Patient identity is not exposed in the general booking list. Patient details must be retrieved only through authorised, tenant-scoped workflows.</p>
      <p className="rounded-lg border p-3">Result verification uses the database RPC; direct browser updates to result verification fields are not used. A result author cannot verify their own work.</p>
      <p className="rounded-lg border p-3">This phase includes test catalogue entry and operational visibility. Booking creation, barcode printing, sample status transitions and result entry need dedicated transactional workflows before clinical use.</p>
      <p className="rounded-lg border p-3">Use synthetic demo records only. The production database has not been migrated or seeded by this change.</p>
    </CardContent></Card>
  </div>;
}
