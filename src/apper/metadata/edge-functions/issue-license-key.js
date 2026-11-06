apper.serve(async (req) => {
  const send = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  try {
    const body = await req.json();
    const requestId = String(body.requestId || '');
    const maxDevices = Math.max(1, Math.min(10, Number(body.maxDevices || 1)));
    if (!requestId) return send({ success: false, message: 'A license request is required.' }, 400);

    const requestResult = await sdk.table('license_requests_c')
      .select(['Id', 'business_name_c', 'email_c', 'phone_c', 'status_c', 'trial_end_c'])
      .get(requestId);
    if (!requestResult.success || !requestResult.data) {
      return send({ success: false, message: 'License request was not found or is not accessible.' }, 404);
    }
    const request = requestResult.data;
    if (request.status_c === 'Rejected') {
      return send({ success: false, message: 'A rejected request cannot receive a license key.' }, 409);
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
      return send({ success: false, message: created.messages?.[0] || created.message || 'Unable to create license key.' }, 400);
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