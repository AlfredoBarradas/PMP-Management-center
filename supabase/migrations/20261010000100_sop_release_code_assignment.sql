-- SOP release numbering
-- Review this migration before applying it to Supabase.
-- Assigns the official workshop-specific code only when an approval task releases an SOP.
-- The entire operation runs inside the caller's PostgreSQL transaction.

CREATE OR REPLACE FUNCTION public.workflow_complete_task(
    p_task_id bigint,
    p_transition_key text DEFAULT NULL::text,
    p_result jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_instance_id bigint;
    v_version_id bigint;
    v_node_id bigint;
    v_task_status text;
    v_instance_status text;
    v_current_node_id bigint;
    v_required_permission text;
    v_document_type_code text;
    v_source_document_id bigint;
    v_source_revision_id bigint;
    v_revision_status text;
    v_outgoing_count integer;
    v_transition_id bigint;
    v_target_node_id bigint;
    v_target_type text;
    v_target_permission text;
    v_transition_label text;
    v_next_task_id bigint;
    v_new_instance_status text := 'in_progress';
    v_workshop_id bigint;
    v_workshop_code text;
    v_existing_sop_number integer;
    v_existing_sop_code text;
    v_max_sop_number integer;
    v_next_sop_number integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;
    IF NOT public.has_permission('workflow.tasks.act') THEN
        RAISE EXCEPTION 'Missing permission: workflow.tasks.act' USING ERRCODE = '42501';
    END IF;
    IF p_result IS NOT NULL AND pg_catalog.jsonb_typeof(p_result) <> 'object' THEN
        RAISE EXCEPTION 'Task result must be a JSON object';
    END IF;

    SELECT t.instance_id, wi.version_id, t.node_id, t.status, wi.status, wi.current_node_id,
           n.required_permission_code, wi.document_type_code, wi.source_document_id, wi.source_revision_id
    INTO v_instance_id, v_version_id, v_node_id, v_task_status, v_instance_status, v_current_node_id,
         v_required_permission, v_document_type_code, v_source_document_id, v_source_revision_id
    FROM public.workflow_tasks t
    JOIN public.workflow_instances wi ON wi.id = t.instance_id
    JOIN public.workflow_nodes n ON n.id = t.node_id AND n.version_id = wi.version_id
    WHERE t.id = p_task_id
    FOR UPDATE OF t, wi;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Workflow task not found or node/version mismatch';
    END IF;
    IF v_task_status NOT IN ('pending', 'in_progress')
       OR v_instance_status <> 'in_progress'
       OR v_current_node_id <> v_node_id THEN
        RAISE EXCEPTION 'Task is not the active task';
    END IF;
    IF v_required_permission IS NOT NULL AND NOT public.has_permission(v_required_permission) THEN
        RAISE EXCEPTION 'Missing node permission: %', v_required_permission USING ERRCODE = '42501';
    END IF;

    IF p_transition_key IS NULL THEN
        SELECT COUNT(*), MIN(tr.id)
        INTO v_outgoing_count, v_transition_id
        FROM public.workflow_transitions tr
        WHERE tr.version_id = v_version_id AND tr.from_node_id = v_node_id;
        IF v_outgoing_count <> 1 THEN
            RAISE EXCEPTION 'Provide a transition key when the current node has multiple outgoing transitions';
        END IF;
    ELSE
        SELECT COUNT(*), MIN(tr.id)
        INTO v_outgoing_count, v_transition_id
        FROM public.workflow_transitions tr
        WHERE tr.version_id = v_version_id
          AND tr.from_node_id = v_node_id
          AND tr.transition_key = p_transition_key;
        IF v_outgoing_count <> 1 THEN
            RAISE EXCEPTION 'Transition key is not a valid outgoing transition for this task';
        END IF;
    END IF;

    SELECT tr.to_node_id, n.node_type, tr.label, n.required_permission_code
    INTO v_target_node_id, v_target_type, v_transition_label, v_target_permission
    FROM public.workflow_transitions tr
    JOIN public.workflow_nodes n ON n.id = tr.to_node_id AND n.version_id = tr.version_id
    WHERE tr.id = v_transition_id;

    IF v_document_type_code = 'sop' THEN
        SELECT sd.workshop_id, sd.sop_number, sd.sop_code, w.code
        INTO v_workshop_id, v_existing_sop_number, v_existing_sop_code, v_workshop_code
        FROM public.sop_documents sd
        JOIN public.workshops w ON w.id = sd.workshop_id
        WHERE sd.id = v_source_document_id
        FOR UPDATE OF sd;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'SOP document linked to workflow was not found';
        END IF;

        SELECT sr.status
        INTO v_revision_status
        FROM public.sop_revisions sr
        WHERE sr.id = v_source_revision_id AND sr.sop_id = v_source_document_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'SOP revision does not belong to the workflow document';
        END IF;

        IF v_required_permission = 'documents.sop.validate'
           AND v_target_type = 'task'
           AND v_target_permission = 'documents.sop.approve' THEN
            IF v_revision_status <> 'Validation' THEN
                RAISE EXCEPTION 'SOP revision must be in Validation before approval';
            END IF;
            UPDATE public.sop_revisions
            SET status = 'Approval'
            WHERE id = v_source_revision_id AND status = 'Validation';
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Could not move SOP revision to Approval';
            END IF;
            UPDATE public.sop_documents
            SET updated_at = pg_catalog.now()
            WHERE id = v_source_document_id;
            INSERT INTO public.workflow_history(instance_id, task_id, event_type, actor_id, details)
            VALUES (
                v_instance_id, p_task_id, 'sop_status_changed', auth.uid(),
                pg_catalog.jsonb_build_object(
                    'revision_id', v_source_revision_id,
                    'from_status', 'Validation',
                    'to_status', 'Approval'
                )
            );
        END IF;

        IF v_target_type = 'end' THEN
            IF v_required_permission <> 'documents.sop.approve' THEN
                RAISE EXCEPTION 'An SOP workflow can end only after a task requiring documents.sop.approve';
            END IF;
            IF v_revision_status <> 'Approval' THEN
                RAISE EXCEPTION 'SOP revision must be in Approval before release';
            END IF;

            -- Refuse partial or inconsistent numbering rather than silently creating a mismatch.
            IF (v_existing_sop_number IS NULL) <> (v_existing_sop_code IS NULL) THEN
                RAISE EXCEPTION 'SOP code and number are inconsistent; reconcile them before release';
            END IF;

            IF v_existing_sop_number IS NULL THEN
                IF NULLIF(pg_catalog.btrim(v_workshop_code), '') IS NULL THEN
                    RAISE EXCEPTION 'Workshop code is required to assign an SOP code';
                END IF;

                -- Create a counter if missing, then serialize allocations for this workshop.
                INSERT INTO public.sop_counters(workshop_id, next_number, updated_at)
                VALUES (v_workshop_id, 1, pg_catalog.now())
                ON CONFLICT (workshop_id) DO NOTHING;

                SELECT c.next_number
                INTO v_next_sop_number
                FROM public.sop_counters c
                WHERE c.workshop_id = v_workshop_id
                FOR UPDATE;

                SELECT COALESCE(MAX(sd.sop_number), 0) + 1
                INTO v_max_sop_number
                FROM public.sop_documents sd
                WHERE sd.workshop_id = v_workshop_id;

                v_next_sop_number := GREATEST(v_next_sop_number, v_max_sop_number);

                UPDATE public.sop_counters
                SET next_number = v_next_sop_number + 1, updated_at = pg_catalog.now()
                WHERE workshop_id = v_workshop_id;

                UPDATE public.sop_documents
                SET sop_number = v_next_sop_number,
                    sop_code = v_workshop_code || '-' || pg_catalog.lpad(v_next_sop_number::text, GREATEST(4, pg_catalog.length(v_next_sop_number::text)), '0'),
                    updated_at = pg_catalog.now()
                WHERE id = v_source_document_id
                  AND sop_number IS NULL
                  AND sop_code IS NULL;

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Could not assign the official SOP code';
                END IF;

                INSERT INTO public.workflow_history(instance_id, task_id, event_type, actor_id, details)
                VALUES (
                    v_instance_id, p_task_id, 'sop_code_assigned', auth.uid(),
                    pg_catalog.jsonb_build_object(
                        'workshop_id', v_workshop_id,
                        'sop_number', v_next_sop_number,
                        'sop_code', v_workshop_code || '-' || pg_catalog.lpad(v_next_sop_number::text, GREATEST(4, pg_catalog.length(v_next_sop_number::text)), '0')
                    )
                );
            END IF;

            UPDATE public.sop_revisions
            SET status = 'Obsolete'
            WHERE sop_id = v_source_document_id
              AND status = 'Released'
              AND id <> v_source_revision_id;

            UPDATE public.sop_revisions
            SET status = 'Released', released_at = pg_catalog.now()
            WHERE id = v_source_revision_id
              AND sop_id = v_source_document_id
              AND status = 'Approval';

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Could not release SOP revision';
            END IF;

            UPDATE public.sop_documents
            SET updated_at = pg_catalog.now()
            WHERE id = v_source_document_id;

            INSERT INTO public.workflow_history(instance_id, task_id, event_type, actor_id, details)
            VALUES (
                v_instance_id, p_task_id, 'sop_status_changed', auth.uid(),
                pg_catalog.jsonb_build_object(
                    'revision_id', v_source_revision_id,
                    'from_status', 'Approval',
                    'to_status', 'Released'
                )
            );
        END IF;
    END IF;

    UPDATE public.workflow_tasks
    SET status = 'completed',
        completed_at = pg_catalog.now(),
        result = COALESCE(p_result, '{}'::jsonb)
    WHERE id = p_task_id;

    INSERT INTO public.workflow_history(instance_id, task_id, event_type, from_status, to_status, actor_id, details)
    VALUES (
        v_instance_id, p_task_id, 'task_completed', v_task_status, 'completed', auth.uid(),
        pg_catalog.jsonb_build_object(
            'result', COALESCE(p_result, '{}'::jsonb),
            'transition_key', p_transition_key,
            'next_node_id', v_target_node_id
        )
    );

    UPDATE public.workflow_instances
    SET current_node_id = v_target_node_id
    WHERE id = v_instance_id;

    IF v_target_type = 'task' THEN
        INSERT INTO public.workflow_tasks(instance_id, node_id, title, instructions, status, created_by)
        SELECT v_instance_id, n.id, n.label, n.config->>'instructions', 'pending', auth.uid()
        FROM public.workflow_nodes n
        WHERE n.id = v_target_node_id AND n.version_id = v_version_id
        RETURNING id INTO v_next_task_id;

        INSERT INTO public.workflow_history(instance_id, task_id, event_type, from_status, to_status, actor_id, details)
        VALUES (
            v_instance_id, v_next_task_id, 'task_created', NULL, 'pending', auth.uid(),
            pg_catalog.jsonb_build_object('node_id', v_target_node_id)
        );
    ELSIF v_target_type = 'end' THEN
        v_new_instance_status := 'completed';
        UPDATE public.workflow_instances
        SET status = 'completed', completed_at = pg_catalog.now()
        WHERE id = v_instance_id;

        INSERT INTO public.workflow_history(instance_id, event_type, from_status, to_status, actor_id, details)
        VALUES (
            v_instance_id, 'workflow_completed', 'in_progress', 'completed', auth.uid(),
            pg_catalog.jsonb_build_object('node_id', v_target_node_id)
        );
    END IF;

    RETURN pg_catalog.jsonb_build_object(
        'instance_id', v_instance_id,
        'completed_task_id', p_task_id,
        'next_task_id', v_next_task_id,
        'current_node_id', v_target_node_id,
        'instance_status', v_new_instance_status,
        'transition_label', v_transition_label
    );
END;
$function$;

-- Keep the existing authenticated EXECUTE grant and function ownership unchanged.
