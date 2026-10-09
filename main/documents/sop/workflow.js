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
        const id = button.dataset.instanceId;
        const { data, error } = await supabaseClient.from("workflow_instances").select("*").eq("id", id).single();
        if (error) { alert("Unable to load workflow details. See console."); console.error(error); return; }
        const { data: tasks, error: taskError } = await supabaseClient.from("workflow_tasks").select("*").eq("instance_id", id).order("created_at", {ascending:true});
        const { data: history, error: historyError } = await supabaseClient.from("workflow_history").select("*").eq("instance_id", id).order("created_at", {ascending:true});
        if (taskError || historyError) { alert("Unable to load workflow task history. Check table policies."); console.error(taskError || historyError); return; }
        const detail = document.querySelector(".sop-modal-body");
        detail.innerHTML = "<h3>Workflow #" + escapeText(id) + "</h3><p><strong>Status:</strong> " + escapeText(data.status || "") + "</p><h4>Tasks</h4>" + ((tasks || []).map(task => "<p>Task #" + escapeText(task.id) + " · " + escapeText(task.status || "") + " · " + escapeText(dateText(task.created_at)) + "</p>").join("") || "<p>No tasks.</p>") + "<h4>History</h4>" + ((history || []).map(item => "<p>" + escapeText(item.action || item.event_type || item.description || "Workflow event") + " · " + escapeText(dateText(item.created_at)) + "</p>").join("") || "<p>No history available.</p>");
        document.getElementById("sop-modal").classList.remove("hidden");
    });
});
