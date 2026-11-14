import { requireSupabase } from '@/lib/supabase';

export async function getCurrentUser() {
  const { data, error } = await requireSupabase().auth.getUser();
  if (error) throw error;
  return data.user;
}
export async function getMyMemberships() {
  const client=requireSupabase(); const user=await getCurrentUser();
  if(!user) return [];
  const {data,error}=await client.from('tenant_memberships')
    .select('id,tenant_id,branch_id,role,status,tenants(id,display_name,slug,status)')
    .eq('user_id',user.id).eq('status','active');
  if(error) throw error;
  return data??[];
}
export async function createTenant({legalName,displayName,slug,branchName,branchCode}) {
  const {data,error}=await requireSupabase().rpc('create_tenant_with_owner',{
    p_legal_name:legalName,p_display_name:displayName,p_slug:slug,p_branch_name:branchName,p_branch_code:branchCode,
  });
  if(error) throw error;
  return data;
}
export async function pharmacyCheckout({tenantId,branchId,invoiceNumber,items,paymentMethod='cash',patientId=null,prescriptionReference=null}) {
  const {data,error}=await requireSupabase().rpc('pharmacy_checkout',{
    p_tenant_id:tenantId,p_branch_id:branchId,p_invoice_number:invoiceNumber,p_items:items,
    p_payment_method:paymentMethod,p_patient_id:patientId,p_prescription_reference:prescriptionReference,
  });
  if(error) throw error; return data;
}
export async function verifyLabResult(resultId,release=false) {
  const {error}=await requireSupabase().rpc('lab_verify_result',{p_result_id:resultId,p_release:release});
  if(error) throw error;
}
export async function createDoctorAppointment(input) {
  const {data,error}=await requireSupabase().rpc('create_doctor_appointment',{
    p_tenant_id:input.tenantId,p_branch_id:input.branchId,p_patient_id:input.patientId,
    p_doctor_id:input.doctorId,p_appointment_number:input.appointmentNumber,
    p_starts_at:input.startsAt,p_ends_at:input.endsAt??null,p_reason:input.reason??null,
  });
  if(error) throw error; return data;
}
export async function transitionCareJob(jobId,newStatus,notes=null,location=null) {
  const {error}=await requireSupabase().rpc('transition_care_job',{p_job_id:jobId,p_new_status:newStatus,p_notes:notes,p_location:location});
  if(error) throw error;
}
