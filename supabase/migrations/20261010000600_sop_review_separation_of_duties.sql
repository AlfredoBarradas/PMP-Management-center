-- Enforce separation of duties for SOP review at the database layer.
-- A revision creator cannot perform review actions on their own revision.
-- The same user cannot both validate and approve the same revision.
-- Assigned workflow tasks can only be acted on by an assigned user.
BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_sop_review_separation_of_duties()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_document_type_code text;
    v_instance_id bigint;
    v_source_document_id bigint;
    v_source_revision_id bigint;
    v_required_permission text;
    v_revision_creator uuid;
BEGIN
    IF TG_OP <> 'UPDATE'
       OR NEW.status NOT IN ('completed', 'rejected')
       OR OLD.status IN ('completed', 'rejected') THEN
        RETURN NEW;
    END IF;

    SELECT wi.id,
           wi.document_type_code,
           wi.source_document_id,
           wi.source_revision_id,
           wn.required_permission_code
    INTO v_instance_id,
         v_document_type_code,
         v_source_document_id,
         v_source_revision_id,
         v_required_permission
    FROM public.workflow_instances AS wi
    JOIN public.workflow_nodes AS wn
      ON wn.id = NEW.node_id
     AND wn.version_id = wi.version_id
    WHERE wi.id = NEW.instance_id;

    IF v_document_type_code IS DISTINCT FROM 'sop'
       OR v_required_permission IS NULL
       OR v_required_permission NOT IN ('documents.sop.validate', 'documents.sop.approve') THEN
        RETURN NEW;
    END IF;

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required to act on a workflow task'
            USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.workflow_task_assignees AS assigned
        WHERE assigned.task_id = NEW.id
    ) AND NOT EXISTS (
        SELECT 1
        FROM public.workflow_task_assignees AS assigned
        WHERE assigned.task_id = NEW.id
          AND assigned.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Only a user assigned to this SOP workflow task can complete or reject it'
            USING ERRCODE = '42501';
    END IF;

    SELECT sr.created_by
    INTO v_revision_creator
    FROM public.sop_revisions AS sr
    WHERE sr.id = v_source_revision_id
      AND sr.sop_id = v_source_document_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'SOP revision for this review task was not found';
    END IF;

    IF auth.uid() IS NOT NULL AND v_revision_creator = auth.uid() THEN
        RAISE EXCEPTION 'Separation of duties: the revision creator cannot perform review actions on their own SOP'
            USING ERRCODE = '42501';
    END IF;

    IF v_required_permission = 'documents.sop.approve'
       AND EXISTS (
            SELECT 1
            FROM public.workflow_history AS wh
            JOIN public.workflow_tasks AS validation_task
              ON validation_task.id = wh.task_id
             AND validation_task.instance_id = wh.instance_id
            JOIN public.workflow_nodes AS validation_node
              ON validation_node.id = validation_task.node_id
             AND validation_node.version_id = (
                 SELECT wi.version_id
                 FROM public.workflow_instances AS wi
                 WHERE wi.id = v_instance_id
             )
            WHERE wh.instance_id = v_instance_id
              AND wh.event_type = 'task_completed'
              AND wh.actor_id = v_revision_creator
              AND validation_node.required_permission_code = 'documents.sop.validate'
       ) THEN
        RAISE EXCEPTION 'Separation of duties: a revision validated by its creator cannot be approved; return it to Draft and resubmit'
            USING ERRCODE = '42501';
    END IF;

    IF v_required_permission = 'documents.sop.approve'
       AND EXISTS (
            SELECT 1
            FROM public.workflow_history AS wh
            JOIN public.workflow_tasks AS validation_task
              ON validation_task.id = wh.task_id
             AND validation_task.instance_id = wh.instance_id
            JOIN public.workflow_nodes AS validation_node
              ON validation_node.id = validation_task.node_id
             AND validation_node.version_id = (
                 SELECT wi.version_id
                 FROM public.workflow_instances AS wi
                 WHERE wi.id = v_instance_id
             )
            WHERE wh.instance_id = v_instance_id
              AND wh.event_type = 'task_completed'
              AND wh.actor_id = auth.uid()
              AND validation_node.required_permission_code = 'documents.sop.validate'
       ) THEN
        RAISE EXCEPTION 'Separation of duties: the validator cannot approve the same SOP revision'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sop_review_separation_of_duties ON public.workflow_tasks;
CREATE TRIGGER trg_sop_review_separation_of_duties
BEFORE UPDATE OF status ON public.workflow_tasks
FOR EACH ROW
EXECUTE FUNCTION public.enforce_sop_review_separation_of_duties();

REVOKE ALL ON FUNCTION public.enforce_sop_review_separation_of_duties() FROM PUBLIC, anon, authenticated;


-- A Draft can only be submitted by its own revision creator.
-- This guards the state transition even if the workflow RPC is called directly.
CREATE OR REPLACE FUNCTION public.enforce_sop_revision_submission_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD.status = 'Draft'
       AND NEW.status = 'Validation' THEN
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'Authentication required to submit an SOP revision'
                USING ERRCODE = '42501';
        END IF;
        IF NEW.created_by IS DISTINCT FROM auth.uid() THEN
            RAISE EXCEPTION 'Only the creator of this Draft revision can submit it for validation'
                USING ERRCODE = '42501';
        END IF;
        IF NOT public.has_permission('workflow.instances.start') THEN
            RAISE EXCEPTION 'Missing permission: workflow.instances.start'
                USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sop_revision_submission_owner ON public.sop_revisions;
CREATE TRIGGER trg_sop_revision_submission_owner
BEFORE UPDATE OF status ON public.sop_revisions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_sop_revision_submission_owner();

REVOKE ALL ON FUNCTION public.enforce_sop_revision_submission_owner() FROM PUBLIC, anon, authenticated;

COMMIT;
