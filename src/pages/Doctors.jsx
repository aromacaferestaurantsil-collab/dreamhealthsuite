import OperationalModule from './OperationalModule';
export const route = { path: '/doctors', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'Stethoscope', label: 'DoctorSuite', order: 12, profiles: null };
const config = {
 title:'DoctorSuite', audience:'Clinics and consultations',
 description:'Maintain verified doctor credentials and tenant-scoped appointment schedules. Clinical notes and prescriptions remain subject to role-based authorisation.',
 tags:['Doctor directory','Appointments','Follow-ups','Clinical governance'],
 entities:[
  {table:'doctor_profiles',label:'Doctors',singular:'Doctor',fields:[
   {name:'doctor_code',label:'Doctor code',required:true},{name:'full_name',label:'Doctor name',required:true},{name:'specialty',label:'Speciality'},{name:'qualifications',label:'Qualifications'},{name:'registration_number',label:'Medical registration number',required:true},{name:'phone',label:'Phone'},{name:'email',label:'Email'},{name:'consultation_fee',label:'Consultation fee',type:'number'},{name:'status',label:'Status',options:['active','inactive']}
  ]},
  {table:'doctor_appointments',label:'Appointments',singular:'Appointment',branchScoped:true,createdBy:'created_by',fields:[
   {name:'patient_id',label:'Patient UUID',required:true},{name:'doctor_id',label:'Doctor UUID',required:true},{name:'appointment_number',label:'Appointment number',required:true},{name:'starts_at',label:'Starts at',type:'datetime',required:true},{name:'ends_at',label:'Ends at',type:'datetime',required:true},{name:'appointment_status',label:'Status',options:['scheduled','checked_in','in_consultation','completed','cancelled','no_show']},{name:'reason',label:'Reason',type:'multiline'},{name:'notes',label:'Notes',type:'multiline'}
  ]}
 ],
 notes:['Verify medical registration with the applicable professional council before granting clinical privileges.','Do not store consultation notes or prescriptions in this operational register; use the dedicated clinical workflow with explicit authorisation and audit.']
};
export default function Doctors(){return <OperationalModule config={config}/>;}
