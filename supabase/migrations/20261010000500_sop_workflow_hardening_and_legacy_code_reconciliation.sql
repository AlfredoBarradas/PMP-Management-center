-- SOP workflow hardening and legacy release-code reconciliation.
-- Review and apply explicitly after validating this migration in a non-production environment.
-- 1) Reconcile released SOP documents missing their official workshop code.
-- 2) Record each reconciliation in the SOP workflow audit table.
-- 3) Disable direct legacy mutation RPCs; current UI uses the workflow task RPCs instead.
-- 4) Keep sop_counters/user_roles RLS without direct-user policies: they are not intended
--    for direct authenticated table access. SECURITY DEFINER routines enforce access.

BEGIN;

DO $migration$
DECLARE
    v_doc record;
    v_counter_next integer;
    v_max_number integer;
    v_next_number integer;
    v_new_code text;
BEGIN
    -- Keep the history sequence ahead of existing IDs before inserting audit rows.
    PERFORM pg_catalog.setval(
        'public.sop_workflow_history_id_seq'::regclass,
        GREATEST(
            (SELECT COALESCE(MAX(h.id), 0) FROM public.sop_workflow_history h),
            (SELECT s.last_value FROM public.sop_workflow_history_id_seq s)
        ),
        true
    );

    FOR v_doc IN
        SELECT sd.id AS sop_id,
               sd.workshop_id,
               sd.sop_code,
               sd.sop_number,
               w.code AS workshop_code,
               (
                   SELECT min(sr.id)
                   FROM public.sop_revisions sr
                   WHERE sr.sop_id = sd.id
                     AND sr.status = 'Released'
               ) AS released_revision_id
        FROM public.sop_documents sd
        JOIN public.workshops w ON w.id = sd.workshop_id
        WHERE EXISTS (
            SELECT 1
            FROM public.sop_revisions sr
            WHERE sr.sop_id = sd.id
              AND sr.status = 'Released'
        )
          AND (sd.sop_code IS NULL OR sd.sop_number IS NULL)
        ORDER BY sd.workshop_id, sd.id
        FOR UPDATE OF sd
    LOOP
        -- A partially populated code is ambiguous and must be repaired manually.
        IF (v_doc.sop_code IS NULL) <> (v_doc.sop_number IS NULL) THEN
            RAISE EXCEPTION
                'SOP % has inconsistent code/number fields; manual reconciliation required',
                v_doc.sop_id;
        END IF;

        IF NULLIF(pg_catalog.btrim(v_doc.workshop_code), '') IS NULL THEN
            RAISE EXCEPTION
                'SOP % has no workshop code; manual reconciliation required',
                v_doc.sop_id;
        END IF;

        INSERT INTO public.sop_counters(workshop_id, next_number, updated_at)
        VALUES (v_doc.workshop_id, 1, pg_catalog.now())
        ON CONFLICT (workshop_id) DO NOTHING;

        SELECT c.next_number
        INTO v_counter_next
        FROM public.sop_counters c
        WHERE c.workshop_id = v_doc.workshop_id
        FOR UPDATE;

        SELECT COALESCE(MAX(sd.sop_number), 0) + 1
        INTO v_max_number
        FROM public.sop_documents sd
        WHERE sd.workshop_id = v_doc.workshop_id;

        v_next_number := GREATEST(v_counter_next, v_max_number);
        v_new_code := v_doc.workshop_code || '-' || pg_catalog.lpad(v_next_number::text, 4, '0');

        UPDATE public.sop_documents
        SET sop_number = v_next_number,
            sop_code = v_new_code,
            updated_at = pg_catalog.now()
        WHERE id = v_doc.sop_id
          AND sop_number IS NULL
          AND sop_code IS NULL;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Could not reconcile official code for SOP %', v_doc.sop_id;
        END IF;

        UPDATE public.sop_counters
        SET next_number = v_next_number + 1,
            updated_at = pg_catalog.now()
        WHERE workshop_id = v_doc.workshop_id;

        -- This table has a sequence but its id column has no DEFAULT, so allocate explicitly.
        INSERT INTO public.sop_workflow_history
            (id, sop_id, revision_id, previous_status, new_status, action, comments, performed_by)
        VALUES
            (pg_catalog.nextval('public.sop_workflow_history_id_seq'::regclass),
             v_doc.sop_id, v_doc.released_revision_id, 'Released', 'Released',
             'Code Reconciliation',
             'Assigned missing official code ' || v_new_code
                 || ' to an already released SOP during migration.',
             NULL);
    END LOOP;
