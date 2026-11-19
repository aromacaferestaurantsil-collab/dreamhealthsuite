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

export async function pharmacyCreatePurchaseOrder({tenantId,branchId,supplierId,orderNumber,orderDate,expectedDate,items}) {
 const {data,error}=await requireSupabase().rpc('pharmacy_create_purchase_order',{p_tenant_id:tenantId,p_branch_id:branchId,p_supplier_id:supplierId,p_order_number:orderNumber,p_order_date:orderDate,p_expected_date:expectedDate||null,p_items:items});
 if(error) throw error; return data;
}
export async function pharmacyReceivePurchaseItem({tenantId,orderId,itemId,quantity,batchNumber,expiryDate,mrp,sellingRate}) {
 const {data,error}=await requireSupabase().rpc('pharmacy_receive_purchase_item',{p_tenant_id:tenantId,p_order_id:orderId,p_item_id:itemId,p_quantity:quantity,p_batch_number:batchNumber,p_expiry_date:expiryDate,p_mrp:mrp,p_selling_rate:sellingRate});
 if(error) throw error; return data;
}
export async function pharmacyAdjustStock({tenantId,branchId,batchId,quantityDelta,reason}) {
 const {error}=await requireSupabase().rpc('pharmacy_adjust_stock',{p_tenant_id:tenantId,p_branch_id:branchId,p_batch_id:batchId,p_quantity_delta:quantityDelta,p_reason:reason});
 if(error) throw error;
}
export async function pharmacyProcessReturn({tenantId,branchId,returnNumber,returnType,reason,saleId,supplierId,items}) {
 const {data,error}=await requireSupabase().rpc('pharmacy_process_return',{p_tenant_id:tenantId,p_branch_id:branchId,p_return_number:returnNumber,p_return_type:returnType,p_reason:reason,p_sale_id:saleId||null,p_supplier_id:supplierId||null,p_items:items});
 if(error) throw error; return data;
}

export async function pharmacyCheckoutV2({tenantId,branchId,invoiceNumber,items,paymentMethod,paymentStatus='pending',idempotencyKey,patientId=null,prescriptionReference=null}) {
 const {data,error}=await requireSupabase().rpc('pharmacy_checkout_v2',{p_tenant_id:tenantId,p_branch_id:branchId,p_invoice_number:invoiceNumber,p_items:items,p_payment_method:paymentMethod,p_payment_status:paymentStatus,p_idempotency_key:idempotencyKey,p_patient_id:patientId,p_prescription_reference:prescriptionReference});
 if(error) throw error; return data;
}

export async function pharmacyRecordExpensePayment({tenantId,expenseId,amount,paymentMethod,reference}) {
 const {data,error}=await requireSupabase().rpc('pharmacy_record_expense_payment',{p_tenant_id:tenantId,p_expense_id:expenseId,p_amount:amount,p_payment_method:paymentMethod,p_reference:reference||null});
 if(error) throw error; return data;
}
export async function pharmacyRecordSupplierPayment({tenantId,orderId,amount,paymentMethod,reference}) {
 const {data,error}=await requireSupabase().rpc('pharmacy_record_supplier_payment',{p_tenant_id:tenantId,p_order_id:orderId,p_amount:amount,p_payment_method:paymentMethod,p_reference:reference||null});
 if(error) throw error; return data;
}
export async function pharmacySubmitCustomerOrder({tenantId,branchId,orderNumber,items,prescriptionPath,notes}) {
 const {data,error}=await requireSupabase().rpc('pharmacy_submit_customer_order',{p_tenant_id:tenantId,p_branch_id:branchId,p_order_number:orderNumber,p_items:items,p_prescription_path:prescriptionPath||null,p_notes:notes||null});
 if(error) throw error; return data;
}
export async function pharmacyReviewCustomerOrder({tenantId,orderId,decision,notes,itemDecisions=[]}) {
 const {error}=await requireSupabase().rpc('pharmacy_review_customer_order',{p_tenant_id:tenantId,p_order_id:orderId,p_decision:decision,p_notes:notes||null,p_item_decisions:itemDecisions});
 if(error) throw error;
}
export async function pharmacyPlaceStockHold({tenantId,branchId,batchId,quantity,holdType,reason,reference}) {
 const {data,error}=await requireSupabase().rpc('pharmacy_place_stock_hold',{p_tenant_id:tenantId,p_branch_id:branchId,p_batch_id:batchId,p_quantity:quantity,p_hold_type:holdType,p_reason:reason,p_reference:reference||null});
 if(error) throw error; return data;
}
export async function pharmacyReleaseStockHold({tenantId,holdId,disposition='released'}) {
 const {error}=await requireSupabase().rpc('pharmacy_release_stock_hold',{p_tenant_id:tenantId,p_hold_id:holdId,p_disposition:disposition});
 if(error) throw error;
}
export async function pharmacyRecordControlledDrug({tenantId,branchId,medicineId,batchId,transactionType,quantityIn=0,quantityOut=0,patientId=null,prescriptionReference=null,notes=null}) {
 const {data,error}=await requireSupabase().rpc('pharmacy_record_controlled_drug',{p_tenant_id:tenantId,p_branch_id:branchId,p_medicine_id:medicineId,p_batch_id:batchId||null,p_transaction_type:transactionType,p_quantity_in:quantityIn,p_quantity_out:quantityOut,p_patient_id:patientId,p_prescription_reference:prescriptionReference,p_notes:notes});
 if(error) throw error; return data;
}
export async function pharmacyReviewCataloguePhoto({tenantId,suggestionId,decision,medicineId,notes}) {
 const {error}=await requireSupabase().rpc('pharmacy_review_catalogue_photo',{p_tenant_id:tenantId,p_suggestion_id:suggestionId,p_decision:decision,p_medicine_id:medicineId||null,p_notes:notes||null});
 if(error) throw error;
}
