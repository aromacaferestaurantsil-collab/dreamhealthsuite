import OperationalModule from './OperationalModule';
export const route = { path: '/care-connect', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'Truck', label: 'CareConnect', order: 14, profiles: ['Admin_c'] };
const config = {
 title:'CareConnect',audience:'Delivery and sample collection operations',
 description:'Create and monitor delivery and collection jobs with minimal patient data, clear assignment states and documented handover.',
 tags:['Job queue','Assignments','OTP handover','Sample collection'],
 entities:[
  {table:'care_jobs_c',label:'Jobs',singular:'Job',fields:[
   {name:'job_number_c',label:'Job number',type:'Text',required:true},{name:'job_type_c',label:'Job type',type:'Text',options:['Medicine Delivery','Sample Collection','Report Delivery']},{name:'patient_c',label:'Patient record ID',type:'Text'},{name:'booking_c',label:'Lab booking record ID',type:'Text'},{name:'assigned_to_c',label:'Assigned staff ID',type:'Text'},{name:'status_c',label:'Status',type:'Text',options:['Queued','Assigned','Accepted','In Progress','Completed','Failed','Cancelled']},{name:'scheduled_at_c',label:'Scheduled at',type:'DateTime'},{name:'completed_at_c',label:'Completed at',type:'DateTime'},{name:'notes_c',label:'Operational notes',type:'MultilineText'}
  ]}
 ],
 notes:['This admin console intentionally does not display raw OTPs or patient medical details to delivery staff.','Production assignment, OTP verification, barcode handover and staff-only access must be enforced by authenticated server functions.']
};
export default function CareConnect(){return <OperationalModule config={config}/>;}
