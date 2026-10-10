-- Keep the SOP creation capability aligned with the submit action.
-- Any role allowed to create SOPs can also start the SOP workflow.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT create_rp.role_id, start_permission.id
FROM public.role_permissions AS create_rp
JOIN public.permissions AS create_permission
  ON create_permission.id = create_rp.permission_id
 AND create_permission.code = 'documents.sop.create'
JOIN public.permissions AS start_permission
  ON start_permission.code = 'workflow.instances.start'
ON CONFLICT (role_id, permission_id) DO NOTHING;