END;
$migration$;

-- These legacy RPCs change SOP state outside the current workflow engine.
-- The frontend uses workflow_start_instance, workflow_complete_task and
-- workflow_reject_task; remove direct execution from API-facing roles.
REVOKE ALL ON FUNCTION public.approve_sop_revision(bigint, integer, text, uuid)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_sop_revision(bigint, text, uuid)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_sop_revision(bigint, text, uuid)
    TO authenticated;
REVOKE ALL ON FUNCTION public.reject_sop_revision(bigint, integer, text, uuid)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_sop_for_validation(bigint, integer, text, uuid)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.supervisor_release_sop_revision(bigint, integer, text, uuid)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_sop_revision(bigint, integer, text, uuid)
    FROM PUBLIC, anon, authenticated;


-- Private storage for revision attachments.
ALTER TABLE public.sop_revisions
    ADD COLUMN IF NOT EXISTS storage_path text,
    ADD COLUMN IF NOT EXISTS document_name text,
    ADD COLUMN IF NOT EXISTS document_mime_type text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'sop-revision-files',
    'sop-revision-files',
    false,
    20971520,
    ARRAY[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
    ]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "SOP revision files view permission" ON storage.objects;
CREATE POLICY "SOP revision files view permission"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'sop-revision-files'
    AND public.has_permission('documents.sop.view')
);

DROP POLICY IF EXISTS "SOP revision files create permission" ON storage.objects;
CREATE POLICY "SOP revision files create permission"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'sop-revision-files'
    AND public.has_permission('documents.sop.create')
);

DROP POLICY IF EXISTS "SOP revision files update permission" ON storage.objects;
CREATE POLICY "SOP revision files update permission"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'sop-revision-files'
    AND public.has_permission('documents.sop.create')
)
WITH CHECK (
    bucket_id = 'sop-revision-files'
    AND public.has_permission('documents.sop.create')
);

DROP POLICY IF EXISTS "SOP revision files delete permission" ON storage.objects;
CREATE POLICY "SOP revision files delete permission"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'sop-revision-files'
    AND public.has_permission('documents.sop.create')
);

CREATE OR REPLACE FUNCTION public.save_sop_revision_file(
    p_sop_id bigint,
    p_revision_id bigint,
    p_storage_path text,
    p_document_name text,
    p_document_mime_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_actor_id uuid;
BEGIN
    v_actor_id := auth.uid();
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;
    IF NOT public.has_permission('documents.sop.create') THEN
        RAISE EXCEPTION 'Insufficient permission to attach a revision file' USING ERRCODE = '42501';
    END IF;
    IF p_storage_path IS NULL
       OR p_storage_path !~ ('^' || p_sop_id::text || '/' || p_revision_id::text || '/[^/]+) THEN
        RAISE EXCEPTION 'Invalid SOP revision storage path';
    END IF;
    IF pg_catalog.btrim(COALESCE(p_document_name, '')) = '' THEN
        RAISE EXCEPTION 'Document name cannot be empty';
    END IF;
    IF p_document_mime_type NOT IN (
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
    ) THEN
        RAISE EXCEPTION 'Unsupported SOP document type';
    END IF;
    UPDATE public.sop_revisions AS r
    SET storage_path = p_storage_path,
        document_name = pg_catalog.btrim(p_document_name),
        document_mime_type = p_document_mime_type
    WHERE r.id = p_revision_id
      AND r.sop_id = p_sop_id
      AND r.status = 'Draft'
      AND r.created_by = v_actor_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Draft revision not found or not owned by the current user';
    END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_sop_revision_file(bigint, bigint, text, text, text)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_sop_revision_file(bigint, bigint, text, text, text)
    TO authenticated;

COMMIT;
