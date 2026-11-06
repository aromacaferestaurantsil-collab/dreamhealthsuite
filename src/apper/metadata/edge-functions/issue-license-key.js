apper.serve(async (req) => {
  const send = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  try {
    const { eq } = sdk.core;
    const body = await req.json();
    const requestId = String(body.requestId || '');
    const maxDevices = Math.max(1, Math.min(10, Number(body.maxDevices || 1)));
    if (!requestId) return send({ success: false, message: 'A license request is required.' }, 400);

    const requestResult = await sdk.table('license_requests_c')
      .select(['Id', 'business_name_c', 'email_c', 'phone_c', 'business_type_c', 'status_c', 'trial_days_c', 'trial_start_c', 'trial_end_c', 'amount_c', 'currency_c', 'billing_cycle_c', 'plan_c'])
      .get(requestId);
    if (!requestResult.success || !requestResult.data) {
      return send({ success: false, message: 'License request was not found or is not accessible.' }, 404);
    }
    const request = requestResult.data;
    if (request.status_c === 'Rejected' || request.status_c === 'Provisioned') {
      return send({ success: false, message: 'This request is rejected or already provisioned. A second key cannot be issued.' }, 409);
    }

    const prior = await sdk.table('license_keys_c').select(['Id'])
      .where(eq('license_request_c', request.Id)).fetch();
    if (!prior.success) return send({ success: false, message: prior.message || 'Unable to check previous keys.' }, 400);
    if (prior.data.length) return send({ success: false, message: 'A key already exists for this customer request.' }, 409);

    const planId = request.plan_c?.Id || request.plan_c;
    const planResult = await sdk.table('plans_c')
      .select(['Id', 'Name', 'product_c', 'download_url_c'])
      .get(String(planId));
    if (!planResult.success || !planResult.data) {
      return send({ success: false, message: 'The selected software plan no longer exists.' }, 404);
    }
    const plan = planResult.data;
    const product = plan.product_c;
    const modules = product === 'HealthSuite 360'
      ? ['PharmaSuite', 'LabSuite', 'DoctorSuite', 'PatientSuite', 'CareConnect', 'HealthAnalytics']
      : [product];

    const tenant = await sdk.table('tenants_c').create({
      Name: request.business_name_c,
      business_type_c: request.business_type_c || 'Clinic',
      status_c: 'Trial',
      modules_c: modules,
      subscription_plan_c: 'Custom',
      email_c: request.email_c,
      phone_c: request.phone_c
    });
    if (!tenant.data?.length) {
      return send({ success: false, message: tenant.messages?.[0] || 'Business tenant creation failed.' }, 400);
    }
    const tenantRecord = tenant.data[0];

    const subscription = await sdk.table('subscriptions_c').create({
      Name: 'SUB-' + Date.now(),
      tenant_c: tenantRecord.Id,
      plan_c: 'Custom',
      billing_cycle_c: request.billing_cycle_c || 'Monthly',
      status_c: 'Trial',
      amount_c: Number(request.amount_c || 0),
      currency_c: request.currency_c || 'INR',
      start_date_c: request.trial_start_c || new Date().toISOString().slice(0, 10),
      end_date_c: request.trial_end_c || null,
      trial_days_c: Number(request.trial_days_c || 30),
      notes_c: 'Provisioned from ' + plan.Name + '. Trial terms and agreed price are stored in the license request.'
    });
    if (!subscription.data?.length) {
      return send({ success: false, message: subscription.messages?.[0] || 'Tenant was created but subscription creation failed. Review tenant ' + tenantRecord.Id }, 409);
    }

    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const raw = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('').toUpperCase();
    const key = raw.match(/.{1,6}/g).join('-');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
    const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    const expiry = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    const created = await sdk.table('license_keys_c').create({
      Name: 'LIC-' + Date.now(),
      license_request_c: request.Id,
      key_hash_c: hash,
      status_c: 'Issued',
      expires_on_c: expiry,
      max_devices_c: maxDevices
    });
    if (!created.data?.length) {
      return send({ success: false, message: created.messages?.[0] || 'Tenant and subscription were created, but key creation failed. Review records before retrying.' }, 409);
    }

    const updated = await sdk.table('license_requests_c').update({
      Id: request.Id,
      status_c: 'Provisioned'
    });
    if (!updated.data?.length) {
      return send({ success: false, message: updated.messages?.[0] || 'Key created but request status update failed. Review the license register.' }, 409);
    }

    return send({
      success: true,
      licenseKey: key,
      expiresOn: expiry,
      maxDevices,
      downloadUrl: plan.download_url_c,
      tenantId: tenantRecord.Id,
      subscriptionId: subscription.data[0].Id,
      customer: {
        businessName: request.business_name_c,
        email: request.email_c,
        phone: request.phone_c
      }
    });
  } catch (error) {
    return send({ success: false, message: error?.message || 'License key generation failed.' }, 500);
  }
});