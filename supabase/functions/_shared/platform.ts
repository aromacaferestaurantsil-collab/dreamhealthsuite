import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export function clients(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Authentication required");
  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  return { userClient, admin, token };
}
export async function caller(req: Request) {
  const { userClient, admin } = clients(req);
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error("Invalid or expired session");
  return { user: data.user, userClient, admin };
}
export async function requirePlatformAdmin(req: Request) {
  const ctx = await caller(req);
  const { data, error } = await ctx.admin.from("platform_admins").select("user_id").eq("user_id", ctx.user.id).eq("active", true).maybeSingle();
  if (error || !data) throw new Error("Platform administrator access required");
  return ctx;
}
export async function audit(admin: any, actor: string, action: string, entityType: string, entityId: string, metadata: Record<string, unknown> = {}) {
  const { error } = await admin.from("platform_audit_events").insert({
    actor_user_id: actor, action, entity_type: entityType, entity_id: entityId,
    occurred_at: new Date().toISOString(), metadata
  });
  if (error) throw error;
}
export async function sha256(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
