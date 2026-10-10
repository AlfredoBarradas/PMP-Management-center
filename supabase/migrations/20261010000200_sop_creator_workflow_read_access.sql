-- Read-only access to the creator's own SOP and its workflow traceability.
-- SECURITY DEFINER helpers return booleans only; they do not expose profile or document rows.
CREATE OR REPLACE FUNCTION public.can_view_own_sop(p_sop_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.sop_documents sd
        WHERE sd.id = p_sop_id AND sd.created_by = (SELECT auth.uid())
    );
$function$;

CREATE OR REPLACE FUNCTION public.can_view_own_sop_workflow(p_instance_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.workflow_instances wi
        JOIN public.sop_documents sd ON sd.id = wi.source_document_id
        WHERE wi.id = p_instance_id
          AND wi.document_type_code = 'sop'
          AND sd.created_by = (SELECT auth.uid())
    );
$function$;

REVOKE ALL ON FUNCTION public.can_view_own_sop(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_own_sop_workflow(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_own_sop(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_own_sop_workflow(bigint) TO authenticated;

DROP POLICY IF EXISTS "Authenticated users with SOP view permission can read documents" ON public.sop_documents;
CREATE POLICY "SOP viewers and creators can read documents"
ON public.sop_documents FOR SELECT TO authenticated
USING (public.has_permission('documents.sop.view') OR created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Authenticated users with SOP view permission can read revisions" ON public.sop_revisions;
CREATE POLICY "SOP viewers and creators can read revisions"
ON public.sop_revisions FOR SELECT TO authenticated
USING (
    public.has_permission('documents.sop.view')
    OR public.can_view_own_sop(sop_id)
);

DROP POLICY IF EXISTS "Authenticated users with SOP view permission can read workflow " ON public.sop_workflow_history;
CREATE POLICY "SOP viewers and creators can read SOP workflow history"
ON public.sop_workflow_history FOR SELECT TO authenticated
USING (
    public.has_permission('documents.sop.view')
    OR public.can_view_own_sop(sop_id)
);

DROP POLICY IF EXISTS workflow_instances_select ON public.workflow_instances;
CREATE POLICY workflow_instances_select
ON public.workflow_instances FOR SELECT TO authenticated
USING (
    public.has_permission('workflow.instances.view')
    OR public.has_permission('workflow.tasks.view')
    OR public.can_view_own_sop_workflow(id)
);

DROP POLICY IF EXISTS workflow_tasks_select ON public.workflow_tasks;
CREATE POLICY workflow_tasks_select
ON public.workflow_tasks FOR SELECT TO authenticated
USING (
    public.has_permission('workflow.tasks.view')
    OR EXISTS (
        SELECT 1 FROM public.workflow_task_assignees wta
        WHERE wta.task_id = workflow_tasks.id AND wta.user_id = (SELECT auth.uid())
    )
    OR public.can_view_own_sop_workflow(instance_id)
);

DROP POLICY IF EXISTS workflow_history_select ON public.workflow_history;
CREATE POLICY workflow_history_select
ON public.workflow_history FOR SELECT TO authenticated
USING (
    public.has_permission('workflow.history.view')
    OR actor_id = (SELECT auth.uid())
    OR EXISTS (
        SELECT 1 FROM public.workflow_task_assignees wta
        WHERE wta.task_id = workflow_history.task_id AND wta.user_id = (SELECT auth.uid())
    )
    OR public.can_view_own_sop_workflow(instance_id)
);

-- These are SELECT-only changes; they grant no workflow action permissions.
