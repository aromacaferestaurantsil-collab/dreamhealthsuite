create or replace function public.create_tenant_with_owner(
 p_legal_name text,p_display_name text,p_slug text,p_branch_name text,p_branch_code text
) returns uuid language plpgsql security definer set search_path=pg_catalog,public,private
as $$
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 return private.create_tenant_with_owner(p_legal_name,p_display_name,p_slug,p_branch_name,p_branch_code);
end $$;
revoke all on function public.create_tenant_with_owner(text,text,text,text,text) from public,anon;
grant execute on function public.create_tenant_with_owner(text,text,text,text,text) to authenticated;