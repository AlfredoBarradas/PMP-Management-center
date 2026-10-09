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
        const revIds = [...new Set(active.map(row => row.revision_id).filter(Boolean))];
        const docIds = [...new Set(active.map(row => row.document_id).filter(Boolean))];
        const [revs, docs] = await Promise.all([
            revIds.length ? supabaseClient.from("sop_revisions").select("id,revision_code,status,created_at,created_by").in("id", revIds) : Promise.resolve({data:[],error:null}),
            docIds.length ? supabaseClient.from("sop_documents").select("id,sop_code,part_number,operation_name,created_by").in("id", docIds) : Promise.resolve({data:[],error:null})
        ]);
        if (revs.error) throw revs.error;
        if (docs.error) throw docs.error;
        const revMap = new Map((revs.data || []).map(row => [String(row.id), row]));
        const docMap = new Map((docs.data || []).map(row => [String(row.id), row]));
        const rows = active.map(instance => {
            const task = pending.find(row => String(row.instance_id) === String(instance.id));
            const node = task ? nodeMap.get(String(task.node_id)) : nodeMap.get(String(instance.current_node_id));
            const stage = String(node?.name || node?.node_type || instance.current_stage || "Workflow").replaceAll("_", " ");
            return {instance, task, stage, revision:revMap.get(String(instance.revision_id)), doc:docMap.get(String(instance.document_id))};
        });
        const validation = rows.filter(row => row.task && row.stage.toLowerCase().includes("validat"));
        const approval = rows.filter(row => row.task && row.stage.toLowerCase().includes("approv"));
        document.getElementById("pending-validation-count").textContent = String(validation.length);
        document.getElementById("pending-approval-count").textContent = String(approval.length);
        const renderQueue = (body, list, stage) => {
            if (!list.length) { message(body, 7, "No pending " + stage + " tasks."); return; }
            body.innerHTML = list.map(row => '<tr><td>' + escapeText(row.doc?.sop_code || "SOP") + '</td><td>' + escapeText(row.doc?.part_number || "") + '</td><td>' + escapeText(row.doc?.created_by || row.revision?.created_by || "") + '</td><td>Workflow task</td><td>' + escapeText(dateText(row.task?.created_at || row.instance.created_at)) + '</td><td>' + escapeText(row.task?.status || "Pending") + '</td><td><button type="button" class="secondary-button workflow-detail-button" data-instance-id="' + escapeText(row.instance.id) + '">Review</button></td></tr>').join("");
        };
        renderQueue(validationBody, validation, "validation");
        renderQueue(approvalBody, approval, "approval");
        workflowBody.innerHTML = rows.map(row => '<tr><td>' + escapeText(row.doc?.sop_code || "SOP") + '</td><td>' + escapeText(row.stage) + '</td><td>' + escapeText(row.task ? "Task pending" : "No pending task") + '</td><td>' + escapeText(dateText(row.task?.created_at || row.instance.created_at)) + '</td><td>' + escapeText(row.task?.status || row.instance.status || "") + '</td><td><button type="button" class="primary-button workflow-detail-button" data-instance-id="' + escapeText(row.instance.id) + '">View Flow</button></td></tr>').join("");
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
