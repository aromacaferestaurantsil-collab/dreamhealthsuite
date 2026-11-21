import {useCallback,useEffect,useState} from 'react';
import {requireSupabase} from '@/lib/supabase';
import {Card,CardContent,CardHeader,CardTitle} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Textarea} from '@/components/ui/textarea';
import {toast} from 'sonner';

export const route={path:'/doctor-portal',layout:'public',access:'authenticated'};
export const nav={icon:'Stethoscope',label:'Doctor workspace',order:1,profiles:['Doctor']};
const dt=v=>v?new Date(v).toLocaleString('en-IN'):'—';
export default function DoctorPortal(){
 const [doctor,setDoctor]=useState(null),[appointments,setAppointments]=useState([]),[consultations,setConsultations]=useState([]);
 const [patients,setPatients]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[saving,setSaving]=useState(false);
 const [tab,setTab]=useState('overview'),[selected,setSelected]=useState(''),[form,setForm]=useState({chief_complaint:'',clinical_notes:'',diagnosis:'',treatment_plan:'',follow_up_at:''});
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const db=requireSupabase(),{data:{user},error:userError}=await db.auth.getUser();if(userError)throw userError;if(!user)throw new Error('Sign in with your doctor account.');
   const {data:rows,error:doctorError}=await db.from('doctor_profiles').select('id,tenant_id,doctor_code,full_name,specialty,qualifications,registration_number,consultation_fee,status').eq('user_id',user.id).eq('status','active');
   if(doctorError)throw doctorError;
   if(!rows?.length){setDoctor(null);return;}
   if(rows.length>1){throw new Error('This account is linked to multiple doctor profiles. Ask the platform administrator to reconcile your doctor identity.');}
   const d=rows[0];setDoctor(d);
   const [a,c]=await Promise.all([
    db.from('doctor_appointments').select('id,branch_id,patient_id,appointment_number,starts_at,ends_at,appointment_status,reason,created_at').eq('tenant_id',d.tenant_id).eq('doctor_id',d.id).order('starts_at',{ascending:false}).limit(300),
    db.from('doctor_consultations').select('id,appointment_id,chief_complaint,clinical_notes,diagnosis,treatment_plan,follow_up_at,signed_at,created_at').eq('tenant_id',d.tenant_id).order('created_at',{ascending:false}).limit(300)
   ]);
   if(a.error)throw a.error;if(c.error)throw c.error;
   setAppointments(a.data||[]);
   const ids=(a.data||[]).map(x=>x.id);
   setConsultations((c.data||[]).filter(x=>ids.includes(x.appointment_id)));
   const patientIds=[...new Set((a.data||[]).map(x=>x.patient_id))];
   if(patientIds.length){const {data:p,error:pe}=await db.rpc('doctor_list_own_appointment_patients',{p_doctor_profile_id:d.id});if(pe)throw pe;setPatients(p||[]);}else setPatients([]);
  }catch(e){setError(e.message||'Unable to load doctor workspace');}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{load()},[load]);
 const appointment=appointments.find(a=>a.id===selected);
 const patientFor=id=>patients.find(p=>p.id===id);
 const saveConsultation=async e=>{
  e.preventDefault();if(!appointment)return toast.error('Select an appointment');
  if(!form.clinical_notes.trim()&&!form.diagnosis.trim())return toast.error('Enter clinical notes or a diagnosis before saving');
  setSaving(true);
  try{
   const {error}=await requireSupabase().rpc('doctor_save_consultation',{p_appointment_id:appointment.id,p_chief_complaint:form.chief_complaint.trim()||null,p_clinical_notes:form.clinical_notes.trim()||null,p_diagnosis:form.diagnosis.trim()||null,p_treatment_plan:form.treatment_plan.trim()||null,p_follow_up_at:form.follow_up_at?new Date(form.follow_up_at).toISOString():null});
   if(error)throw error;toast.success('Consultation saved');setForm({chief_complaint:'',clinical_notes:'',diagnosis:'',treatment_plan:'',follow_up_at:''});setSelected('');await load();
  }catch(e){toast.error(e.message||'Unable to save consultation');}
  finally{setSaving(false);}
 };
 const counts={total:appointments.length,upcoming:appointments.filter(a=>new Date(a.starts_at)>=new Date()&&!['cancelled','no_show'].includes(a.appointment_status)).length,completed:appointments.filter(a=>a.appointment_status==='completed').length};
 if(loading)return <main className="mx-auto max-w-6xl p-6"><p className="text-sm text-muted-foreground">Loading your doctor workspace…</p></main>;
 if(error)return <main className="mx-auto max-w-3xl p-6"><Card><CardContent className="p-6 text-sm text-destructive">{error}</CardContent></Card></main>;
 if(!doctor)return <main className="mx-auto max-w-3xl p-6"><Card><CardHeader><CardTitle>Doctor profile not linked</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Your clinic administrator must create and link an active DoctorSuite profile to this signed-in account before you can access patient appointments.</CardContent></Card></main>;
 return <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
  <header className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-primary">HealthSuite 360 · DoctorSuite</p><h1 className="mt-1 text-3xl font-black">Doctor workspace</h1><p className="text-sm text-muted-foreground">{doctor.full_name} · {doctor.specialty||'Doctor'} · {doctor.doctor_code||doctor.registration_number||'Profile active'}</p></div><Button variant="outline" onClick={load}>Refresh</Button></header>
  <nav className="flex flex-wrap gap-2">{[['overview','Overview'],['appointments','My appointments'],['consultations','Consultations']].map(([v,l])=><Button key={v} size="sm" variant={tab===v?'default':'outline'} onClick={()=>setTab(v)}>{l}</Button>)}</nav>
  {tab==='overview'&&<><div className="grid gap-3 sm:grid-cols-3">{[['Appointments',counts.total],['Upcoming',counts.upcoming],['Completed',counts.completed]].map(([k,v])=><Card key={k}><CardContent className="p-4"><div className="text-xs text-muted-foreground">{k}</div><div className="mt-1 text-2xl font-bold">{v}</div></CardContent></Card>)}</div><Card><CardHeader><CardTitle>Next appointments</CardTitle></CardHeader><CardContent className="space-y-3">{appointments.filter(a=>new Date(a.starts_at)>=new Date()&&!['cancelled','no_show'].includes(a.appointment_status)).slice(0,8).map(a=><div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm"><div><b>{a.appointment_number}</b><p className="text-xs text-muted-foreground">{dt(a.starts_at)} · {patientFor(a.patient_id)?.full_name||'Patient'}</p></div><Badge>{a.appointment_status.replaceAll('_',' ')}</Badge></div>)}{!counts.upcoming&&<p className="text-sm text-muted-foreground">No upcoming appointments.</p>}</CardContent></Card></>}
  {tab==='appointments'&&<Card><CardHeader><CardTitle>My appointments</CardTitle></CardHeader><CardContent className="space-y-3">{appointments.map(a=><div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div><b>{a.appointment_number}</b><p className="text-sm text-muted-foreground">{dt(a.starts_at)} · {patientFor(a.patient_id)?.full_name||'Patient'}</p><p className="text-xs text-muted-foreground">{a.reason||'No reason supplied'}</p></div><div className="flex items-center gap-2"><Badge>{a.appointment_status.replaceAll('_',' ')}</Badge>{!['cancelled','no_show'].includes(a.appointment_status)&&<Button size="sm" onClick={()=>{setSelected(a.id);setTab('consultations')}}>Open consultation</Button>}</div></div>)}{!appointments.length&&<p className="text-sm text-muted-foreground">No appointments are assigned to your doctor profile.</p>}</CardContent></Card>}
  {tab==='consultations'&&<div className="grid gap-4 lg:grid-cols-[.9fr_1.1fr]"><Card><CardHeader><CardTitle>Record consultation</CardTitle></CardHeader><CardContent><form onSubmit={saveConsultation} className="space-y-3"><div className="space-y-1"><Label>Appointment</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={selected} onChange={e=>setSelected(e.target.value)} required><option value="">Select my appointment</option>{appointments.filter(a=>!['cancelled','no_show'].includes(a.appointment_status)).map(a=><option key={a.id} value={a.id}>{a.appointment_number} · {dt(a.starts_at)} · {patientFor(a.patient_id)?.full_name||'Patient'}</option>)}</select></div><div className="space-y-1"><Label>Chief complaint</Label><Input value={form.chief_complaint} onChange={e=>setForm(x=>({...x,chief_complaint:e.target.value}))}/></div><div className="space-y-1"><Label>Clinical notes</Label><Textarea rows={4} value={form.clinical_notes} onChange={e=>setForm(x=>({...x,clinical_notes:e.target.value}))}/></div><div className="space-y-1"><Label>Diagnosis</Label><Input value={form.diagnosis} onChange={e=>setForm(x=>({...x,diagnosis:e.target.value}))}/></div><div className="space-y-1"><Label>Treatment plan</Label><Textarea rows={3} value={form.treatment_plan} onChange={e=>setForm(x=>({...x,treatment_plan:e.target.value}))}/></div><div className="space-y-1"><Label>Follow-up time</Label><Input type="datetime-local" value={form.follow_up_at} onChange={e=>setForm(x=>({...x,follow_up_at:e.target.value}))}/></div><Button disabled={saving||!selected}>{saving?'Saving…':'Save consultation'}</Button><p className="text-xs text-muted-foreground">Saving creates an auditable clinical record for this appointment. Prescribing requires the separate prescription workflow.</p></form></CardContent></Card><Card><CardHeader><CardTitle>Consultation history</CardTitle></CardHeader><CardContent className="space-y-3">{consultations.map(c=><div key={c.id} className="rounded-lg border p-3"><div className="flex justify-between gap-2"><b>{appointments.find(a=>a.id===c.appointment_id)?.appointment_number||'Appointment'}</b><Badge>{c.signed_at?'Signed':'Draft'}</Badge></div><p className="mt-1 text-sm">{c.diagnosis||c.chief_complaint||'Consultation record'}</p><p className="whitespace-pre-wrap text-xs text-muted-foreground">{c.clinical_notes||c.treatment_plan||''}</p><p className="mt-1 text-xs text-muted-foreground">{dt(c.created_at)}</p></div>)}{!consultations.length&&<p className="text-sm text-muted-foreground">No consultation records yet.</p>}</CardContent></Card></div>}
 </main>;
}
