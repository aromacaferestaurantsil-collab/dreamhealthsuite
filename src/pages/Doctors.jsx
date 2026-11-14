import OperationalModule from './OperationalModule';
export const route = { path: '/doctors', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'Stethoscope', label: 'DoctorSuite', order: 12, profiles: ['Admin_c'] };
const config = {
 title:'DoctorSuite',audience:'Clinics and consultations',
 description:'Maintain doctor credentials, clinic schedules and patient appointments. Clinical notes and prescriptions require role controls and an auditable authorisation process.',
 tags:['Doctor directory','Appointments','Follow-ups','Clinical governance'],
 entities:[
  {table:'doctor_profiles_c',label:'Doctors',singular:'Doctor',fields:[
   {name:'doctor_name_c',label:'Doctor name',type:'Text',required:true},{name:'registration_number_c',label:'Medical registration number',type:'Text',required:true},{name:'speciality_c',label:'Speciality',type:'Text'},{name:'phone_c',label:'Phone',type:'Text'},{name:'email_c',label:'Email',type:'Text'},{name:'consultation_fee_c',label:'Consultation fee',type:'Decimal'},{name:'status_c',label:'Status',type:'Text',options:['Active','Inactive']}
  ]},
  {table:'doctor_appointments_c',label:'Appointments',singular:'Appointment',fields:[
   {name:'appointment_number_c',label:'Appointment number',type:'Text',required:true},{name:'doctor_c',label:'Doctor record ID',type:'Text'},{name:'patient_c',label:'Patient record ID',type:'Text'},{name:'appointment_at_c',label:'Appointment date and time',type:'DateTime',required:true},{name:'duration_minutes_c',label:'Duration minutes',type:'Number'},{name:'reason_c',label:'Reason for visit',type:'MultilineText'},{name:'status_c',label:'Status',type:'Text',options:['Requested','Confirmed','Checked In','Completed','Cancelled','No Show']},{name:'consultation_fee_c',label:'Consultation fee',type:'Decimal'}
  ]}
 ],
 notes:['Registration numbers should be verified with the applicable professional council before enabling clinical privileges.','No referral commissions are supported. Payments must represent documented, legitimate professional services.']
};
export default function Doctors(){return <OperationalModule config={config}/>;}
