-- Secure tenant invitation issuance and redemption.
create table if not exists public.tenant_invitations (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 branch_id uuid,
 email text not null,
 role text not null check(role in ('admin','manager','doctor','pharmacist','lab_technician','pathologist','care_worker','receptionist','analyst','staff')),
 token_hash text not null unique,
 invited_by uuid not null references auth.users(id),
 expires_at timestamptz not null,
 accepted_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz not null default now(),
 constraint tenant_invitations_tenant_branch_fk foreign key(tenant_id,branch_id) references public.branches(tenant_id,id)
);
create index if not exists idx_tenant_invitations_email_pending on public.tenant_invitations(lower(email),expires_at) where accepted_at is null and revoked_at is null;
alter table public.tenant_invitations enable row level security;
drop policy if exists tenant_invitation_manager_read on public.tenant_invitations;
create policy tenant_invitation_manager_read on public.tenant_invitations for select to authenticated using(
 exists(select 1 from public.tenant_memberships m where m.tenant_id=tenant_invitations.tenant_id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','admin','manager'))
);
revoke all on public.tenant_invitations from anon,authenticated;
grant select on public.tenant_invitations to authenticated;

create or replace function public.list_tenant_team_members(p_tenant_id uuid,p_branch_id uuid default null,p_role text default null)
returns table(id uuid,user_id uuid,branch_id uuid,role text,status text,created_at timestamptz,full_name text,phone text,email text)
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare v_actor_role text; v_actor_branch uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select m.role,m.branch_id into v_actor_role,v_actor_branch from public.tenant_memberships m where m.tenant_id=p_tenant_id and m.user_id=auth.uid() and m.status='active';
 if coalesce(v_actor_role,'') not in ('owner','admin','manager') then raise exception 'Only tenant owner/admin/manager may view the employee directory'; end if;
 if v_actor_role='manager' and v_actor_branch is not null and p_branch_id is not null and p_branch_id<>v_actor_branch then raise exception 'Manager may only view employees from their assigned branch'; end if;
 return query select m.id,m.user_id,m.branch_id,m.role,m.status,m.created_at,coalesce(up.full_name,au.email),up.phone,au.email
 from public.tenant_memberships m join auth.users au on au.id=m.user_id left join public.user_profiles up on up.user_id=m.user_id
 where m.tenant_id=p_tenant_id and (p_role is null or m.role=p_role)
 and (p_branch_id is null or m.branch_id is null or m.branch_id=p_branch_id)
 and (v_actor_role<>'manager' or v_actor_branch is null or m.branch_id is null or m.branch_id=v_actor_branch)
 order by m.created_at desc;
end $$;
revoke all on function public.list_tenant_team_members(uuid,uuid,text) from public,anon;
grant execute on function public.list_tenant_team_members(uuid,uuid,text) to authenticated;

create or replace function public.create_tenant_invitation(p_tenant_id uuid,p_email text,p_role text,p_branch_id uuid,p_token_hash text,p_expires_at timestamptz)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_actor_role text; v_id uuid;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select role into v_actor_role from public.tenant_memberships where tenant_id=p_tenant_id and user_id=auth.uid() and status='active';
 if coalesce(v_actor_role,'') not in ('owner','admin','manager') then raise exception 'Only tenant owner/admin/manager may invite employees'; end if;
 if coalesce(p_role,'') not in ('manager','doctor','pharmacist','lab_technician','pathologist','care_worker','receptionist','analyst','staff') then raise exception 'Invalid invited role'; end if;
 if v_actor_role='manager' and p_role='manager' then raise exception 'Managers cannot invite managers'; end if;
 if p_branch_id is not null and not exists(select 1 from public.branches where tenant_id=p_tenant_id and id=p_branch_id) then raise exception 'Branch does not belong to tenant'; end if;
 if p_email is null or length(trim(p_email))<5 or position('@' in p_email)=0 then raise exception 'Valid invitation email required'; end if;
 if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'A SHA-256 token hash is required'; end if;
 if p_expires_at<=now() or p_expires_at>now()+interval '14 days' then raise exception 'Invitation expiry must be within 14 days'; end if;
 insert into public.tenant_invitations(tenant_id,branch_id,email,role,token_hash,invited_by,expires_at) values(p_tenant_id,p_branch_id,lower(trim(p_email)),p_role,p_token_hash,auth.uid(),p_expires_at) returning id into v_id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata) values(p_tenant_id,p_branch_id,auth.uid(),'tenant.invitation_created','tenant_invitation',v_id::text,jsonb_build_object('email',lower(trim(p_email)),'role',p_role,'expires_at',p_expires_at));
 return v_id;
end $$;
revoke all on function public.create_tenant_invitation(uuid,text,text,uuid,text,timestamptz) from public,anon;
grant execute on function public.create_tenant_invitation(uuid,text,text,uuid,text,timestamptz) to authenticated;

create or replace function public.redeem_tenant_invitation(p_token_hash text)
returns uuid language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_user uuid:=auth.uid(); v_email text; v_inv public.tenant_invitations%rowtype; v_membership uuid; v_confirmed_at timestamptz;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 select lower(email),email_confirmed_at into v_email,v_confirmed_at from auth.users where id=v_user;
 if v_confirmed_at is null then raise exception 'Verify your email address before accepting an invitation'; end if;
 if v_email is null or v_email='' then raise exception 'A verified email address is required'; end if;
 select * into v_inv from public.tenant_invitations where token_hash=p_token_hash and accepted_at is null and revoked_at is null and expires_at>now() for update;
 if not found then raise exception 'Invitation is invalid, expired, revoked or already used'; end if;
 if v_email<>lower(v_inv.email) then raise exception 'Invitation email does not match the signed-in verified account'; end if;
 insert into public.tenant_memberships(tenant_id,user_id,branch_id,role,status,invited_by) values(v_inv.tenant_id,v_user,v_inv.branch_id,v_inv.role,'active',v_inv.invited_by)
 on conflict(tenant_id,user_id) do update set branch_id=excluded.branch_id,role=excluded.role,status='active',invited_by=excluded.invited_by,updated_at=now() returning id into v_membership;
 update public.tenant_invitations set accepted_at=now() where id=v_inv.id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id,metadata) values(v_inv.tenant_id,v_inv.branch_id,v_user,'tenant.invitation_redeemed','tenant_membership',v_membership::text,jsonb_build_object('invitation_id',v_inv.id,'role',v_inv.role));
 return v_membership;
end $$;
revoke all on function public.redeem_tenant_invitation(text) from public,anon;
grant execute on function public.redeem_tenant_invitation(text) to authenticated;

create or replace function public.revoke_tenant_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_tenant uuid; v_role text; v_branch uuid;
begin
 select tenant_id,branch_id into v_tenant,v_branch from public.tenant_invitations where id=p_invitation_id and accepted_at is null and revoked_at is null for update;
 if not found then raise exception 'Pending invitation not found'; end if;
 select role into v_role from public.tenant_memberships where tenant_id=v_tenant and user_id=auth.uid() and status='active';
 if coalesce(v_role,'') not in ('owner','admin','manager') then raise exception 'Only tenant owner/admin/manager may revoke invitations'; end if;
 update public.tenant_invitations set revoked_at=now() where id=p_invitation_id;
 insert into public.audit_events(tenant_id,branch_id,actor_user_id,action,entity_type,entity_id) values(v_tenant,v_branch,auth.uid(),'tenant.invitation_revoked','tenant_invitation',p_invitation_id::text);
end $$;
revoke all on function public.revoke_tenant_invitation(uuid) from public,anon;
grant execute on function public.revoke_tenant_invitation(uuid) to authenticated;
