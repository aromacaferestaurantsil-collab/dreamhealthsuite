import OperationalModule from './OperationalModule';
export const route = { path: '/care-connect', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'Truck', label: 'CareConnect', order: 14, profiles: null };
const config = {
 title:'CareConnect', audience:'Delivery and sample collection operations',
 description:'Create and monitor delivery and collection jobs with minimal patient data, clear assignment states and documented handover.',
 tags:['Job queue','Assignments','OTP handover','Sample collection'],
 entities:[
  {table:'care_service_catalogue',label:'Service catalogue',singular:'Service',statusField:'status',statusOptions:['active','inactive'],fields:[
   {name:'service_code',label:'Service code',required:true},{name:'name',label:'Service name',required:true},{name:'description',label:'Description',type:'multiline'},{name:'base_price',label:'Base price',type:'number'},{name:'duration_minutes',label:'Duration (minutes)',type:'number'},{name:'status',label:'Status',options:['active','inactive']}
  ]},
  {table:'care_jobs',label:'Jobs',singular:'Job',branchScoped:true,createdBy:'created_by',statusField:'job_status',statusOptions:['requested','approved','assigned','in_progress','completed','cancelled'],statusRpc:'transition_care_job',assignmentRpc:'assign_care_job',lookups:[{table:'patients',field:'patient_id',labelField:'full_name',select:'id,patient_code,full_name',branchScoped:true,required:false},{table:'care_service_catalogue',field:'service_id',labelField:'name',select:'id,service_code,name'},{table:'tenant_memberships',field:'assigned_to',label:'employee',labelField:'full_name',valueField:'user_id',select:'id,user_id,role,status,branch_id',tenantScoped:false,roleField:'role',role:'care_worker',statusFieldName:'status',membershipActiveStatus:'active',memberUserJoin:true,required:false}],fields:[
   {name:'patient_id',label:'Patient',lookup:true,lookupLabelField:'full_name'},{name:'service_id',label:'Service',required:true,lookup:true,lookupLabelField:'name'},{name:'job_number',label:'Job number',required:true},{name:'assigned_to',label:'Assigned employee',lookup:true,lookupValueField:'user_id',lookupLabelField:'full_name'},{name:'scheduled_start',label:'Scheduled start',type:'datetime'},{name:'scheduled_end',label:'Scheduled end',type:'datetime'},{name:'job_status',label:'Status',options:['requested','approved','assigned','in_progress','completed','cancelled']},{name:'instructions',label:'Operational instructions',type:'multiline'},{name:'price',label:'Price',type:'number'}
  ]}
 ],
 notes:['The admin console never displays raw OTPs or unnecessary patient medical details to delivery staff.','Production assignment, OTP verification, barcode handover and staff-only access must be enforced by authenticated server functions.']
};
export default function CareConnect(){return <OperationalModule config={config}/>;}
