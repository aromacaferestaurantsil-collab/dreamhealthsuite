import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

const modules = [
  { key:'pharmacy', name:'PharmaSuite', short:'Pharmacy', icon:'Pill', desc:'POS, stock, purchasing and finance' },
  { key:'lab', name:'LabSuite', short:'Laboratory', icon:'Microscope', desc:'Bookings, samples and reports' },
  { key:'doctor', name:'DoctorSuite', short:'Doctor', icon:'Stethoscope', desc:'Appointments and clinical workflow' },
  { key:'patient', name:'PatientSuite', short:'Patient', icon:'HeartPulse', desc:'Patient records, consent and portal' },
  { key:'care', name:'Care Connect', short:'Care', icon:'Truck', desc:'Delivery and field assignments' },
  { key:'analytics', name:'HealthAnalytics', short:'Analytics', icon:'ChartNoAxesCombined', desc:'Reports and business intelligence' },
];

const vendorsSeed = [
  { name:'Aroma Care Pharmacy', contact:'Manzoor E.', phone:'+91 98••• 4102', email:'admin@aromacare.example', plan:'PharmaSuite + LabSuite', status:'Active', renewal:'12 Dec 2026' },
  { name:'Green Valley Diagnostics', contact:'R. Das', phone:'+91 97••• 1288', email:'ops@greenvalley.example', plan:'LabSuite', status:'Trial', renewal:'28 Nov 2026' },
  { name:'City Health Clinic', contact:'S. Ahmed', phone:'+91 99••• 7721', email:'clinic@cityhealth.example', plan:'DoctorSuite + PatientSuite', status:'Past due', renewal:'18 Nov 2026' },
];

const demoRows = {
  doctor: [
    ['09:00','Riya Sharma','New patient','Consultation','Arrived'],
    ['09:30','Arun Das','Follow-up','Review','Completed'],
    ['10:00','Mina Paul','Repeat patient','Report review','Waiting'],
    ['10:30','Kabir Ali','New patient','Consultation','Confirmed'],
  ],
  patient: [
    ['Paracetamol 500 mg','PharmaSuite','In stock','₹32'],
    ['Vitamin D3 test','LabSuite','Available','₹450'],
    ['CBC test','LabSuite','Available','₹350'],
  ],
  agent: [
    ['JOB-2041','Medicine delivery','₹45','Paid'],
    ['JOB-2048','Sample pickup','₹60','Approved'],
    ['JOB-2053','Medicine delivery','₹45','Pending'],
  ],
};

function Metric({ label, value, note, icon='Activity' }) {
  return <Card className="border-border/70 shadow-sm"><CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5"><div className="min-w-0"><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{value}</p>{note&&<p className="mt-1 text-xs text-muted-foreground">{note}</p>}</div><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><ApperIcon name={icon} size={19}/></div></CardContent></Card>;
}

function PageTitle({ eyebrow, title, subtitle, action }) {
  return <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-primary">{eyebrow}</p><h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{title}</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p></div>{action}</div>;
}

function Status({ value }) {
  const variant = value === 'Active' || value === 'Completed' || value === 'Paid' || value === 'Confirmed' ? 'default' : value === 'Past due' || value === 'Pending' ? 'destructive' : 'secondary';
  return <Badge variant={variant}>{value}</Badge>;
}

function DataTable({ headers, rows }) {
  return <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{headers.map(h=><th key={h} className="px-4 py-3 font-semibold">{h}</th>)}</tr></thead><tbody className="divide-y">{rows.map((row,i)=><tr key={i} className="hover:bg-muted/30">{row.map((cell,j)=><td key={j} className="px-4 py-3">{cell}</td>)}</tr>)}</tbody></table></div>;
}

