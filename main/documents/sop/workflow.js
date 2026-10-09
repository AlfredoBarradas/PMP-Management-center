document.addEventListener("DOMContentLoaded", async () => {
    const validationBody = document.getElementById("sop-validation-body");
    const approvalBody = document.getElementById("sop-approval-body");
    const workflowBody = document.getElementById("sop-workflow-body");
    if (!validationBody || !approvalBody || !workflowBody) { console.warn("Workflow UI elements are missing.", {validationBody:!!validationBody, approvalBody:!!approvalBody, workflowBody:!!workflowBody}); return; }
    const escapeText = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
    const dateText = value => value ? new Date(value).toLocaleDateString() : "";
    const message = (body, count, text) => { body.innerHTML = '<tr><td colspan="' + count + '">' + escapeText(text) + '</td></tr>'; };
    message(validationBody, 7, "Loading validation tasks...");
    message(approvalBody, 7, "Loading approval tasks...");
    message(workflowBody, 6, "Loading active workflows...");
    try {
        const { data: instances, error: instanceError } = await supabaseClient.from("workflow_instances").select("*").in("status", ["active", "in_progress", "pending"]);
        if (instanceError) throw instanceError;
        const active = instances || [];
        if (!active.length) {
            document.getElementById("pending-validation-count").textContent = "0";
            document.getElementById("pending-approval-count").textContent = "0";
            message(validationBody, 7, "No pending validation tasks.");
            message(approvalBody, 7, "No pending approval tasks.");
            message(workflowBody, 6, "No active workflows.");
            return;
        }
        const ids = active.map(row => row.id);
        const [taskResult, nodeResult] = await Promise.all([
            supabaseClient.from("workflow_tasks").select("*").in("instance_id", ids),
            supabaseClient.from("workflow_nodes").select("*")
        ]);
        if (taskResult.error) throw taskResult.error;
        if (nodeResult.error) throw nodeResult.error;
        const tasks = taskResult.data || [];
        const nodeMap = new Map((nodeResult.data || []).map(row => [String(row.id), row]));
        const pending = tasks.filter(row => ["pending", "assigned", "in_progress"].includes(String(row.status || "").toLowerCase()));
        const docIds = [...new Set(active.map(row => row.source_document_id ?? row.document_id).filter(value => value !== null && value !== undefined))];
        const revisionIds = [...new Set(active.map(row => row.source_revision_id ?? row.revision_id).filter(value => value !== null && value !== undefined))];
        const [docResult, revisionResult, assigneeResult] = await Promise.all([
            docIds.length ? supabaseClient.from("sop_documents").select("id,sop_code,part_number,operation_name,created_by").in("id", docIds) : Promise.resolve({data:[],error:null}),
            revisionIds.length ? supabaseClient.from("sop_revisions").select("id,sop_id,revision_code,status,created_at,created_by").in("id", revisionIds) : Promise.resolve({data:[],error:null}),
            pending.length ? supabaseClient.from("workflow_task_assignees").select("*").in("task_id", pending.map(row => row.id)) : Promise.resolve({data:[],error:null})
        ]);
        if (docResult.error) throw docResult.error;
        if (revisionResult.error) throw revisionResult.error;
        if (assigneeResult.error) throw assigneeResult.error;
        const docMap = new Map((docResult.data || []).map(row => [String(row.id), row]));
        const revisionMap = new Map((revisionResult.data || []).map(row => [String(row.id), row]));
        const assignees = assigneeResult.data || [];
        const rows = active.map(instance => {
            const task = pending.find(row => String(row.instance_id) === String(instance.id));
            const node = task ? nodeMap.get(String(task.node_id)) : nodeMap.get(String(instance.current_node_id));
            const documentId = instance.source_document_id ?? instance.document_id;
            const revisionId = instance.source_revision_id ?? instance.revision_id;
            const revision = revisionMap.get(String(revisionId));
            const doc = docMap.get(String(documentId));
            const rawStage = [node?.name, node?.label, node?.code, node?.node_type, instance.current_stage, revision?.status].find(value => value && /validat|approv|draft|release|reject|start|end/i.test(String(value)));
            let stage = String(rawStage || node?.name || node?.label || node?.code || revision?.status || "Workflow").replaceAll("_", " ").replaceAll("-", " ");
            if (/validat/i.test(stage)) stage = "Validation";
            else if (/approv/i.test(stage)) stage = "Approval";
            else if (/draft/i.test(stage)) stage = "Draft";
            else if (/release/i.test(stage)) stage = "Released";
            const taskAssignees = task ? assignees.filter(item => String(item.task_id) === String(task.id)) : [];
            const assigneeText = taskAssignees.map(item => item.full_name || item.display_name || item.email || item.user_id || item.assignee_id).filter(Boolean).join(", ");
            return {instance, task, stage, revision, doc, assigneeText: assigneeText || (task ? "Assigned task" : "No pending task")};
        });
        const validation = rows.filter(row => row.task && row.stage.toLowerCase().includes("validat"));
        const approval = rows.filter(row => row.task && row.stage.toLowerCase().includes("approv"));
        document.getElementById("pending-validation-count").textContent = String(validation.length);
        document.getElementById("pending-approval-count").textContent = String(approval.length);
        const renderQueue = (body, list, stage) => {
            if (!list.length) { message(body, 7, "No pending " + stage + " tasks."); return; }
            body.innerHTML = list.map(row => '<tr><td>' + escapeText(row.doc?.sop_code || "SOP") + ' (' + escapeText(row.revision?.revision_code || "") + ')</td><td>' + escapeText(row.doc?.part_number || "") + '</td><td>' + escapeText(row.doc?.created_by || row.revision?.created_by || "") + '</td><td>' + escapeText(row.assigneeText) + '</td><td>' + escapeText(dateText(row.task?.created_at || row.instance.created_at)) + '</td><td>' + escapeText(row.task?.status || "Pending") + '</td><td><button type="button" class="secondary-button workflow-detail-button" data-instance-id="' + escapeText(row.instance.id) + '">Review</button></td></tr>').join("");
        };
        renderQueue(validationBody, validation, "validation");
        renderQueue(approvalBody, approval, "approval");
        workflowBody.innerHTML = rows.map(row => '<tr><td>' + escapeText(row.doc?.sop_code || "Unknown SOP") + ' (' + escapeText(row.revision?.revision_code || "") + ')</td><td>' + escapeText(row.stage) + '</td><td>' + escapeText(row.assigneeText) + '</td><td>' + escapeText(dateText(row.task?.created_at || row.instance.created_at)) + '</td><td>' + escapeText(row.task?.status || row.instance.status || "") + '</td><td><button type="button" class="primary-button workflow-detail-button" data-instance-id="' + escapeText(row.instance.id) + '">View Flow</button></td></tr>').join("");
    } catch (error) {
        console.error("Unable to load SOP workflow data:", error);
        message(validationBody, 7, "Unable to load tasks. Check Supabase policies and the browser console.");
        message(approvalBody, 7, "Unable to load tasks. Check Supabase policies and the browser console.");
        message(workflowBody, 6, "Unable to load workflow. Check Supabase policies and the browser console.");
    }
    document.addEventListener("click", async event => {
        const button = event.target.closest(".workflow-detail-button");
        if (!button) return;
        const instanceId = button.dataset.instanceId;
        const detail = document.querySelector(".sop-modal-body");
        detail.innerHTML = "<p>Loading workflow details...</p>";
        document.getElementById("sop-modal").classList.remove("hidden");
        try {
            const { data: instance, error: instanceError } = await supabaseClient.from("workflow_instances").select("*").eq("id", instanceId).single();
            if (instanceError) throw instanceError;
            const [{ data: tasks, error: taskError }, { data: history, error: historyError }] = await Promise.all([
                supabaseClient.from("workflow_tasks").select("*").eq("instance_id", instanceId).order("created_at", {ascending:true}),
                supabaseClient.from("workflow_history").select("*").eq("instance_id", instanceId).order("created_at", {ascending:true})
            ]);
            if (taskError) throw taskError;
            if (historyError) throw historyError;
            const taskRows = tasks || [];
            const taskIds = taskRows.map(task => task.id);
            const assignmentResult = taskIds.length ? await supabaseClient.from("workflow_task_assignees").select("*").in("task_id", taskIds) : {data:[],error:null};
            if (assignmentResult.error) throw assignmentResult.error;
            const assignments = assignmentResult.data || [];
            const userIds = [...new Set(assignments.map(item => item.user_id).filter(Boolean))];
            const profileResult = userIds.length ? await supabaseClient.from("user_profiles").select("id,full_name").in("id", userIds) : {data:[],error:null};
            if (profileResult.error) throw profileResult.error;
            const profiles = new Map((profileResult.data || []).map(profile => [String(profile.id), profile.full_name]));
            const {data:userData} = await supabaseClient.auth.getUser();
            const userId = userData?.user?.id;
            const pendingTask = taskRows.find(task => ["pending","assigned","in_progress"].includes(String(task.status || "").toLowerCase()));
            const pendingAssignments = pendingTask ? assignments.filter(item => String(item.task_id) === String(pendingTask.id)) : [];
            const assignedToUser = pendingAssignments.some(item => String(item.user_id) === String(userId));
            const nodeResult = pendingTask ? await supabaseClient.from("workflow_nodes").select("*").eq("id", pendingTask.node_id).maybeSingle() : {data:null,error:null};
            if (nodeResult.error) throw nodeResult.error;
            const nodeText = String(nodeResult.data?.name || nodeResult.data?.node_type || "").toLowerCase();
            const stage = nodeText.includes("approv") ? "approval" : "validation";
            const permission = stage === "approval" ? "documents.sop.approve" : "documents.sop.validate";
            const canAct = Boolean(pendingTask && assignedToUser && hasPermission(permission));
            const taskHtml = taskRows.map(task => {
                const names = assignments.filter(item => String(item.task_id) === String(task.id)).map(item => profiles.get(String(item.user_id)) || item.user_id || "Unassigned").join(", ");
                return "<tr><td>" + escapeText(task.name || task.node_id || ("Task #" + task.id)) + "</td><td>" + escapeText(task.status || "") + "</td><td>" + escapeText(names || "Unassigned") + "</td><td>" + escapeText(dateText(task.created_at)) + "</td></tr>";
            }).join("");
            const historyHtml = (history || []).map(item => "<li>" + escapeText(item.action || item.event_type || item.description || "Workflow event") + " · " + escapeText(dateText(item.created_at)) + "</li>").join("");
            detail.innerHTML = "<h3>Workflow #" + escapeText(instanceId) + "</h3><p><strong>Instance status:</strong> " + escapeText(instance.status || "") + "</p><h4>Tasks</h4><div class='catalog-table'><table><thead><tr><th>Task</th><th>Status</th><th>Assigned To</th><th>Created</th></tr></thead><tbody>" + (taskHtml || "<tr><td colspan='4'>No tasks found.</td></tr>") + "</tbody></table></div><h4>History</h4><ul>" + (historyHtml || "<li>No history available.</li>") + "</ul>" + (pendingTask ? "<div class='sop-revision-section'><label for='workflow-task-comment'>Comments</label><textarea id='workflow-task-comment' rows='3' placeholder='Optional review comments'></textarea></div>" : "") + (canAct ? "<div class='sop-modal-actions'><button type='button' class='danger-button' id='workflow-reject-task' data-task-id='" + escapeText(pendingTask.id) + "'>Reject and return to Draft</button><button type='button' class='primary-button' id='workflow-complete-task' data-task-id='" + escapeText(pendingTask.id) + "' data-stage='" + stage + "'>Complete " + (stage === "approval" ? "Approval" : "Validation") + "</button></div>" : pendingTask ? "<p>You can review this task, but actions require the task to be assigned to your account and the corresponding permission.</p>" : "");
        } catch (error) {
            console.error("Unable to load workflow details:", error);
            detail.innerHTML = "<p>Unable to load workflow details. Check table access policies.</p>";
        }
    });
    document.addEventListener("click", async event => {
        const completeButton = event.target.closest("#workflow-complete-task");
        const rejectButton = event.target.closest("#workflow-reject-task");
        if (!completeButton && !rejectButton) return;
        const button = completeButton || rejectButton;
        const taskId = Number(button.dataset.taskId);
        const comment = document.getElementById("workflow-task-comment")?.value?.trim() || null;
        const isReject = Boolean(rejectButton);
        if (isReject && !confirm("Reject this task and return the SOP revision to Draft?")) return;
        button.disabled = true;
        try {
            const rpcName = isReject ? "workflow_reject_task" : "workflow_complete_task";
            const {error} = await supabaseClient.rpc(rpcName, {p_task_id:taskId,p_comment:comment});
            if (error) throw error;
            alert(isReject ? "Task rejected. The SOP revision was returned to Draft." : "Workflow task completed successfully.");
            document.getElementById("sop-modal").classList.add("hidden");
            window.location.reload();
        } catch (error) {
            console.error("Workflow action failed:", error);
            alert("The workflow action failed: " + (error.message || "Check permissions and RPC parameters."));
            button.disabled = false;
        }
    });
});
