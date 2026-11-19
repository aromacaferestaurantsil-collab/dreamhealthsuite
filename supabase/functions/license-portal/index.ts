import { caller, corsHeaders, json, sha256 } from "../_shared/platform.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { user, userClient, admin } = await caller(req);
    const body = await req.json();
    if (body.action === "request_license") {
      if (!body.tenant_id || !body.product_key) return json({ error: "tenant_id and product_key are required" }, 400);
      const { data: membership, error: memberError } = await userClient.from("tenant_memberships").select("tenant_id,role,status").eq("tenant_id", body.tenant_id).eq("user_id", user.id).eq("status", "active").maybeSingle();
      if (memberError || !membership || !["owner", "admin"].includes(membership.role)) return json({ error: "Active tenant owner or administrator membership required" }, 403);
      const { data, error } = await admin.from("license_requests").insert({
        tenant_id: body.tenant_id, requested_by: user.id, product_key: body.product_key,
        requested_seats: Math.max(1, Math.min(10000, Number(body.requested_seats) || 1)),
        request_notes: body.request_notes ?? null
      }).select("id,tenant_id,product_key,requested_seats,request_status,created_at").single();
      if (error) throw error;
      return json({ request: data }, 201);
    }
    if (body.action === "activate_license") {
      if (!body.license_key || !body.device_fingerprint || !body.product_key) return json({ error: "license_key, device_fingerprint and product_key are required" }, 400);
      const keyHash = await sha256(body.license_key);
      const deviceHash = await sha256(body.device_fingerprint);
      const { data: license, error } = await admin.from("license_keys").select("id,tenant_id,product_key,status,max_devices,valid_from,valid_until").eq("key_hash", keyHash).single();
      if (error || !license || license.status !== "active" || license.product_key !== body.product_key) return json({ error: "License is invalid or inactive" }, 403);
      const now = Date.now();
      if (new Date(license.valid_from).getTime() > now || (license.valid_until && new Date(license.valid_until).getTime() < now)) return json({ error: "License is outside its validity period" }, 403);
      const { data: activationId, error: activationError } = await admin.rpc("activate_license_device", {
        p_license_id: license.id,
        p_device_fingerprint_hash: deviceHash,
        p_device_label: body.device_label ?? null,
        p_platform: body.platform ?? null
      });
      if (activationError) {
        const status = activationError.message?.includes("limit reached") ? 409 : 403;
        return json({ error: activationError.message }, status);
      }
      return json({ activated: true, tenant_id: license.tenant_id, product_key: license.product_key });
    }
    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected server error" }, 400);
  }
});