function PortalShell({ kind, title, subtitle, children }) {
  const [menu,setMenu] = useState(false);
  const nav = {
    admin:[['Overview','LayoutDashboard'],['Vendors','Building2'],['Subscriptions','CreditCard'],['Module catalogue','Blocks'],['Pricing & offers','Tags'],['Complaints','MessageSquare'],['Releases','Package']],
    vendor:[['Overview','LayoutDashboard'],['My modules','Blocks'],['Organisation','Building2'],['Team & access','Users'],['Storage & backup','Cloud'],['Support','LifeBuoy']],
    doctor:[['Dashboard','LayoutDashboard'],['Appointments','CalendarDays'],['Patients','Users'],['Reports','FileBarChart'],['My schedule','Clock']],
    patient:[['Home','House'],['Order medicines','Pill'],['Book a test','TestTube'],['Appointments','CalendarDays'],['Prescriptions','FileText'],['Reports','FileCheck']],
    agent:[['My dashboard','LayoutDashboard'],['My assignments','Route'],['Commission','Wallet'],['Reconciliation','ReceiptText'],['Profile','UserRound']],
  }[kind];
  const labels = {admin:'Platform control plane',vendor:'Vendor workspace',doctor:'Doctor portal',patient:'Patient care portal',agent:'Agent portal'};
  const icons = {admin:'ShieldCheck',vendor:'Building2',doctor:'Stethoscope',patient:'HeartPulse',agent:'Bike'};
  return <div className="min-h-screen bg-muted/30 text-foreground">
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ApperIcon name={icons[kind]} size={21}/></div><div className="min-w-0"><div className="truncate text-sm font-black sm:text-base">HealthSuite <span className="text-primary">360</span></div><div className="truncate text-[11px] text-muted-foreground">{labels[kind]}</div></div></div>
        <div className="flex items-center gap-2"><Badge variant="outline" className="hidden sm:inline-flex">Interactive demo</Badge><Button variant="outline" size="sm" asChild><Link to="/">Main app</Link></Button><Button variant="ghost" size="icon" className="md:hidden" onClick={()=>setMenu(v=>!v)} aria-label="Toggle menu"><ApperIcon name={menu?'X':'Menu'} size={20}/></Button></div>
      </div>
    </header>
    <div className="mx-auto grid max-w-[1440px] md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className={`border-r bg-background md:sticky md:top-16 md:block md:h-[calc(100vh-4rem)] ${menu?'block':'hidden'}`}>
        <div className="p-3"><div className="mb-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{labels[kind]}</div>{nav.map(([label,icon],i)=><button key={label} onClick={()=>{setMenu(false);document.getElementById('portal-content')?.scrollIntoView({behavior:'smooth'});toast.info(label+' view selected',{description:'This preview uses synthetic demonstration records.'})}} className={`mb-1 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold ${i===0?'bg-primary/10 text-primary':'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><ApperIcon name={icon} size={17}/>{label}</button>)}</div>
        <div className="mx-3 mt-3 rounded-xl bg-muted p-3 text-[11px] leading-5 text-muted-foreground">Demo environment<br/><span className="font-semibold text-foreground">Synthetic data only</span><br/>No live patient or vendor records.</div>
      </aside>
      <main id="portal-content" className="min-w-0 space-y-6 p-3 pb-12 sm:p-6 lg:p-8">{children}<p className="border-t pt-4 text-center text-[11px] text-muted-foreground">HealthSuite 360 · {title} · Demonstration preview, not production access control</p></main>
    </div>
  </div>;
}

