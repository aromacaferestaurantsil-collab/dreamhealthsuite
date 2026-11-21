import {useCallback,useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {requireSupabase} from '@/lib/supabase';
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Textarea} from '@/components/ui/textarea';
import {toast} from 'sonner';

export const route={path:'/patient-portal',layout:'public',access:'authenticated'};
export const nav={icon:'HeartPulse',label:'My health portal',order:1,profiles:['Patient']};
const money=v=>'₹'+Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2});
const dt=v=>v?new Date(v).toLocaleString('en-IN'):'—';
export default function PatientPortal(){
 const [patient,setPatient]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [orders,setOrders]=useState([]),[orderItems,setOrderItems]=useState([]),[sales,setSales]=useState([]),[appointments,setAppointments]=useState([]),[labBookings,setLabBookings]=useState([]),[labItems,setLabItems]=useState([]),[results,setResults]=useState([]),[tests,setTests]=useState([]),[consents,setConsents]=useState([]);
 const [branches,setBranches]=useState([]),[doctors,setDoctors]=useState([]),[catalogue,setCatalogue]=useState([]);
 const [appointment,setAppointment]=useState({branch:'',doctor:'',starts_at:'',reason:''});
 const [labForm,setLabForm]=useState({branch:'',tests:[],scheduled_at:''});
 const [tab,setTab]=useState('overview'),[saving,setSaving]=useState(false);
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const db=requireSupabase();const {data:{user},error:userError}=await db.auth.getUser();if(userError)throw userError;if(!user)throw new Error('Sign in to view your patient portal.');
   const {data:linked,error:linkError}=await db.rpc('link_patient_profile_by_verified_email');
   if(linkError&&linkError.message!=='No active patient record matches this verified email'&&!linkError.message.includes('already linked'))throw linkError;
   let pQuery=db.from('patients').select('id,tenant_id,branch_id,patient_code,full_name,phone,email,status').eq('created_by',user.id).eq('status','active').limit(2);
   const {data:pRows,error:pError}=await pQuery;if(pError)throw pError;
   const p=pRows?.[0];if(!p){setPatient(null);return;}if(pRows.length>1)throw new Error('More than one patient record is linked to this account. Contact the provider to reconcile records.');
   setPatient(p);
   const [o,oi,s,a,lb,lbi,lr,t,c,b,d,m]=await Promise.all([
    db.from('pharmacy_customer_orders').select('id,order_number,order_status,prescription_path,customer_notes,created_at').eq('tenant_id',p.tenant_id).eq('patient_id',p.id).order('created_at',{ascending:false}).limit(100),
    db.from('pharmacy_customer_order_items').select('id,order_id,requested_name,quantity,item_status,pharmacist_note').eq('tenant_id',p.tenant_id).limit(500),
    db.from('pharmacy_sales').select('id,invoice_number,sale_status,payment_status,payment_method,grand_total,sold_at').eq('tenant_id',p.tenant_id).eq('patient_id',p.id).order('sold_at',{ascending:false}).limit(100),
    db.from('doctor_appointments').select('id,branch_id,doctor_id,appointment_number,starts_at,ends_at,appointment_status,reason').eq('tenant_id',p.tenant_id).eq('patient_id',p.id).order('starts_at',{ascending:false}).limit(100),
    db.from('lab_bookings').select('id,branch_id,booking_number,booking_status,booked_at,scheduled_at,total_amount,payment_status').eq('tenant_id',p.tenant_id).eq('patient_id',p.id).order('booked_at',{ascending:false}).limit(100),
    db.from('lab_booking_items').select('id,booking_id,test_id,price,item_status').eq('tenant_id',p.tenant_id).limit(500),
    db.from('lab_results').select('id,booking_item_id,result_text,abnormal_flag,result_status,released_at').eq('tenant_id',p.tenant_id).eq('result_status','released').limit(200),
    db.from('lab_test_catalogue').select('id,name,test_code,department,price,specimen_type,status').eq('tenant_id',p.tenant_id).eq('status','active').order('name').limit(500),
    db.from('patient_consents').select('id,consent_type,granted,captured_at,withdrawn_at,source').eq('tenant_id',p.tenant_id).eq('patient_id',p.id).order('captured_at',{ascending:false}),
    db.from('branches').select('id,name').eq('tenant_id',p.tenant_id).eq('status','active').order('name'),
    db.from('doctor_profiles').select('id,full_name,specialty,consultation_fee').eq('tenant_id',p.tenant_id).eq('status','active').order('full_name'),
    db.from('medicine_catalogue').select('id,name,strength,prescription_required').eq('tenant_id',p.tenant_id).eq('status','active').order('name').limit(500)
   ]);
   for(const x of [o,oi,s,a,lb,lbi,lr,t,c,b,d,m])if(x.error)throw x.error;
   setOrders(o.data||[]);setOrderItems(oi.data||[]);setSales(s.data||[]);setAppointments(a.data||[]);setLabBookings(lb.data||[]);setLabItems(lbi.data||[]);setResults(lr.data||[]);setTests(t.data||[]);setConsents(c.data||[]);setBranches(b.data||[]);setDoctors(d.data||[]);setCatalogue(m.data||[]);
  }catch(e){setError(e.message||'Unable to load patient records');}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{load()},[load]);
 const orderLabel=id=>orders.find(o=>o.id===id)?.order_number||'Order';
 const bookLabel=id=>labBookings.find(x=>x.id===id)?.booking_number||'Booking';
 const testName=id=>tests.find(t=>t.id===id)?.name||'Diagnostic test';
 async function requestAppointment(e){
  e.preventDefault();if(!patient)return;
  if(!appointment.branch||!appointment.doctor||!appointment.starts_at)return toast.error('Select a clinic, doctor and appointment time');
  setSaving(true);
  try{
   const {error}=await requireSupabase().rpc('patient_request_doctor_appointment',{p_patient_id:patient.id,p_branch_id:appointment.branch,p_doctor_id:appointment.doctor,p_starts_at:new Date(appointment.starts_at).toISOString(),p_reason:appointment.reason.trim()||null});
   if(error)throw error;toast.success('Appointment request submitted to the clinic');setAppointment({branch:'',doctor:'',starts_at:'',reason:''});await load();
  }catch(e){toast.error(e.message||'Unable to request appointment');}
  finally{setSaving(false);}
 }
 async function requestLab(e){
  e.preventDefault();if(!patient)return;
  if(!labForm.branch||!labForm.tests.length)return toast.error('Choose a branch and at least one test');
  setSaving(true);
  try{
   const {error}=await requireSupabase().rpc('patient_request_lab_booking',{p_patient_id:patient.id,p_branch_id:labForm.branch,p_test_ids:labForm.tests,p_scheduled_at:labForm.scheduled_at?new Date(labForm.scheduled_at).toISOString():null});
   if(error)throw error;toast.success('Diagnostic booking request submitted');setLabForm({branch:'',tests:[],scheduled_at:''});await load();
  }catch(e){toast.error(e.message||'Unable to request lab booking');}
  finally{setSaving(false);}
 }
 async function updateConsent(id,granted){
  setSaving(true);try{const {error}=await requireSupabase().rpc('patient_update_own_consent',{p_consent_id:id,p_granted:granted});if(error)throw error;toast.success(granted?'Consent enabled':'Consent withdrawn');await load();}
  catch(e){toast.error(e.message||'Unable to update consent');}finally{setSaving(false);}
 }
 if(loading)return <main className="mx-auto max-w-6xl p-6"><p className="text-sm text-muted-foreground">Loading your secure patient portal…</p></main>;
 if(error)return <main className="mx-auto max-w-3xl p-6"><Card><CardContent className="p-6 text-sm text-destructive">{error}</CardContent></Card></main>;
 if(!patient)return <main className="mx-auto max-w-3xl space-y-4 p-6"><h1 className="text-3xl font-black">Patient portal</h1><Card><CardHeader><CardTitle>Patient record not linked</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>Your signed-in, verified email must match the email saved on your patient record. If you have not registered with a participating clinic or pharmacy, contact them to create your patient record first.</p><Button asChild variant="outline"><Link to="/pharmacy-order">Open medicine ordering information</Link></Button></CardContent></Card></main>;
 return <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
  <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">HealthSuite 360 · PatientSuite</p><h1 className="mt-1 text-3xl font-black">Your health portal</h1><p className="text-sm text-muted-foreground">{patient.full_name} · Patient ID {patient.patient_code}</p></div><Button variant="outline" onClick={load}>Refresh</Button></header>
  <nav className="flex flex-wrap gap-2">{[['overview','Overview'],['appointments','Appointments'],['laboratory','Tests & reports'],['medicines','Medicines'],['consents','Privacy & consent']].map(([v,l])=><Button key={v} size="sm" variant={tab===v?'default':'outline'} onClick={()=>setTab(v)}>{l}</Button>)}</nav>
  {tab==='overview'&&<><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Appointments',appointments.length],['Lab bookings',labBookings.length],['Released reports',results.length],['Medicine requests',orders.length+sales.length]].map(([k,v])=><Card key={k}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{k}</p><p className="mt-1 text-2xl font-bold">{v}</p></CardContent></Card>)}</div><Card><CardHeader><CardTitle>Recent activity</CardTitle></CardHeader><CardContent className="space-y-3">{appointments.slice(0,3).map(a=><div key={a.id} className="flex justify-between gap-2 border-b pb-2 text-sm"><span>{a.appointment_number} · {dt(a.starts_at)}</span><Badge>{a.appointment_status}</Badge></div>)}{labBookings.slice(0,3).map(b=><div key={b.id} className="flex justify-between gap-2 border-b pb-2 text-sm"><span>{b.booking_number} · {dt(b.booked_at)}</span><Badge>{b.booking_status}</Badge></div>)}{!appointments.length&&!labBookings.length&&<p className="text-sm text-muted-foreground">No activity recorded yet.</p>}</CardContent></Card></>}
  {tab==='appointments'&&<div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]"><Card><CardHeader><CardTitle>Request doctor appointment</CardTitle></CardHeader><CardContent><form onSubmit={requestAppointment} className="space-y-3"><div className="space-y-1"><Label>Clinic branch</Label><Select value={appointment.branch} onValueChange={v=>setAppointment(x=>({...x,branch:v,doctor:''}))}><SelectTrigger><SelectValue placeholder="Select branch"/></SelectTrigger><SelectContent>{branches.map(b=><SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Doctor</Label><Select value={appointment.doctor} onValueChange={v=>setAppointment(x=>({...x,doctor:v}))}><SelectTrigger><SelectValue placeholder="Select doctor"/></SelectTrigger><SelectContent>{doctors.map(d=><SelectItem key={d.id} value={d.id}>{d.full_name} · {d.specialty||'General'} · {money(d.consultation_fee)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Preferred date and time</Label><Input type="datetime-local" value={appointment.starts_at} onChange={e=>setAppointment(x=>({...x,starts_at:e.target.value}))} required min={new Date().toISOString().slice(0,16)}/></div><div className="space-y-1"><Label>Reason (optional)</Label><Textarea value={appointment.reason} onChange={e=>setAppointment(x=>({...x,reason:e.target.value}))}/></div><Button disabled={saving}>Request appointment</Button><p className="text-xs text-muted-foreground">The clinic confirms the appointment. This request is not a confirmed booking.</p></form></CardContent></Card><Card><CardHeader><CardTitle>Your appointments</CardTitle></CardHeader><CardContent className="space-y-3">{appointments.map(a=><div key={a.id} className="rounded-lg border p-3"><div className="flex justify-between gap-2"><b>{a.appointment_number}</b><Badge>{a.appointment_status.replaceAll('_',' ')}</Badge></div><p className="text-sm text-muted-foreground">{dt(a.starts_at)} · {a.reason||'Consultation'}</p></div>)}{!appointments.length&&<p className="text-sm text-muted-foreground">No appointments yet.</p>}</CardContent></Card></div>}
  {tab==='laboratory'&&<div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]"><Card><CardHeader><CardTitle>Request diagnostic tests</CardTitle></CardHeader><CardContent><form onSubmit={requestLab} className="space-y-3"><div className="space-y-1"><Label>Branch</Label><Select value={labForm.branch} onValueChange={v=>setLabForm(x=>({...x,branch:v}))}><SelectTrigger><SelectValue placeholder="Select branch"/></SelectTrigger><SelectContent>{branches.map(b=><SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Tests</Label><Select onValueChange={v=>setLabForm(x=>({...x,tests:x.tests.includes(v)?x.tests:[...x.tests,v]}))}><SelectTrigger><SelectValue placeholder="Add a test"/></SelectTrigger><SelectContent>{catalogue.map(t=><SelectItem key={t.id} value={t.id}>{t.name} · {money(t.price)}</SelectItem>)}</SelectContent></Select></div><div className="flex flex-wrap gap-2">{labForm.tests.map(id=><Badge key={id} variant="secondary">{testName(id)} <button type="button" className="ml-1" onClick={()=>setLabForm(x=>({...x,tests:x.tests.filter(t=>t!==id)}))}>×</button></Badge>)}</div><div className="space-y-1"><Label>Preferred collection time (optional)</Label><Input type="datetime-local" value={labForm.scheduled_at} onChange={e=>setLabForm(x=>({...x,scheduled_at:e.target.value}))}/></div><Button disabled={saving}>Request tests</Button></form></CardContent></Card><Card><CardHeader><CardTitle>Bookings and released reports</CardTitle></CardHeader><CardContent className="space-y-3">{labBookings.map(b=><div key={b.id} className="rounded-lg border p-3"><div className="flex justify-between gap-2"><b>{b.booking_number}</b><Badge>{b.booking_status}</Badge></div><p className="text-xs text-muted-foreground">{dt(b.scheduled_at||b.booked_at)} · {money(b.total_amount)} · {b.payment_status}</p>{labItems.filter(i=>i.booking_id===b.id).map(i=><div key={i.id} className="mt-2 border-t pt-2 text-sm"><div className="font-medium">{testName(i.test_id)}</div><p className="text-xs text-muted-foreground">{i.item_status}</p>{results.filter(r=>r.booking_item_id===i.id).map(r=><div key={r.id} className="mt-2 rounded bg-muted p-2"><Badge>Released</Badge><p className="mt-1 whitespace-pre-wrap text-sm">{r.result_text||JSON.stringify(r.result_data)}</p>{r.abnormal_flag&&<Badge variant="destructive">Abnormal flag</Badge>}<p className="text-xs text-muted-foreground">Released {dt(r.released_at)}</p></div>)}</div>)}</div>)}{!labBookings.length&&<p className="text-sm text-muted-foreground">No diagnostic bookings yet.</p>}</CardContent></Card></div>}
  {tab==='medicines'&&<div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Medicine orders</CardTitle></CardHeader><CardContent className="space-y-3">{orders.map(o=><div key={o.id} className="rounded-lg border p-3"><div className="flex justify-between gap-2"><b>{o.order_number}</b><Badge>{o.order_status.replaceAll('_',' ')}</Badge></div><p className="text-xs text-muted-foreground">{dt(o.created_at)}</p>{orderItems.filter(i=>i.order_id===o.id).map(i=><p key={i.id} className="mt-1 text-sm">{i.requested_name||'Medicine'} × {i.quantity} · {i.item_status}</p>)}</div>)}{!orders.length&&<p className="text-sm text-muted-foreground">No medicine requests yet.</p>}<Button asChild><Link to="/pharmacy-order">Create medicine request</Link></Button></CardContent></Card><Card><CardHeader><CardTitle>Dispensed purchases</CardTitle></CardHeader><CardContent className="space-y-2">{sales.map(s=><div key={s.id} className="flex justify-between gap-2 border-b pb-2 text-sm"><div><b>{s.invoice_number}</b><p className="text-xs text-muted-foreground">{dt(s.sold_at)} · {s.payment_status}</p></div><strong>{money(s.grand_total)}</strong></div>)}{!sales.length&&<p className="text-sm text-muted-foreground">No dispensed sales linked to this profile.</p>}</CardContent></Card></div>}
  {tab==='consents'&&<Card><CardHeader><CardTitle>Privacy and consent preferences</CardTitle></CardHeader><CardContent className="space-y-3">{consents.map(c=><div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><b>{c.consent_type.replaceAll('_',' ')}</b><p className="text-xs text-muted-foreground">Recorded {dt(c.captured_at)} · {c.source}</p></div><div className="flex items-center gap-2"><Badge variant={c.granted&&!c.withdrawn_at?'default':'secondary'}>{c.granted&&!c.withdrawn_at?'Enabled':'Withdrawn / not granted'}</Badge><Button size="sm" variant="outline" disabled={saving} onClick={()=>updateConsent(c.id,!c.granted||Boolean(c.withdrawn_at))}>{c.granted&&!c.withdrawn_at?'Withdraw':'Enable'}</Button></div></div>)}{!consents.length&&<p className="text-sm text-muted-foreground">No consent preferences are on file. Ask your provider to record your choices.</p>}</CardContent></Card>}
 </main>;
}
