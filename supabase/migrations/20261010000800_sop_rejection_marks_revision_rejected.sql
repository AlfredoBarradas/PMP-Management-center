-- Mark a rejected SOP revision as Rejected instead of Draft.
-- Preserve the rejection reason in workflow_history, and do not delete audit records.
DO $migration$
DECLARE
    v_definition text;
BEGIN
    v_definition := pg_catalog.pg_get_functiondef('public.workflow_reject_task(bigint,text)'::regprocedure);
    IF pg_catalog.strpos(v_definition, 'SET status = ''Draft'',released_at = NULL') = 0 THEN
        RAISE EXCEPTION 'Expected rejection status update was not found; migration stopped without changes';
    END IF;
    v_definition := pg_catalog.replace(v_definition, 'SET status = ''Draft'',released_at = NULL', 'SET status = ''Rejected'',released_at = NULL');
    v_definition := pg_catalog.replace(v_definition, '''to_status'',''Draft'',''reason''', '''to_status'',''Rejected'',''reason''');
    EXECUTE v_definition;
END;
$migration$;
