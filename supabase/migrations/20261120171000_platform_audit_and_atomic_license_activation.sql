create table if not exists public.platform_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
alter table public.platform_audit_events enable row level security;
-- No client policies. Only service-role Edge Functions can write/read platform audit events.

create or replace function public.activate_license_device(
  p_license_id uuid,
  p_device_fingerprint_hash text,
  p_device_label text default null,
  p_platform text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_license public.license_keys%rowtype;
  v_activation_id uuid;
  v_active_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_license_id::text, 0));
  select * into v_license from public.license_keys where id = p_license_id for update;
  if not found or v_license.status <> 'active'
     or v_license.valid_from > now()
     or (v_license.valid_until is not null and v_license.valid_until < now()) then
    raise exception 'license is not active or outside validity' using errcode = '22023';
  end if;
  select id into v_activation_id
    from public.license_device_activations
    where license_id = p_license_id
      and device_fingerprint_hash = p_device_fingerprint_hash
      and deactivated_at is null
    for update;
  if v_activation_id is not null then
    update public.license_device_activations
      set last_seen_at = now()
      where id = v_activation_id;
    return v_activation_id;
  end if;
  select count(*) into v_active_count from public.license_device_activations
    where license_id = p_license_id and deactivated_at is null;
  if v_active_count >= v_license.max_devices then
    raise exception 'device activation limit reached' using errcode = '23514';
  end if;
  insert into public.license_device_activations(license_id,device_fingerprint_hash,device_label,platform)
    values(p_license_id,p_device_fingerprint_hash,p_device_label,p_platform)
    returning id into v_activation_id;
  return v_activation_id;
end;
$$;
revoke all on function public.activate_license_device(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.activate_license_device(uuid,text,text,text) to service_role;
