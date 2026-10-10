-- Resolve names only for people connected to SOP workflows the caller may read.
-- This avoids granting broad SELECT access to user_profiles.
CREATE OR REPLACE FUNCTION public.get_sop_workflow_people(p_instance_ids bigint[])
RETURNS TABLE(workflow_id bigint, user_id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
    WITH visible_instances AS (
        SELECT wi.id, wi.source_document_id, wi.source_revision_id, wi.started_by
        FROM public.workflow_instances wi
        WHERE wi.document_type_code = 'sop'
          AND wi.id = ANY(COALESCE(p_instance_ids, ARRAY[]::bigint[]))
          AND (
              public.has_permission('workflow.history.view')
              OR public.has_permission('workflow.instances.view')
              OR public.has_permission('workflow.tasks.view')
              OR public.can_view_own_sop_workflow(wi.id)
              OR EXISTS (
                  SELECT 1
                  FROM public.workflow_tasks assigned_task
                  JOIN public.workflow_task_assignees assigned
                    ON assigned.task_id = assigned_task.id
                  WHERE assigned_task.instance_id = wi.id
                    AND assigned.user_id = (SELECT auth.uid())
              )
          )
    ),
    people AS (
        SELECT vi.id AS workflow_id, sd.created_by AS user_id
        FROM visible_instances vi
        JOIN public.sop_documents sd ON sd.id = vi.source_document_id
        UNION
        SELECT vi.id, sr.created_by
        FROM visible_instances vi
        JOIN public.sop_revisions sr ON sr.id = vi.source_revision_id
        UNION
        SELECT vi.id, vi.started_by
        FROM visible_instances vi
        UNION
        SELECT vi.id, wt.created_by
        FROM visible_instances vi
        JOIN public.workflow_tasks wt ON wt.instance_id = vi.id
        UNION
        SELECT vi.id, wta.user_id
        FROM visible_instances vi
        JOIN public.workflow_tasks wt ON wt.instance_id = vi.id
        JOIN public.workflow_task_assignees wta ON wta.task_id = wt.id
        UNION
        SELECT vi.id, wh.actor_id
        FROM visible_instances vi
        JOIN public.workflow_history wh ON wh.instance_id = vi.id
    )
    SELECT DISTINCT people.workflow_id, people.user_id, up.full_name
    FROM people
    JOIN public.user_profiles up ON up.id = people.user_id
    WHERE people.user_id IS NOT NULL;
$function$;

REVOKE ALL ON FUNCTION public.get_sop_workflow_people(bigint[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sop_workflow_people(bigint[]) TO authenticated;
