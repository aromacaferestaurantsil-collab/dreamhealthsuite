import { audit, corsHeaders, json, requirePlatformAdmin, sha256 } from "../_shared/platform.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const { user, admin } = await requirePlatformAdmin(req);
    const type = req.headers.get("content-type") || "";
    if (type.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("package");
      const raw = form.get("metadata");
      if (!(file instanceof File) || typeof raw !== "string") return json({ error: "Package and metadata are required" }, 400);
      const meta = JSON.parse(raw);
      if (!meta.product_key || !meta.platform || !meta.version || !meta.package_type) return json({ error: "Incomplete release metadata" }, 400);
      if (file.size < 1 || file.size > 1024 * 1024 * 1024) return json({ error: "Package must be between 1 byte and 1 GB" }, 413);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const checksum = await sha256(bytes);
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
      const path = `${meta.product_key}/${meta.platform}/${meta.version}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await admin.storage.from("release-packages").upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
      if (uploadError) throw uploadError;
      const { data, error } = await admin.from("software_releases").insert({
        product_key: meta.product_key, platform: meta.platform, version: meta.version,
        build_number: meta.build_number ?? null, package_type: meta.package_type,
        package_url: path, release_notes: meta.release_notes ?? null, minimum_os: meta.minimum_os ?? null,
        checksum_sha256: checksum, file_size_bytes: file.size, release_status: "draft",
        is_mandatory: !!meta.is_mandatory, created_by: user.id
      }).select("id,product_key,platform,version,release_status,checksum_sha256").single();
      if (error) { await admin.storage.from("release-packages").remove([path]); throw error; }
      await audit(admin, user.id, "release.package_uploaded", "software_release", data.id, { path, checksum, size: file.size });
      return json({ release: data }, 201);
    }
    const body = await req.json();
    if (body.action === "publish_release") {
      if (!body.release_id) return json({ error: "release_id is required" }, 400);
      const { data: release, error: readError } = await admin.from("software_releases").select("id,product_key,platform,version,package_url,checksum_sha256").eq("id", body.release_id).single();
      if (readError) throw readError;
      if (!release.package_url || !release.checksum_sha256) return json({ error: "A verified uploaded package is required before publishing" }, 409);
      await admin.from("software_releases").update({ is_latest: false }).eq("product_key", release.product_key).eq("platform", release.platform);
      const { data, error } = await admin.from("software_releases").update({ release_status: "published", published_at: new Date().toISOString(), is_latest: true }).eq("id", release.id).select().single();
      if (error) throw error;
      await audit(admin, user.id, "release.published", "software_release", release.id, { product_key: release.product_key, platform: release.platform, version: release.version });
      return json({ release: data });
    }
    if (body.action === "issue_license") {
      if (!body.tenant_id || !body.product_key) return json({ error: "tenant_id and product_key are required" }, 400);
      const key = `HS360-${crypto.randomUUID().replaceAll("-", "").toUpperCase()}`;
      const { data, error } = await admin.from("license_keys").insert({
        tenant_id: body.tenant_id, request_id: body.request_id ?? null, product_key: body.product_key,
        key_hash: await sha256(key), key_prefix: key.slice(0, 9), max_devices: Math.max(1, Math.min(10000, Number(body.max_devices) || 1)),
        valid_until: body.valid_until ?? null, issued_by: user.id
      }).select("id,tenant_id,product_key,key_prefix,status,max_devices,valid_from,valid_until").single();
      if (error) throw error;
      if (body.request_id) {
        const { error: updateError } = await admin.from("license_requests").update({ request_status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("id", body.request_id);
        if (updateError) throw updateError;
      }
      await audit(admin, user.id, "license.issued", "license_key", data.id, { tenant_id: data.tenant_id, product_key: data.product_key });
      return json({ license: data, license_key: key }, 201);
    }
    if (body.action === "review_request") {
      if (!body.request_id || !["approved", "rejected"].includes(body.status)) return json({ error: "Valid request_id and status are required" }, 400);
      const { data, error } = await admin.from("license_requests").update({ request_status: body.status, reviewed_by: user.id, reviewed_at: new Date().toISOString(), review_notes: body.review_notes ?? null }).eq("id", body.request_id).eq("request_status", "pending").select().single();
      if (error) throw error;
      await audit(admin, user.id, `license_request.${body.status}`, "license_request", data.id);
      return json({ request: data });
    }
    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return json({ error: message }, /required|administrator|session/.test(message) ? 403 : 400);
  }
});
