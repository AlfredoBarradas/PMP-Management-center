document.addEventListener("DOMContentLoaded", async () => {
    const validationBody = document.getElementById("sop-validation-body");
    const approvalBody = document.getElementById("sop-approval-body");
    const workflowBody = document.getElementById("sop-workflow-body");
    if (!validationBody || !approvalBody || !workflowBody) return;
    const escapeText = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
    const dateText = value => value ? new Date(value).toLocaleString([], {dateStyle:"medium",timeStyle:"short"}) : "—";
    const labelText = value => ({in_progress:"In Progress",active:"In Progress",pending:"Pending",completed:"Completed",rejected:"Rejected",obsolete:"Obsolete",validation:"Validation",approval:"Approval",released:"Released",draft:"Draft",task_created:"Task created",task_completed:"Task completed",task_rejected:"Task rejected",workflow_started:"Workflow submitted",workflow_completed:"Workflow released",workflow_rejected:"Workflow rejected",sop_status_changed:"SOP status changed"}[String(value||"").toLowerCase()] || String(value||"").replaceAll("_"," ").replaceAll("-"," ").replace(/\b\w/g, char=>char.toUpperCase()));
    const dateDuration = (start,end) => {
        if (!start) return "—";
        const ms = Math.max(0, new Date(end || Date.now()) - new Date(start));
        const days = Math.floor(ms/86400000), hours = Math.floor(ms%86400000/3600000), mins = Math.floor(ms%3600000/60000);
        return days ? days+"d "+hours+"h" : hours ? hours+"h "+mins+"m" : mins+"m";
    };
    const message = (body, count, text) => { body.innerHTML = '<tr><td colspan="'+count+'">'+escapeText(text)+'</td></tr>'; };
    const pendingStatuses = ["pending","assigned","in_progress"];
    message(validationBody,9,"Loading validation tasks...");
    message(approvalBody,9,"Loading approval tasks...");
    message(workflowBody,10,"Loading SOP workflow history...");
    try {
        const {data: instances,error: instanceError}=await supabaseClient.from("workflow_instances").select("*").eq("document_type_code","sop").order("started_at",{ascending:false});
        if(instanceError) throw instanceError;
        const allInstances=instances||[];
        const active=allInstances.filter(row=>["active","in_progress","pending"].includes(String(row.status||"").toLowerCase()));
        const ids=allInstances.map(row=>row.id);
        const [taskResult,nodeResult]=await Promise.all([
            ids.length ? supabaseClient.from("workflow_tasks").select("*").in("instance_id",ids).order("created_at",{ascending:true}) : Promise.resolve({data:[],error:null}),
            supabaseClient.from("workflow_nodes").select("id,version_id,label,node_type,required_permission_code")
        ]);
        if(taskResult.error) throw taskResult.error;
        if(nodeResult.error) throw nodeResult.error;
        const tasks=taskResult.data||[];
        const nodeMap=new Map((nodeResult.data||[]).map(row=>[String(row.id),row]));
        const docIds=[...new Set(allInstances.map(row=>row.source_document_id).filter(Boolean))];
        const revisionIds=[...new Set(allInstances.map(row=>row.source_revision_id).filter(Boolean))];
        const [docResult,revisionResult,assignmentResult]=await Promise.all([
            docIds.length ? supabaseClient.from("sop_documents").select("id,sop_code,sop_number,part_number,operation_name,created_by,model_id,part_name_id,workshop_id,process_area_id").in("id",docIds) : Promise.resolve({data:[],error:null}),
            revisionIds.length ? supabaseClient.from("sop_revisions").select("id,sop_id,revision_code,status,created_at,created_by,released_at,description").in("id",revisionIds) : Promise.resolve({data:[],error:null}),
            tasks.length ? supabaseClient.from("workflow_task_assignees").select("task_id,user_id").in("task_id",tasks.map(row=>row.id)) : Promise.resolve({data:[],error:null})
        ]);
        if(docResult.error) throw docResult.error;
        if(revisionResult.error) throw revisionResult.error;
        if(assignmentResult.error) throw assignmentResult.error;
        const docs=docResult.data||[], revisions=revisionResult.data||[], assignments=assignmentResult.data||[];
        const modelIds=[...new Set(docs.map(row=>row.model_id).filter(Boolean))], partNameIds=[...new Set(docs.map(row=>row.part_name_id).filter(Boolean))], workshopIds=[...new Set(docs.map(row=>row.workshop_id).filter(Boolean))], processAreaIds=[...new Set(docs.map(row=>row.process_area_id).filter(Boolean))];
        const [modelsResult,partNamesResult,workshopsResult,processAreasResult]=await Promise.all([
            modelIds.length ? supabaseClient.from("models").select("id,name").in("id",modelIds) : Promise.resolve({data:[],error:null}),
            partNameIds.length ? supabaseClient.from("part_names").select("id,name").in("id",partNameIds) : Promise.resolve({data:[],error:null}),
            workshopIds.length ? supabaseClient.from("workshops").select("id,name").in("id",workshopIds) : Promise.resolve({data:[],error:null}),
            processAreaIds.length ? supabaseClient.from("process_areas").select("id,name").in("id",processAreaIds) : Promise.resolve({data:[],error:null})
        ]);
        if(modelsResult.error) throw modelsResult.error;
        if(partNamesResult.error) throw partNamesResult.error;
        if(workshopsResult.error) throw workshopsResult.error;
        if(processAreasResult.error) throw processAreasResult.error;
        const docMap=new Map(docs.map(row=>[String(row.id),row])), revisionMap=new Map(revisions.map(row=>[String(row.id),row]));
        const modelMap=new Map((modelsResult.data||[]).map(row=>[String(row.id),row.name]));
        const partNameMap=new Map((partNamesResult.data||[]).map(row=>[String(row.id),row.name]));
        const workshopMap=new Map((workshopsResult.data||[]).map(row=>[String(row.id),row.name]));
        const processAreaMap=new Map((processAreasResult.data||[]).map(row=>[String(row.id),row.name]));
        const peopleResult=ids.length ? await supabaseClient.rpc("get_sop_workflow_people",{p_instance_ids:ids}) : {data:[],error:null};
        if(peopleResult.error) throw peopleResult.error;
        const peopleRows=peopleResult.data||[];
        const profileMap=new Map(peopleRows.map(row=>[String(row.user_id),row.full_name]));
        const profileIds=[...new Set([...peopleRows.map(row=>row.user_id),...docs.map(row=>row.created_by),...revisions.map(row=>row.created_by)].filter(Boolean).map(String))];
        const profilesResult=profileIds.length?await supabaseClient.from("user_profiles").select("id,role_id,roles(name)").in("id",profileIds):{data:[],error:null};
        if(profilesResult.error) console.warn("Workflow role names unavailable:",profilesResult.error);
        const roleMap=new Map((profilesResult.data||[]).map(profile=>[String(profile.id),profile.roles?.name||""]));
        const taskFor=instance=>tasks.filter(task=>String(task.instance_id)===String(instance.id));
        const currentTask=instance=>taskFor(instance).find(task=>pendingStatuses.includes(String(task.status||"").toLowerCase()));
        const nodeFor=instance=>{const task=currentTask(instance);return nodeMap.get(String(task?.node_id ?? instance.current_node_id));};
        const stageFor=instance=>{
            const node=nodeFor(instance), revision=revisionMap.get(String(instance.source_revision_id));
            const permission=String(node?.required_permission_code||"").toLowerCase();
            if(permission==="documents.sop.validate") return "Validation";
            if(permission==="documents.sop.approve") return "Approval";
            if(instance.status==="rejected") return "Rejected";
            if(instance.status==="completed") return revision?.status==="Released" ? "Released" : labelText(revision?.status);
            return labelText(node?.label||node?.node_type||revision?.status||"Workflow");
        };
        const assigneeText=task=>{
            if(!task) return "—";
            const names=peopleRows.filter(row=>String(row.workflow_id)===String(task.instance_id)&&String(row.task_id)===String(task.id)).map(row=>profileMap.get(String(row.user_id))).filter(Boolean);
            return [...new Set(names)].join(", ") || "Unassigned";
        };
        const assigneeRoleText=task=>{
            if(!task) return "—";
            const assigned=assignments.filter(row=>String(row.task_id)===String(task.id)).map(row=>roleMap.get(String(row.user_id))).filter(Boolean);
            if(assigned.length) return [...new Set(assigned)].join(", ");
            const permission=String(nodeMap.get(String(task.node_id))?.required_permission_code||"").toLowerCase();
            if(permission==="documents.sop.validate") return "SOP Validator";
            if(permission==="documents.sop.approve") return "SOP Approver";
            return "Unassigned";
        };
        const latestBySopRevision=new Map();
        for(const instance of allInstances){const key=String(instance.source_document_id)+":"+String(instance.source_revision_id);const previous=latestBySopRevision.get(key);if(!previous||new Date(instance.started_at||0)>new Date(previous.started_at||0))latestBySopRevision.set(key,instance);}
        const rows=[...latestBySopRevision.values()].map(instance=>{
            const doc=docMap.get(String(instance.source_document_id)), revision=revisionMap.get(String(instance.source_revision_id)), task=currentTask(instance);
            return {instance,doc,revision,task,stage:stageFor(instance),assignees:assigneeText(task),assigneeRoles:assigneeRoleText(task),creator:profileMap.get(String(revision?.created_by||doc?.created_by))||"Creator profile unavailable",area:workshopMap.get(String(doc?.workshop_id))||"—",process:processAreaMap.get(String(doc?.process_area_id))||"—",model:modelMap.get(String(doc?.model_id))||"—",partName:partNameMap.get(String(doc?.part_name_id))||"—"};
        });
        const validation=rows.filter(row=>active.some(instance=>String(instance.id)===String(row.instance.id))&&row.task&&row.stage==="Validation");
        const approval=rows.filter(row=>active.some(instance=>String(instance.id)===String(row.instance.id))&&row.task&&row.stage==="Approval");
        document.getElementById("pending-validation-count").textContent=String(validation.length);
        document.getElementById("pending-approval-count").textContent=String(approval.length);
        const renderQueue=(body,list,stage)=>{
            if(!list.length){message(body,9,"No pending "+stage+" tasks.");return;}
            body.innerHTML=list.map(row=>'<tr class="catalog-clickable-row workflow-row" data-instance-id="'+escapeText(row.instance.id)+'" tabindex="0" role="button" aria-label="Review SOP '+escapeText(row.doc?.sop_code||"Unassigned")+'"><td>'+escapeText(row.area)+'</td><td>'+escapeText(row.process)+'</td><td>'+escapeText(row.model)+'</td><td>'+escapeText(row.partName)+'</td><td>'+escapeText(row.doc?.part_number||"—")+'</td><td>'+escapeText(row.doc?.operation_name||"—")+'</td><td>'+escapeText(row.creator)+'</td><td>'+escapeText(row.assigneeRoles)+'</td><td>'+escapeText(dateText(row.task?.created_at||row.instance.started_at))+'</td></tr>').join("");
        };
        renderQueue(validationBody,validation,"validation");
        renderQueue(approvalBody,approval,"approval");
        if(!rows.length){message(workflowBody,10,"No SOP workflows found.");}
        else workflowBody.innerHTML=rows.map(row=>'<tr class="catalog-clickable-row workflow-row" data-instance-id="'+escapeText(row.instance.id)+'" tabindex="0" role="button" aria-label="View workflow for '+escapeText(row.doc?.sop_code||"Unassigned")+'"><td>'+escapeText(row.area)+'</td><td>'+escapeText(row.process)+'</td><td>'+escapeText(row.model)+'</td><td>'+escapeText(row.partName)+'</td><td>'+escapeText(row.doc?.part_number||"—")+'</td><td>'+escapeText(row.doc?.operation_name||"—")+'</td><td>'+escapeText(row.creator)+'</td><td>'+escapeText(row.stage)+'</td><td>'+escapeText(row.assigneeRoles)+'</td><td><span class="status-badge status-'+escapeText(String(row.instance.status||"").toLowerCase())+'">'+escapeText(labelText(row.instance.status))+'</span></td></tr>').join("");
    } catch(error) {
        console.error("Unable to load SOP workflow data:",error);
        message(validationBody,7,"Unable to load validation tasks. See browser console for details.");
        message(approvalBody,7,"Unable to load approval tasks. See browser console for details.");
        message(workflowBody,6,"Unable to load SOP workflow history. See browser console for details.");
    }
    document.addEventListener("click",async event=>{
        const button=event.target.closest(".workflow-detail-button");
        const row=event.target.closest("tr.workflow-row[data-instance-id]");
        if(!button&&!row)return;
        if(row&&event.target.closest("button, a, input, select, textarea, label"))return;
        const instanceId=(button||row).dataset.instanceId, detail=document.querySelector(".sop-modal-body"), modal=document.getElementById("sop-modal");
        detail.innerHTML="<p>Loading workflow details...</p>"; modal.classList.remove("hidden");
        try{
            const {data:instance,error:instanceError}=await supabaseClient.from("workflow_instances").select("*").eq("id",instanceId).eq("document_type_code","sop").single();
            if(instanceError)throw instanceError;
            const {data:siblingInstances,error:siblingError}=await supabaseClient.from("workflow_instances").select("id,source_document_id,source_revision_id,started_at").eq("document_type_code","sop").eq("source_document_id",instance.source_document_id).eq("source_revision_id",instance.source_revision_id).order("started_at",{ascending:true});
            if(siblingError)throw siblingError;
            const relatedInstanceIds=(siblingInstances||[]).map(row=>row.id);
            const [{data:tasks,error:taskError},{data:history,error:historyError}]=await Promise.all([
                relatedInstanceIds.length ? supabaseClient.from("workflow_tasks").select("*").in("instance_id",relatedInstanceIds).order("created_at",{ascending:true}) : Promise.resolve({data:[],error:null}),
                relatedInstanceIds.length ? supabaseClient.from("workflow_history").select("*").in("instance_id",relatedInstanceIds).order("created_at",{ascending:true}) : Promise.resolve({data:[],error:null})
            ]);
            if(taskError)throw taskError;if(historyError)throw historyError;
            const taskRows=tasks||[], taskIds=taskRows.map(row=>row.id);
            const assignmentResult=taskIds.length?await supabaseClient.from("workflow_task_assignees").select("task_id,user_id").in("task_id",taskIds):{data:[],error:null};
            if(assignmentResult.error)throw assignmentResult.error;
            const docResult=instance.source_document_id?await supabaseClient.from("sop_documents").select("id,sop_code,part_number,operation_name,created_by,model_id").eq("id",instance.source_document_id).maybeSingle():{data:null,error:null};
            if(docResult.error)throw docResult.error;
            const revResult=instance.source_revision_id?await supabaseClient.from("sop_revisions").select("id,revision_code,status,created_by,description,released_at").eq("id",instance.source_revision_id).maybeSingle():{data:null,error:null};
            if(revResult.error)throw revResult.error;
            const peopleResult=await supabaseClient.rpc("get_sop_workflow_people",{p_instance_ids:relatedInstanceIds.map(Number)});
            if(peopleResult.error)throw peopleResult.error;
            const peopleRows=peopleResult.data||[];
            const profileMap=new Map(peopleRows.map(row=>[String(row.user_id),row.full_name]));
            const pendingTask=taskRows.find(row=>pendingStatuses.includes(String(row.status||"").toLowerCase()));
            const nodeResult=pendingTask?await supabaseClient.from("workflow_nodes").select("label,node_type,required_permission_code").eq("id",pendingTask.node_id).maybeSingle():{data:null,error:null};
            if(nodeResult.error)throw nodeResult.error;
            const permission=nodeResult.data?.required_permission_code;
            const canAct=Boolean(pendingTask&&permission&&hasPermission(permission)&&hasPermission("workflow.tasks.act"));
            const taskHtml=taskRows.map(task=>{
                const names=[...new Set(peopleRows.filter(row=>String(row.workflow_id)===String(instanceId)&&String(row.task_id)===String(task.id)).map(row=>profileMap.get(String(row.user_id))).filter(Boolean))].join(", ");
                return "<tr><td>"+escapeText(task.title||nodeMapLabel(task.node_id))+"</td><td>"+escapeText(labelText(task.status))+"</td><td>"+escapeText(names||"Unassigned")+"</td><td>"+escapeText(dateText(task.created_at))+"</td><td>"+escapeText(task.completed_at?dateText(task.completed_at):"—")+"</td></tr>";
            }).join("");
            const historyHtml=(history||[]).map(item=>{
                const detailObj=item.details||{}, actor=profileMap.get(String(item.actor_id))||"User";
                const reason=detailObj.reason||detailObj.result?.comment||detailObj.comment;
                const event=labelText(item.event_type);
                const process=event==="SOP status changed" ? "SOP status: "+labelText(detailObj.from_status||"")+" to "+labelText(detailObj.to_status||"") : event;
                return "<tr><td>"+escapeText(dateText(item.created_at))+"</td><td>"+escapeText(actor)+"</td><td>"+escapeText(process)+"</td><td>"+escapeText(reason||"—")+"</td></tr>";
            }).join("");
            const doc=docResult.data||{}, revision=revResult.data||{};
            const duration=dateDuration(instance.started_at,instance.completed_at);
            detail.innerHTML="<h3>"+escapeText(doc.sop_code||"Unassigned SOP")+" · "+escapeText(revision.revision_code||"Revision unknown")+"</h3><p><strong>Workflow ID:</strong> "+escapeText(instance.id)+" · <strong>Status:</strong> "+escapeText(labelText(instance.status))+"</p><p><strong>Creator:</strong> "+escapeText(profileMap.get(String(revision.created_by||doc.created_by))||"Creator profile unavailable")+"</p><p><strong>Part No.:</strong> "+escapeText(doc.part_number||"—")+" · <strong>Operation:</strong> "+escapeText(doc.operation_name||"—")+"</p><p><strong>Submitted:</strong> "+escapeText(dateText(instance.started_at))+" · <strong>Duration:</strong> "+escapeText(duration)+(instance.completed_at?"":" (in progress)")+"</p><h4>Tasks</h4><div class='catalog-table'><table><thead><tr><th>Task</th><th>Status</th><th>Assigned To</th><th>Created</th><th>Completed</th></tr></thead><tbody>"+(taskHtml||"<tr><td colspan='5'>No tasks found.</td></tr>")+"</tbody></table></div><h4>History</h4><div class='catalog-table workflow-history-table'><table><thead><tr><th>Date</th><th>User</th><th>Process</th><th>Comments</th></tr></thead><tbody>"+(historyHtml||"<tr><td colspan='4'>No history available.</td></tr>")+"</tbody></table></div>"+(canAct?"<div class='sop-revision-section'><label for='workflow-task-comment'>Review comments</label><textarea id='workflow-task-comment' rows='3' placeholder='Enter comments for this review'></textarea></div><div class='sop-modal-actions'><button type='button' class='danger-button' id='workflow-reject-task' data-task-id='"+escapeText(pendingTask.id)+"'>Reject and return to Draft</button><button type='button' class='primary-button' id='workflow-complete-task' data-task-id='"+escapeText(pendingTask.id)+"' data-stage='"+escapeText(permission)+"'>Complete "+escapeText(labelText(permission))+"</button></div>":pendingTask?"<p>You can view this workflow, but you do not have permission to act on its current task.</p>":"");
        }catch(error){console.error("Unable to load workflow details:",error);detail.innerHTML="<p>Unable to load workflow details. "+escapeText(error?.message||"Check access policies and the browser console.")+"</p>";}
    });
    function nodeMapLabel(nodeId){return "Task #"+nodeId;}
    document.addEventListener("click",async event=>{
        const completeButton=event.target.closest("#workflow-complete-task"), rejectButton=event.target.closest("#workflow-reject-task");
        if(!completeButton&&!rejectButton)return;
        const button=completeButton||rejectButton, taskId=Number(button.dataset.taskId), comment=document.getElementById("workflow-task-comment")?.value?.trim()||"";
        const isReject=Boolean(rejectButton);
        if(isReject&&!comment){alert("Enter a reason before rejecting this SOP.");return;}
        if(!isReject&&!comment&&!confirm("Complete this task without review comments?"))return;
        if(isReject&&!confirm("Reject this task and return the SOP revision to Draft?"))return;
        button.disabled=true;
        try{
            const rpcName=isReject?"workflow_reject_task":"workflow_complete_task";
            const rpcArgs=isReject?{p_task_id:taskId,p_reason:comment}:{p_task_id:taskId,p_transition_key:null,p_result:{comment}};
            const {error}=await supabaseClient.rpc(rpcName,rpcArgs);
            if(error)throw error;
            alert(isReject?"Task rejected. The reason has been recorded.":"Workflow task completed successfully.");
            document.getElementById("sop-modal").classList.add("hidden");window.location.reload();
        }catch(error){console.error("Workflow action failed:",error);alert("The workflow action failed: "+(error.message||"Check permissions and RPC parameters."));button.disabled=false;}
    });
});