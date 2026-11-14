apper.serve(async (req) => {
  const send = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  try {
    const body = await req.json();
    const licenseKey = String(body.licenseKey || '').trim().toUpperCase();
    const installationId = String(body.installationId || '').trim();
    const deviceLabel = String(body.deviceLabel || 'Unknown device').trim().slice(0, 120);
    const platform = String(body.platform || 'Other');
    const allowedPlatforms = ['Windows', 'macOS', 'Linux', 'Android', 'iOS', 'Web', 'Other'];
    if (!licenseKey || !installationId) return send({ success: false, message: 'License key and installation ID are required.' }, 400);
    if (installationId.length < 12 || installationId.length > 128) return send({ success: false, message: 'Installation ID is invalid.' }, 400);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(licenseKey));
    const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    const { eq } = sdk.core;
    const keyResult = await sdk.table('license_keys_c')
      .select(['Id', 'license_request_c', 'tenant_c', 'subscription_c', 'key_hash_c', 'status_c', 'expires_on_c', 'max_devices_c', 'redeemed_on_c'])
      .where(eq('key_hash_c', hash)).fetch();
    if (!keyResult.success || !keyResult.data?.length) return send({ success: false, message: 'Invalid activation key.' }, 404);
    const key = keyResult.data[0];
    if (key.status_c === 'Revoked' || key.status_c === 'Expired') return send({ success: false, message: 'This activation key is no longer valid.' }, 403);
    if (key.status_c === 'Issued' && key.expires_on_c && new Date(key.expires_on_c).getTime() < Date.now()) {
      await sdk.table('license_keys_c').update({ Id: key.Id, status_c: 'Expired' });
      return send({ success: false, message: 'This activation key has expired. Contact the software administrator.' }, 403);
    }
    if (!allowedPlatforms.includes(platform)) return send({ success: false, message: 'Unsupported device platform.' }, 400);
    const existing = await sdk.table('device_activations_c')
      .select(['Id', 'installation_id_c', 'status_c'])
      .where(eq('license_key_c', key.Id))
      .fetch();
    if (!existing.success) return send({ success: false, message: 'Unable to verify device registration.' }, 500);
    const sameDevice = existing.data.find(device => device.installation_id_c === installationId);
    if (sameDevice) {
      if (sameDevice.status_c !== 'Active') return send({ success: false, message: 'This device has been blocked or deactivated.' }, 403);
      await sdk.table('device_activations_c').update({ Id: sameDevice.Id, last_seen_c: new Date().toISOString(), device_label_c: deviceLabel, platform_c: platform });
    } else {
      const activeCount = existing.data.filter(device => device.status_c === 'Active').length;
      const maxDevices = Math.max(1, Number(key.max_devices_c || 1));
      if (activeCount >= maxDevices) return send({ success: false, message: 'This licence has reached its device limit. Ask the account administrator to deactivate a device or increase the limit.' }, 409);
      const created = await sdk.table('device_activations_c').create({
        Name: deviceLabel || 'Licensed device',
        license_key_c: key.Id,
        installation_id_c: installationId,
        device_label_c: deviceLabel,
        platform_c: platform,
        activated_on_c: new Date().toISOString(),
        last_seen_c: new Date().toISOString(),
        status_c: 'Active'
      });
      if (!created.data?.length) return send({ success: false, message: created.messages?.[0] || 'Device activation could not be saved.' }, 500);
    }
    if (key.status_c === 'Issued') {
      const marked = await sdk.table('license_keys_c').update({ Id: key.Id, status_c: 'Redeemed', redeemed_on_c: new Date().toISOString() });
      if (!marked.data?.length) return send({ success: false, message: 'Device was registered, but the key status could not be updated. Contact support before retrying.' }, 409);
    }
    const requestId = key.license_request_c?.Id || key.license_request_c;
    const requestResult = await sdk.table('license_requests_c')
      .select(['Id', 'business_name_c', 'email_c', 'phone_c', 'plan_c', 'trial_end_c'])
      .get(String(requestId));
    const tenantId = key.tenant_c?.Id || key.tenant_c;
    const subscriptionId = key.subscription_c?.Id || key.subscription_c;
    const tenantResult = tenantId
      ? await sdk.table('tenants_c').select(['Id', 'Name', 'status_c', 'modules_c']).get(String(tenantId))
      : null;
    const subscriptionResult = subscriptionId
      ? await sdk.table('subscriptions_c').select(['Id', 'status_c', 'start_date_c', 'end_date_c', 'amount_c', 'currency_c']).get(String(subscriptionId))
      : null;
    return send({
      success: true,
      message: 'This installation is activated.',
      tenant: tenantResult?.data ? { id: tenantResult.data.Id, name: tenantResult.data.Name, status: tenantResult.data.status_c, modules: tenantResult.data.modules_c } : null,
      subscription: subscriptionResult?.data ? { id: subscriptionResult.data.Id, status: subscriptionResult.data.status_c, startsOn: subscriptionResult.data.start_date_c, endsOn: subscriptionResult.data.end_date_c, amount: subscriptionResult.data.amount_c, currency: subscriptionResult.data.currency_c } : null,
      customer: requestResult?.data ? { businessName: requestResult.data.business_name_c, email: requestResult.data.email_c } : null,
      maxDevices: Number(key.max_devices_c || 1)
    });
  } catch (error) {
    return send({ success: false, message: error?.message || 'Activation failed.' }, 500);
  }
});