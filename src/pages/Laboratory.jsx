import OperationalModule from './OperationalModule';
export const route = { path: '/laboratory', layout: 'owner', access: 'authenticated' };
export const nav = { icon: 'Microscope', label: 'LabSuite', order: 11, profiles: ['Admin_c'] };
const config = {
  title: 'LabSuite', audience: 'Diagnostic centre operations',
  description: 'Manage test definitions, bookings, sample chain of custody and result verification. Results remain unreleased until an authorised professional verifies them.',
  tags: ['Test catalogue','Bookings','Barcode samples','Verification gate'],
  entities: [
    { table:'lab_test_catalogue_c',label:'Test catalogue',singular:'Test',fields:[
      {name:'test_code_c',label:'Test code',type:'Text',required:true},{name:'test_name_c',label:'Test name',type:'Text',required:true},{name:'category_c',label:'Category',type:'Text'},{name:'specimen_type_c',label:'Specimen type',type:'Text'},{name:'price_c',label:'Price',type:'Decimal'},{name:'turnaround_hours_c',label:'Turnaround hours',type:'Number'},{name:'status_c',label:'Status',type:'Text',options:['Active','Inactive']}
    ]},
    { table:'lab_bookings_c',label:'Bookings',singular:'Booking',fields:[
      {name:'booking_number_c',label:'Booking number',type:'Text',required:true},{name:'patient_c',label:'Patient record ID',type:'Text',placeholder:'Internal patient record ID'},{name:'booking_date_c',label:'Booking date',type:'DateTime'},{name:'booking_type_c',label:'Booking type',type:'Text',options:['Walk-in','Home collection','Clinic']},{name:'status_c',label:'Status',type:'Text',options:['Booked','Collected','Processing','Awaiting Verification','Released','Cancelled']},{name:'total_amount_c',label:'Total amount',type:'Decimal'},{name:'payment_status_c',label:'Payment status',type:'Text',options:['Paid','Due','Refunded']}
    ]},
    { table:'lab_samples_c',label:'Samples',singular:'Sample',fields:[
      {name:'booking_c',label:'Booking record ID',type:'Text'},{name:'sample_barcode_c',label:'Sample barcode',type:'Text',required:true},{name:'specimen_type_c',label:'Specimen type',type:'Text'},{name:'collected_at_c',label:'Collected at',type:'DateTime'},{name:'received_at_c',label:'Received at',type:'DateTime'},{name:'processed_at_c',label:'Processed at',type:'DateTime'},{name:'sample_status_c',label:'Sample status',type:'Text',options:['Pending Collection','Collected','Received','Processing','Outsourced','Rejected','Completed']},{name:'assigned_to_c',label:'Assigned to',type:'Text'}
    ]},
    { table:'lab_results_c',label:'Results',singular:'Result',fields:[
      {name:'booking_c',label:'Booking record ID',type:'Text'},{name:'test_c',label:'Test record ID',type:'Text'},{name:'result_value_c',label:'Result value',type:'MultilineText',required:true},{name:'unit_c',label:'Unit',type:'Text'},{name:'reference_range_c',label:'Reference range',type:'Text'},{name:'flag_c',label:'Flag',type:'Text',options:['Normal','Low','High','Critical']},{name:'verification_status_c',label:'Verification status',type:'Text',options:['Draft','Submitted','Verified','Released']},{name:'verified_by_c',label:'Verified by',type:'Text'},{name:'verified_at_c',label:'Verified at',type:'DateTime'}
    ]}
  ],
  notes:['Patient and booking IDs are internal record references; production UI should use secure lookup pickers rather than free-text IDs.','The verification and report-release workflow needs a server-enforced authorisation check and immutable audit trail before clinical use.']
};
export default function Laboratory(){return <OperationalModule config={config}/>;}
