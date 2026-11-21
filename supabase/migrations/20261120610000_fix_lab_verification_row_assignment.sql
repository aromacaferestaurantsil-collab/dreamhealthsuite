-- Fix composite row assignment in the private pathologist verification implementation.
do $$
declare v_def text; v_new text;
begin
 v_def:=pg_get_functiondef('private.lab_verify_result_impl(uuid,boolean)'::regprocedure);
 v_new:=replace(v_def,'select lr into r','select lr.* into r');
 if v_new<>v_def then
  execute v_new;
 elsif position('select lr.* into r' in v_def)=0 then
  raise exception 'Unexpected lab verification function body; manual review required';
 end if;
end;
$$;
