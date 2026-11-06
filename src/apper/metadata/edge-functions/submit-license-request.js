apper.serve(async (req) => {
  const send = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  try {
    const body = await req.json();
    const businessName = String(body.businessName || '').trim();
    const phone = String(body.phone || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const planId = String(body.planId || '').trim();
    const businessType = String(body.businessType || 'Clinic');
    if (!businessName || !phone || !email || !planId) {
      return send({ success: false, message: 'Business name, phone, email, and plan are required.' }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return send({ success: false, message: 'Enter a valid email address.' }, 400);
    }
    if (phone.replace(/\D/g, '').length < 8) {
      return send({ success: false, message: 'Enter a valid phone number.' }, 400);
    }

    const planResult = await sdk.table('plans_c')
      .select(['Id', 'Name', 'product_c', 'price_c', 'offer_price_c', 'currency_c', 'billing_cycle_c', 'default_trial_days_c', 'is_active_c'])
      .get(planId);
    if (!planResult.success || !planResult.data || planResult.data.is_active_c !== true) {
      return send({ success: false, message: 'This plan is unavailable. Please choose a published plan.' }, 404);
    }
    const plan = planResult.data;
    const trialDays = Math.max(1, Math.min(180, Number(body.trialDays || plan.default_trial_days_c || 30)));
    const start = new Date();
    const end = new Date(start.getTime());
    end.setUTCDate(end.getUTCDate() + trialDays);
    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);
    const standardPrice = Number(plan.price_c || 0);
    const offerPrice = Number(plan.offer_price_c || 0);
    const amount = offerPrice > 0 && offerPrice < standardPrice ? offerPrice : standardPrice;

    const created = await sdk.table('license_requests_c').create({
      Name: 'REQ-' + Date.now(),
      business_name_c: businessName,
      phone_c: phone,
      email_c: email,
      business_type_c: businessType,
      plan_c: plan.Id,
      source_c: 'Online',
      status_c: 'New',
      trial_days_c: trialDays,
      trial_start_c: startDate,
      trial_end_c: endDate,
      standard_price_c: standardPrice,
      offer_price_c: offerPrice,
      amount_c: amount,
      currency_c: plan.currency_c || 'INR',
      billing_cycle_c: plan.billing_cycle_c || 'Monthly'
    });
    if (!created.data?.length) {
      return send({ success: false, message: created.messages?.[0] || created.message || 'Unable to submit your request.' }, 400);
    }

    return send({
      success: true,
      requestId: created.data[0].Id,
      trialDays,
      trialStart: startDate,
      trialEnd: endDate,
      amount,
      currency: plan.currency_c || 'INR',
      plan: plan.Name,
      product: plan.product_c,
      message: 'Your request has been received. The platform team will review it and send your download and activation details.'
    });
  } catch (error) {
    return send({ success: false, message: error?.message || 'Request could not be submitted.' }, 500);
  }
});