function SuperAdmin() {
  const [vendors,setVendors]=useState(vendorsSeed);
  const [filter,setFilter]=useState('');
  const [price,setPrice]=useState('999');
  const [discount,setDiscount]=useState('15');
  const [offer,setOffer]=useState('WELCOME15');
  const [tab,setTab]=useState('Vendors');
  const [complaints,setComplaints]=useState([{id:'SUP-1042',vendor:'Green Valley Diagnostics',topic:'Lab report export issue',status:'Open'},{id:'SUP-1043',vendor:'Aroma Care Pharmacy',topic:'Invoice numbering query',status:'In progress'}]);
  const filtered=vendors.filter(v=>(v.name+' '+v.email+' '+v.plan).toLowerCase().includes(filter.toLowerCase()));
  const updateStatus=(index,status)=>setVendors(current=>current.map((v,i)=>i===index?{...v,status}:v));
  return <PortalShell kind="admin" title="Super Admin" subtitle="Platform-level vendor subscriptions, module catalogue and support operations.">
    <PageTitle eyebrow="Super Admin · Platform control plane" title="Platform overview" subtitle="Manage vendor accounts and product subscriptions. Vendor clinical, inventory and financial records are outside this console." action={<Button onClick={()=>{setVendors(v=>[{name:'New demo vendor',contact:'Vendor admin',phone:'+91 90000 00000',email:'newvendor@example.test',plan:'No modules',status:'Trial',renewal:'Not set'},...v]);toast.success('Demo vendor added')}}><ApperIcon name="Plus" size={16} className="mr-2"/>Add vendor</Button>}/>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Registered vendors" value={vendors.length} note="Synthetic preview accounts" icon="Building2"/><Metric label="Active subscriptions" value={vendors.filter(v=>v.status==='Active').length} note="Across all modules" icon="BadgeCheck"/><Metric label="Modules available" value="6" note="Independent module licensing" icon="Blocks"/><Metric label="Open complaints" value={complaints.filter(c=>c.status!=='Resolved').length} note="Vendor support queue" icon="MessageSquare"/></div>
    <div className="flex flex-wrap gap-2">{['Vendors','Module catalogue','Pricing & offers','Complaints','Releases'].map(t=><Button key={t} size="sm" variant={tab===t?'default':'outline'} onClick={()=>setTab(t)}>{t}</Button>)}</div>
    {tab==='Vendors'&&<Card><CardHeader><CardTitle>Vendor directory</CardTitle><Input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search vendor, email or subscription…" className="max-w-sm"/></CardHeader><CardContent><DataTable headers={['Vendor','Contact','Email','Purchased modules','Subscription','Renewal','Action']} rows={filtered.map(v=>[<span className="font-semibold">{v.name}</span>,v.phone,v.email,v.plan,<Status value={v.status}/>,v.renewal,<select aria-label={'Subscription status for '+v.name} className="rounded-md border bg-background p-2 text-xs" value={v.status} onChange={e=>updateStatus(vendors.indexOf(v),e.target.value)}><option>Active</option><option>Trial</option><option>Past due</option><option>Suspended</option></select>])}/></CardContent></Card>}
    {tab==='Module catalogue'&&<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{modules.map(m=><Card key={m.key}><CardContent className="flex gap-3 p-5"><div className="rounded-xl bg-primary/10 p-3 text-primary"><ApperIcon name={m.icon} size={22}/></div><div><div className="font-bold">{m.name}</div><p className="mt-1 text-xs text-muted-foreground">{m.desc}</p><Badge className="mt-3" variant="outline">Independently licensable</Badge></div></CardContent></Card>)}</div>}
    {tab==='Pricing & offers'&&<Card><CardHeader><CardTitle>Module pricing and offer builder</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Base monthly price (₹)<Input value={price} onChange={e=>setPrice(e.target.value)} type="number" className="mt-1"/></label><label className="text-sm font-medium">Discount (%)<Input value={discount} onChange={e=>setDiscount(e.target.value)} type="number" className="mt-1"/></label><label className="text-sm font-medium">Offer code<Input value={offer} onChange={e=>setOffer(e.target.value)} className="mt-1"/></label><div className="rounded-xl bg-muted p-4"><div className="text-xs text-muted-foreground">Preview price</div><div className="text-2xl font-black">₹{Math.round(Number(price||0)*(1-Number(discount||0)/100)).toLocaleString('en-IN')}</div><div className="text-xs text-muted-foreground">Code {offer||'—'} · Demo only</div></div><Button className="sm:col-span-2" onClick={()=>toast.success('Offer saved in this browser demo only')}>Save offer preview</Button></CardContent></Card>}
    {tab==='Complaints'&&<Card><CardHeader><CardTitle>Vendor complaints and support</CardTitle></CardHeader><CardContent className="space-y-3">{complaints.map(c=><div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div><div className="font-semibold">{c.id} · {c.topic}</div><div className="text-xs text-muted-foreground">{c.vendor}</div></div><div className="flex items-center gap-2"><Status value={c.status}/><Button size="sm" variant="outline" onClick={()=>setComplaints(rows=>rows.map(x=>x.id===c.id?{...x,status:'Resolved'}:x))}>Resolve</Button></div></div>)}</CardContent></Card>}
    {tab==='Releases'&&<Card><CardHeader><CardTitle>Module release distribution</CardTitle></CardHeader><CardContent className="space-y-3">{modules.map(m=><div key={m.key} className="flex flex-wrap items-center justify-between gap-3 border-b pb-3"><div className="font-semibold">{m.name}<p className="text-xs font-normal text-muted-foreground">Latest demo package · v1.0.0</p></div><Button size="sm" variant="outline" onClick={()=>toast.info(m.name+' release details opened in demo')}>View package</Button></div>)}</CardContent></Card>}
  </PortalShell>;
}

function Vendor() {
  const [enabled,setEnabled]=useState(['pharmacy','lab','doctor','patient']);
  const [org,setOrg]=useState('Aroma Care Pharmacy');
  const [drive,setDrive]=useState('Vendor managed cloud drive');
  const [complaint,setComplaint]=useState('');
  const [sent,setSent]=useState(false);
  const [section,setSection]=useState('overview');
  const toggle=k=>setEnabled(v=>v.includes(k)?v.filter(x=>x!==k):[...v,k]);
  return <PortalShell kind="vendor" title="Vendor workspace" subtitle="Configure your organisation and the modules included in your subscription.">
    <PageTitle eyebrow="Vendor workspace" title={org} subtitle="Your organisation data is private to your tenant. This preview is populated with synthetic records." action={<Badge>4 modules enabled</Badge>}/>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Enabled modules" value={enabled.length} note="Demo entitlement selection" icon="Blocks"/><Metric label="Today's orders" value="28" note="Pharmacy and patient portal" icon="ShoppingBag"/><Metric label="Lab bookings" value="16" note="Today's appointments" icon="TestTube"/><Metric label="Support cases" value="1" note="One demo ticket" icon="LifeBuoy"/></div>
    <div className="flex flex-wrap gap-2">{[['overview','Overview'],['modules','Purchased modules'],['organisation','Organisation & storage'],['support','Support']].map(([k,l])=><Button size="sm" key={k} variant={section===k?'default':'outline'} onClick={()=>setSection(k)}>{l}</Button>)}</div>
    {section==='overview'&&<div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>Workspace at a glance</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex justify-between text-sm"><span className="text-muted-foreground">Subscription status</span><Status value="Active"/></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Next renewal</span><span>12 Dec 2026</span></div><div className="flex justify-between text-sm"><span className="text-muted-foreground">Selected data storage</span><span>{drive}</span></div><div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Only purchased modules are available. Cross-module features appear when both connected modules are enabled.</div></CardContent></Card><Card><CardHeader><CardTitle>Module quick access</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-2">{modules.filter(m=>enabled.includes(m.key)).map(m=><button key={m.key} onClick={()=>toast.info('Opening '+m.name+' demo workspace')} className="rounded-xl border p-3 text-left hover:bg-muted"><ApperIcon name={m.icon} size={20} className="text-primary"/><div className="mt-2 text-sm font-bold">{m.name}</div><div className="text-[11px] text-muted-foreground">{m.short}</div></button>)}</CardContent></Card></div>}
    {section==='modules'&&<Card><CardHeader><CardTitle>Subscription-based module setup</CardTitle><p className="text-sm text-muted-foreground">Toggle only modules included in this demo vendor's subscription. In production these are server-verified entitlements.</p></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{modules.map(m=><div key={m.key} className="flex items-start justify-between gap-3 rounded-xl border p-4"><div className="flex gap-3"><ApperIcon name={m.icon} size={20} className="mt-1 text-primary"/><div><div className="font-semibold">{m.name}</div><div className="text-xs text-muted-foreground">{m.desc}</div></div></div><input type="checkbox" aria-label={'Enable '+m.name} checked={enabled.includes(m.key)} onChange={()=>toggle(m.key)} className="mt-1 h-5 w-5 accent-primary"/></div>)}</CardContent></Card>}
    {section==='organisation'&&<Card><CardHeader><CardTitle>Organisation and private storage</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Organisation name<Input className="mt-1" value={org} onChange={e=>setOrg(e.target.value)}/></label><label className="text-sm font-medium">Storage preference<select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={drive} onChange={e=>setDrive(e.target.value)}><option>Vendor managed cloud drive</option><option>Google Drive (connection required)</option><option>Microsoft OneDrive (connection required)</option><option>Vendor hosted storage (connection required)</option></select></label><div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground sm:col-span-2">Storage selection is a preview preference only. No cloud account is connected and no files are uploaded.</div><Button onClick={()=>toast.success('Organisation preferences saved in this browser demo')}>Save settings</Button></CardContent></Card>}
    {section==='support'&&<Card><CardHeader><CardTitle>Contact platform support</CardTitle><p className="text-sm text-muted-foreground">Submit an issue without attaching patient records or private operational data.</p></CardHeader><CardContent className="space-y-3"><textarea value={complaint} onChange={e=>setComplaint(e.target.value)} placeholder="Describe the issue, module and steps to reproduce…" className="min-h-28 w-full rounded-lg border bg-background p-3 text-sm"/><Button disabled={!complaint.trim()} onClick={()=>{setSent(true);setComplaint('');toast.success('Demo support ticket created')}}>Submit complaint</Button>{sent&&<Badge variant="secondary">Ticket created in this browser session</Badge>}</CardContent></Card>}
  </PortalShell>;
}

function Doctor() {
  const [filter,setFilter]=useState('All');
  const rows=demoRows.doctor.filter(r=>filter==='All'||r[4]===filter);
  return <PortalShell kind="doctor" title="Doctor portal" subtitle="Doctor dashboard with appointment and patient activity indicators.">
    <PageTitle eyebrow="DoctorSuite · Personal clinical workspace" title="Good morning, Dr. Sen" subtitle="Your clinic activity today · Saturday, 21 November 2026" action={<Badge variant="outline">Demo doctor account</Badge>}/>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Booked patients" value="18" note="Today" icon="CalendarCheck"/><Metric label="Attended" value="11" note="7 remaining" icon="UserCheck"/><Metric label="New patients" value="6" note="Repeat patients: 5" icon="UserPlus"/><Metric label="Reports to review" value="4" note="2 lab · 2 follow-up" icon="FileSearch"/></div>
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]"><Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>Today's appointments</CardTitle><select value={filter} onChange={e=>setFilter(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-xs"><option>All</option><option>Arrived</option><option>Completed</option><option>Waiting</option><option>Confirmed</option></select></div></CardHeader><CardContent><DataTable headers={['Time','Patient','Type','Visit','Status']} rows={rows.map(r=>[r[0],r[1],r[2],r[3],<Status value={r[4]}/>])}/></CardContent></Card><Card><CardHeader><CardTitle>Connected vendor activity</CardTitle></CardHeader><CardContent className="space-y-4">{[['Medicines purchased','24','From linked pharmacy'],['Tests completed','13','From linked laboratory'],['Reports issued','9','Today'],['Repeat visits this month','42','Your patient panel']].map(([l,v,n])=><div key={l} className="flex items-center justify-between border-b pb-3"><div><div className="text-sm font-semibold">{l}</div><div className="text-xs text-muted-foreground">{n}</div></div><div className="text-2xl font-black">{v}</div></div>)}<Button className="w-full" onClick={()=>toast.info('Report inbox opened in demo')}>Open report inbox</Button></CardContent></Card></div>
  </PortalShell>;
}

function Patient() {
  const [tab,setTab]=useState('Order medicines');
  const [cart,setCart]=useState([]);
  const [booked,setBooked]=useState(false);
  const [query,setQuery]=useState('');
  const add=item=>{setCart(c=>[...c,item]);toast.success(item+' added to your order')};
  return <PortalShell kind="patient" title="Patient PWA" subtitle="Patient-facing medicine, laboratory and appointment services.">
    <div className="rounded-2xl bg-primary p-5 text-primary-foreground sm:p-7"><Badge className="border-white/30 bg-white/10 text-white">Aroma Health · Connected provider</Badge><h1 className="mt-3 text-2xl font-black sm:text-3xl">Hello, Riya</h1><p className="mt-1 max-w-xl text-sm text-primary-foreground/80">Manage your medicines, tests, appointments and reports in one place.</p><div className="mt-5 grid grid-cols-3 gap-2"><div className="rounded-xl bg-white/10 p-3"><div className="text-xl font-black">2</div><div className="text-[10px] text-white/80">Prescriptions</div></div><div className="rounded-xl bg-white/10 p-3"><div className="text-xl font-black">3</div><div className="text-[10px] text-white/80">Reports</div></div><div className="rounded-xl bg-white/10 p-3"><div className="text-xl font-black">1</div><div className="text-[10px] text-white/80">Upcoming visit</div></div></div></div>
    <div className="flex gap-2 overflow-x-auto pb-1">{['Order medicines','Book a test','Appointments','Prescriptions','Reports'].map(t=><Button key={t} size="sm" className="shrink-0" variant={tab===t?'default':'outline'} onClick={()=>setTab(t)}>{t}</Button>)}</div>
    {tab==='Order medicines'&&<Card><CardHeader><CardTitle>Medicine catalogue</CardTitle><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search medicines…" className="max-w-sm"/></CardHeader><CardContent className="space-y-3">{demoRows.patient.filter(r=>r[1]==='PharmaSuite'&&r[0].toLowerCase().includes(query.toLowerCase())).map(r=><div key={r[0]} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><div className="font-semibold">{r[0]}</div><div className="text-xs text-muted-foreground">{r[2]}</div></div><div className="text-right"><div className="font-bold">{r[3]}</div><Button size="sm" className="mt-1" onClick={()=>add(r[0])}>Add</Button></div></div>)}{cart.length>0&&<div className="rounded-xl bg-muted p-3"><div className="font-semibold">Your order · {cart.length} item(s)</div><p className="text-xs text-muted-foreground">{cart.join(', ')}</p><Button className="mt-2" onClick={()=>toast.success('Demo medicine order submitted')}>Place order</Button></div>}</CardContent></Card>}
    {tab==='Book a test'&&<Card><CardHeader><CardTitle>Available laboratory tests</CardTitle></CardHeader><CardContent className="space-y-3">{demoRows.patient.filter(r=>r[1]==='LabSuite').map(r=><div key={r[0]} className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><div className="font-semibold">{r[0]}</div><div className="text-xs text-muted-foreground">{r[2]}</div></div><div className="text-right"><div className="font-bold">{r[3]}</div><Button size="sm" onClick={()=>{setBooked(true);toast.success('Test booking request submitted')}}>Book test</Button></div></div>)}{booked&&<Badge>Booking request received · LAB-DEMO-208</Badge>}</CardContent></Card>}
    {tab==='Appointments'&&<Card><CardHeader><CardTitle>Book a doctor visit</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Doctor<select className="mt-1 h-10 w-full rounded-md border bg-background px-3"><option>Dr. A. Sen · General Medicine</option><option>Dr. P. Das · Paediatrics</option></select></label><label className="text-sm">Date<input type="date" className="mt-1 h-10 w-full rounded-md border bg-background px-3"/></label><label className="text-sm sm:col-span-2">Reason<textarea className="mt-1 w-full rounded-md border bg-background p-3" placeholder="Optional reason for visit"/></label><Button onClick={()=>{setBooked(true);toast.success('Appointment request submitted')}}>Request appointment</Button>{booked&&<Badge>Request received · APT-DEMO-041</Badge>}</CardContent></Card>}
    {tab==='Prescriptions'&&<Card><CardHeader><CardTitle>My prescriptions</CardTitle></CardHeader><CardContent><DataTable headers={['Date','Doctor','Prescription','Status']} rows={[[ '18 Nov 2026','Dr. A. Sen','Prescription #RX-208','Available'],['03 Nov 2026','Dr. P. Das','Prescription #RX-193','Available']]}/></CardContent></Card>}
    {tab==='Reports'&&<Card><CardHeader><CardTitle>My test reports</CardTitle></CardHeader><CardContent><DataTable headers={['Date','Test','Provider','Report']} rows={[[ '19 Nov 2026','CBC','Aroma Lab','Ready'],['12 Nov 2026','Vitamin D3','Aroma Lab','Ready'],['06 Nov 2026','Lipid profile','Aroma Lab','Ready']]}/></CardContent></Card>}
  </PortalShell>;
}

function Agent() {
  const [rows,setRows]=useState(demoRows.agent);
  const total=rows.reduce((sum,r)=>sum+Number(r[2].replace(/[^0-9.]/g,'')),0);
  return <PortalShell kind="agent" title="Agent PWA" subtitle="Personal assignments, commission earnings and payout reconciliation.">
    <PageTitle eyebrow="Care Connect · Agent workspace" title="Welcome back, Arif" subtitle="Your commission activity and assigned jobs. Only your own records are shown." action={<Badge variant="outline">Agent demo</Badge>}/>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Commission earned" value={'₹'+total} note="Across listed assignments" icon="Wallet"/><Metric label="Approved" value="₹60" note="Ready for payout" icon="BadgeCheck"/><Metric label="Pending" value="₹45" note="Awaiting job confirmation" icon="Clock"/><Metric label="Paid this month" value="₹180" note="3 reconciled payouts" icon="IndianRupee"/></div>
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]"><Card><CardHeader><CardTitle>My recent assignments</CardTitle></CardHeader><CardContent><DataTable headers={['Job ID','Assignment','Commission','Status']} rows={rows.map(r=>[r[0],r[1],r[2],<Status value={r[3]}/>])}/><Button className="mt-4" onClick={()=>{setRows(r=>[['JOB-2058','Sample pickup','₹55','Pending'],...r]);toast.success('Demo assignment added')}}>Refresh assignments</Button></CardContent></Card><Card><CardHeader><CardTitle>Commission reconciliation</CardTitle></CardHeader><CardContent className="space-y-3"><div className="rounded-xl bg-muted p-4"><div className="text-xs text-muted-foreground">Next settlement estimate</div><div className="text-3xl font-black">₹105</div><div className="text-xs text-muted-foreground">Subject to vendor approval</div></div><div className="text-sm font-semibold">Past settlements</div>{[['14 Nov 2026','₹180','Paid'],['07 Nov 2026','₹125','Paid'],['31 Oct 2026','₹210','Paid']].map(r=><div key={r[0]} className="flex items-center justify-between border-b py-2 text-sm"><span>{r[0]}</span><span className="font-semibold">{r[1]}</span><Status value={r[2]}/></div>)}<Button variant="outline" className="w-full" onClick={()=>toast.success('Your demo statement is ready')}>View statement</Button></CardContent></Card></div>
  </PortalShell>;
}

export default function DemoPortal({ kind }) {
  const components = { admin:SuperAdmin, vendor:Vendor, doctor:Doctor, patient:Patient, agent:Agent };
  const Component = components[kind] ?? Vendor;
  return <Component/>;
}
