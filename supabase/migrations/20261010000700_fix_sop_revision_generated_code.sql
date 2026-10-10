-- Fix SOP revision creation for generated revision_code and explicit history IDs.
-- Apply only after review; this migration has not been applied to Supabase.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_sop_revision(
    p_sop_id bigint,
    p_change_summary text,
    p_created_by uuid DEFAULT auth.uid()
)
RETURNS TABLE(
    sop_id bigint,
    sop_code text,
    previous_revision text,
    revision_code text,
    status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_actor_id uuid;
    v_sop_code text;
    v_current_revision integer;
    v_previous_revision_code text;
    v_current_revision_status text;
    v_new_revision integer;
    v_revision_code text;
    v_revision_id bigint;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    IF p_created_by IS DISTINCT FROM v_actor_id THEN
        RAISE EXCEPTION 'Actor identity mismatch';
    END IF;
    IF NOT public.has_permission('documents.sop.create') THEN
        RAISE EXCEPTION 'Insufficient permission to create SOP revisions';
    END IF;
    SELECT d.sop_code
    INTO v_sop_code
    FROM public.sop_documents AS d
    WHERE d.id = p_sop_id
    FOR UPDATE;
    IF NOT FOUND OR v_sop_code IS NULL THEN
        RAISE EXCEPTION 'SOP does not exist or has no official code';
    END IF;
    IF pg_catalog.btrim(COALESCE(p_change_summary, '')) = '' THEN
        RAISE EXCEPTION 'Change Summary cannot be empty';
    END IF;
    SELECT max(r.revision_number)
    INTO v_current_revision
    FROM public.sop_revisions AS r
    WHERE r.sop_id = p_sop_id;
    IF v_current_revision IS NULL THEN
        RAISE EXCEPTION 'SOP does not have a revision';
    END IF;
    SELECT r.revision_code, r.status
    INTO v_previous_revision_code, v_current_revision_status
    FROM public.sop_revisions AS r
    WHERE r.sop_id = p_sop_id
      AND r.revision_number = v_current_revision;
    IF v_current_revision_status IS DISTINCT FROM 'Released' THEN
        RAISE EXCEPTION 'Cannot create a new revision until the current revision is Released';
    END IF;
    v_new_revision := v_current_revision + 1;
    v_revision_code := 'R' || pg_catalog.lpad(v_new_revision::text, 2, '0');
    -- revision_code is GENERATED ALWAYS, so insert revision_number only.
    INSERT INTO public.sop_revisions (
        sop_id,
        revision_number,
        description,
        status,
        created_by
    )
    VALUES (
        p_sop_id,
        v_new_revision,
        pg_catalog.btrim(p_change_summary),
        'Draft',
        v_actor_id
    )
    RETURNING id, sop_revisions.revision_code INTO v_revision_id, v_revision_code;
    -- This table's id has no DEFAULT; allocate from its sequence explicitly.
    INSERT INTO public.sop_workflow_history (
        id,
        sop_id,
        revision_id,
        previous_status,
        new_status,
        action,
        comments,
        performed_by
    )
    VALUES (
        pg_catalog.nextval('public.sop_workflow_history_id_seq'::regclass),
        p_sop_id,
        v_revision_id,
        'Released',
        'Draft',
        'Create Revision',
        pg_catalog.btrim(p_change_summary),
        v_actor_id
    );
    RETURN QUERY
    SELECT p_sop_id, v_sop_code, v_previous_revision_code, v_revision_code, 'Draft'::text;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_sop_revision(bigint, text, uuid)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sop_revision(bigint, text, uuid)
    TO authenticated;

COMMIT;
