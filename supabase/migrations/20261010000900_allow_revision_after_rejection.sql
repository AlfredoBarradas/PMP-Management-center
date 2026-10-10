-- Allow a new sequential revision after a rejected revision, based on the latest Released revision.
-- The rejected revision remains in the audit trail; the new revision number remains sequential (e.g. R02).
DO $migration$
DECLARE
    v_definition text;
BEGIN
    v_definition := pg_catalog.pg_get_functiondef('public.create_sop_revision(bigint,text,uuid)'::regprocedure);
    IF pg_catalog.strpos(v_definition, 'IF v_current_revision_status IS DISTINCT FROM ''Released'' THEN') = 0 THEN
        RAISE EXCEPTION 'Expected create revision guard was not found; migration stopped without changes';
    END IF;
    v_definition := pg_catalog.replace(
        v_definition,
        'IF v_current_revision_status IS DISTINCT FROM ''Released'' THEN',
        'IF v_current_revision_status NOT IN (''Released'', ''Rejected'') THEN'
    );
    v_definition := pg_catalog.replace(
        v_definition,
        'Cannot create a new revision until the current revision is Released',
        'Cannot create a new revision while the latest revision is still in workflow or Draft'
    );
    v_definition := pg_catalog.replace(
        v_definition,
        'SELECT r.revision_code, r.status
    INTO v_previous_revision_code, v_current_revision_status
    FROM public.sop_revisions AS r
    WHERE r.sop_id = p_sop_id
      AND r.revision_number = v_current_revision;',
        'SELECT r.revision_code, r.status
    INTO v_previous_revision_code, v_current_revision_status
    FROM public.sop_revisions AS r
    WHERE r.sop_id = p_sop_id
      AND r.revision_number = v_current_revision;
    IF v_current_revision_status = ''Rejected'' THEN
        SELECT r.revision_code
        INTO v_previous_revision_code
        FROM public.sop_revisions AS r
        WHERE r.sop_id = p_sop_id AND r.status = ''Released''
        ORDER BY r.revision_number DESC
        LIMIT 1;
        IF v_previous_revision_code IS NULL THEN
            RAISE EXCEPTION ''No released revision exists to base the next revision on'';
        END IF;
    END IF;'
    );
    EXECUTE v_definition;
END;
$migration$;
