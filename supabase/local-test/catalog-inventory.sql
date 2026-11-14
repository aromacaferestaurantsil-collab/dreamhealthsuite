-- Read-only schema inventory for the HealthSuite 360 baseline reconstruction.
-- Run against the existing Supabase project using SQL Editor. This query does not mutate data.
select jsonb_pretty(jsonb_build_object(
  'tables', (
    select jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'table', c.relname,
      'rls_enabled', c.relrowsecurity, 'rls_forced', c.relforcerowsecurity,
      'columns', (
        select jsonb_agg(jsonb_build_object(
          'name', a.attname, 'type', format_type(a.atttypid,a.atttypmod),
          'not_null', a.attnotnull, 'default', pg_get_expr(d.adbin,d.adrelid),
          'identity', a.attidentity, 'generated', a.attgenerated
        ) order by a.attnum)
        from pg_attribute a
        left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
        where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
      ),
      'constraints', (
        select jsonb_agg(jsonb_build_object('name', con.conname, 'type', con.contype,
          'definition', pg_get_constraintdef(con.oid)))
        from pg_constraint con where con.conrelid=c.oid
      ),
      'indexes', (
        select jsonb_agg(pg_get_indexdef(i.indexrelid))
        from pg_index i where i.indrelid=c.oid
      ),
      'policies', (
        select jsonb_agg(jsonb_build_object('name',p.policyname,'command',p.cmd,
          'roles',p.roles,'using',p.qual,'with_check',p.with_check))
        from pg_policies p where p.schemaname=n.nspname and p.tablename=c.relname
      )
    ) order by c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private') and c.relkind='r'
  ),
  'functions', (
    select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',p.proname,
      'identity_args',pg_get_function_identity_arguments(p.oid),
      'definition',pg_get_functiondef(p.oid),'security_definer',p.prosecdef))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private')
  ),
  'triggers', (
    select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,
      'name',t.tgname,'definition',pg_get_triggerdef(t.oid)))
    from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where not t.tgisinternal and n.nspname in ('public','private')
  ),
  'extensions', (select jsonb_agg(extname) from pg_extension),
  'schemas', (select jsonb_agg(jsonb_build_object('name',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl))
    from pg_namespace where nspname in ('public','private'))
)) as healthsuite_schema_inventory;
