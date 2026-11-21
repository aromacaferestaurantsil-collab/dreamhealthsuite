import OperationalModule from './OperationalModule';
export const route = { path: '/patients', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'HeartPulse', label: 'PatientSuite', order: 13, profiles: null };
const config = {
 title: 'PatientSuite', audience: 'Unified patient identity and portal foundation',
 description: 'Maintain a unified patient register and purpose-specific consent records shared across pharmacy, laboratory and clinic workflows.',
 tags: ['Patient identity','Consent register','Shared record','Privacy'],
 entities: [
  { table:'patients', label:'Patient register', singular:'Patient', branchScoped:true, createdBy:'created_by', statusField:'status',statusOptions:['active','inactive'], fields:[
   {name:'patient_code',label:'Patient code',required:true},{name:'full_name',label:'Full name',required:true},{name:'phone',label:'Phone'},{name:'email',label:'Email'},{name:'date_of_birth',label:'Date of birth',type:'date'},{name:'gender',label:'Gender',options:['female','male','other','unknown']},{name:'blood_group',label:'Blood group'},{name:'allergy_notes',label:'Allergy notes',type:'multiline'},{name:'status',label:'Status',options:['active','inactive']}
  ]},
  { table:'patient_consents', label:'Consent records', singular:'Consent', lookup:{table:'patients',field:'patient_id',labelField:'full_name',select:'id,patient_code,full_name',branchScoped:true}, statusField:'granted',statusOptions:[true,false],withdrawConsent:true,fields:[
   {name:'patient_id',label:'Patient',required:true,lookup:true},{name:'consent_type',label:'Consent purpose',required:true,options:['data_processing','whatsapp_communication','email_communication','report_sharing','care_coordination']},{name:'granted',label:'Consent granted',required:true,options:['true','false'],type:'boolean'},{name:'source',label:'Capture source',options:['application','paper','website','verbal']},{name:'notes',label:'Notes',type:'multiline'}
  ]}
 ],
 notes:['Patient records contain sensitive personal information. Do not enter real patient data until tenant isolation, consent enforcement, retention and access auditing have passed negative tests.','Consent is recorded per purpose. Withdrawal must stop the corresponding processing and communications.']
};
export default function Patients(){return <OperationalModule config={config}/>;}
