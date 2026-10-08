document.addEventListener("DOMContentLoaded", async () => {
    const authData = await initializeSupabaseAuth();
    if (!authData?.user) {
        window.location.href = "/auth/";
        return;
    }
    await initializeSopPage();
});

async function initializeSopPage() {
    const sections = document.querySelectorAll(".sop-view");
    const navigationButtons = document.querySelectorAll("[data-section]");
    const sopForm = document.getElementById("sop-form");
    const editorTitle = document.getElementById("sop-editor-title");
    const editorDescription = document.getElementById("sop-editor-description");
    const sopMode = document.getElementById("sop-mode");
    const sopId = document.getElementById("sop-id");
    const revisionInfo = document.getElementById("revision-info");
    const revisionSopCode = document.getElementById("revision-sop-code");
    const revisionCurrent = document.getElementById("revision-current");
    const revisionNew = document.getElementById("revision-new");
    const descriptionTitle = document.getElementById("sop-description-title");
    const descriptionLabel = document.getElementById("sop-description-label");
    const descriptionInput = document.getElementById("sop-description");
    const fileInput = document.getElementById("sop-file");
    function showSection(sectionId) {
        sections.forEach(section => section.classList.add("hidden"));
        const targetSection = document.getElementById(sectionId);
        if (targetSection) targetSection.classList.remove("hidden");
        window.scrollTo({ top: 0, behavior: "smooth" });
    }
    function setFormEditable(editable) {
        document.getElementById("sop-workshop").disabled = !editable;
        document.getElementById("sop-process").disabled = !editable;
        document.getElementById("sop-model-series").disabled = !editable;
        document.getElementById("sop-model").disabled = !editable;
        document.getElementById("sop-part-name").disabled = !editable;
        document.getElementById("sop-part-number").readOnly = !editable;
        document.getElementById("sop-operation").readOnly = !editable;
    }
    function setCreateMode() {
        sopMode.value = "create";
        sopId.value = "";
        editorTitle.textContent = "Create New SOP";
        editorDescription.textContent = "Create a new standard operating process.";
        revisionInfo.classList.add("hidden");
        descriptionTitle.textContent = "Description";
        descriptionLabel.textContent = "Description";
        descriptionInput.placeholder = "Describe the purpose and scope of this SOP.";
        fileInput.value = "";
        setFormEditable(true);
    }
    function setRevisionMode(sop) {
        sopMode.value = "revision";
        sopId.value = sop.id;
        editorTitle.textContent = "SOP Revision";
        editorDescription.textContent = "Create a new revision of an existing SOP.";
        revisionInfo.classList.remove("hidden");
        revisionSopCode.value = sop.sopCode;
        revisionCurrent.value = sop.currentRevision;
        revisionNew.value = getNextRevision(sop.currentRevision);
        descriptionTitle.textContent = "Change Summary";
        descriptionLabel.textContent = "Change Summary";
        descriptionInput.placeholder = "Describe what changed in this revision.";
        fileInput.value = "";
        document.getElementById("sop-workshop").value = sop.workshopId;
        document.getElementById("sop-process").value = sop.processAreaId;
        document.getElementById("sop-model-series").value = sop.modelSeriesId;
        document.getElementById("sop-model").value = sop.modelId;
        document.getElementById("sop-part-name").value = sop.partNameId;
        document.getElementById("sop-part-number").value = sop.partNumber || "";
        document.getElementById("sop-operation").value = sop.operationName || "";
        descriptionInput.value = "";
        setFormEditable(false);
    }
    function getNextRevision(revision) {
        if (!revision) return "R01";
        const number = parseInt(revision.replace("R", ""), 10);
        if (Number.isNaN(number)) return "R01";
        return `R${String(number + 1).padStart(2, "0")}`;
    }
    function openCreateSop() {
        sopForm.reset();
        setCreateMode();
        showSection("sop-create");
    }
    async function openRevisionSop(sop) {
        setRevisionMode(sop);
        showSection("sop-create");
    }
    function openEditSop() {
        editorTitle.textContent = "Edit Draft SOP";
        sopMode.value = "edit";
        revisionInfo.classList.add("hidden");
        setFormEditable(true);
        showSection("sop-create");
    }
    navigationButtons.forEach(button => {
        button.addEventListener("click", () => {
            showSection(button.dataset.section);
        });
    });
    document.querySelectorAll(".create-sop-button").forEach(button => {
        button.addEventListener("click", openCreateSop);
    });
    document.querySelectorAll(".edit-draft-button").forEach(button => {
        button.addEventListener("click", openEditSop);
    });
    document.querySelectorAll(".revision-sop-button").forEach(button => {
        button.addEventListener("click", () => {
            const sop = {
                id: button.dataset.sopId,
                sopCode: button.dataset.sopCode,
                currentRevision: button.dataset.revision,
                workshopId: button.dataset.workshopId,
                processAreaId: button.dataset.processAreaId,
                modelSeriesId: button.dataset.modelSeriesId,
                modelId: button.dataset.modelId,
                partNameId: button.dataset.partNameId,
                partNumber: button.dataset.partNumber,
                operationName: button.dataset.operationName
            };
            openRevisionSop(sop);
        });
    });
    document.getElementById("save-sop-draft").addEventListener("click", () => {
        const mode = sopMode.value;
        if (mode === "revision") {
            alert("Revision saved as draft.");
            return;
        }
        alert("SOP saved as draft.");
    });
    sopForm.addEventListener("submit", event => {
        event.preventDefault();
        const mode = sopMode.value;
        if (mode === "revision") {
            alert("Revision submitted for validation.");
            return;
        }
        alert("SOP submitted for validation.");
    });
    document.querySelectorAll(".danger-button").forEach(button => {
        button.addEventListener("click", () => {
            if (!confirm("Are you sure you want to delete this draft?")) return;
            const row = button.closest("tr");
            if (row) row.remove();
        });
    });
    document.querySelectorAll("#sop-validation .primary-button").forEach(button => {
        button.addEventListener("click", () => {
            if (!confirm("Validate this SOP?")) return;
            const row = button.closest("tr");
            if (row) row.remove();
            alert("SOP validated successfully.");
        });
    });
    document.querySelectorAll("#sop-approval .primary-button").forEach(button => {
        button.addEventListener("click", () => {
            if (!confirm("Approve this SOP?")) return;
            const row = button.closest("tr");
            if (row) row.remove();
            alert("SOP approved successfully.");
        });
    });
    document.querySelectorAll(".view-flow-button").forEach(button => {
        button.addEventListener("click", () => {
            alert("Workflow detail will be displayed here.");
        });
    });
    showSection("sop-control");




    async function loadPartNames(workshopId) {
        const partNameSelect = document.getElementById("sop-part-name");
        partNameSelect.innerHTML = '<option value="">Select part name</option>';
        partNameSelect.disabled = true;
        if (!workshopId) return;
        const { data: relations, error: relationError } = await supabaseClient
            .from("workshop_part_names")
            .select("part_name_id")
            .eq("workshop_id", workshopId);
        if (relationError) {
            console.error("Error loading workshop part names:", relationError);
            return;
        }
        const partNameIds = relations.map(item => item.part_name_id);
        if (partNameIds.length === 0) {
            console.warn("No part names found for workshop:", workshopId);
            partNameSelect.disabled = false;
            return;
        }
        const { data: partNames, error: partNameError } = await supabaseClient
            .from("part_names")
            .select("id, name, code")
            .in("id", partNameIds)
            .eq("active", true)
            .order("name");
        if (partNameError) {
            console.error("Error loading part names:", partNameError);
            return;
        }
        partNames.forEach(part => {
            const option = document.createElement("option");
            option.value = part.id;
            option.textContent = part.name;
            partNameSelect.appendChild(option);
        });
        partNameSelect.disabled = false;
    }

    async function loadModels(seriesId) {
        const modelSelect = document.getElementById("sop-model");
        modelSelect.innerHTML = '<option value="">Select model</option>';
        modelSelect.disabled = true;
        if (!seriesId) return;
        const { data, error } = await supabaseClient
            .from("models")
            .select("id, name")
            .eq("model_series_id", seriesId)
            .eq("active", true)
            .order("name");
        if (error) {
            console.error("Error loading models:", error);
            return;
        }
        data.forEach(model => {
            const option = document.createElement("option");
            option.value = model.id;
            option.textContent = model.name;
            modelSelect.appendChild(option);
        });
        modelSelect.disabled = false;
    }

    async function loadModelSeries() {
        const seriesSelect = document.getElementById("sop-model-series");
        seriesSelect.innerHTML = '<option value="">Select model series</option>';
        seriesSelect.disabled = true;
        const { data, error } = await supabaseClient
            .from("model_series")
            .select("id, name, code")
            .eq("active", true)
            .order("name");
        if (error) {
            console.error("Error loading model series:", error);
            return;
        }
        data.forEach(series => {
            const option = document.createElement("option");
            option.value = series.id;
            option.textContent = series.name;
            seriesSelect.appendChild(option);
        });
        seriesSelect.disabled = false;
    }

    async function loadProcessAreas(workshopId) {
        const processSelect = document.getElementById("sop-process");
        processSelect.innerHTML = '<option value="">Select process area</option>';
        processSelect.disabled = true;
        if (!workshopId) return;
        const { data: relations, error: relationError } = await supabaseClient
            .from("workshop_process_areas")
            .select("process_area_id")
            .eq("workshop_id", workshopId);
        if (relationError) {
            console.error("Error loading workshop process areas:", relationError);
            return;
        }
        const areaIds = relations.map(item => item.process_area_id);
        if (areaIds.length === 0) {
            console.warn("No process areas found for workshop:", workshopId);
            processSelect.disabled = false;
            return;
        }
        const { data: areas, error: areaError } = await supabaseClient
            .from("process_areas")
            .select("id, name, code")
            .in("id", areaIds)
            .eq("active", true)
            .order("name");
        if (areaError) {
            console.error("Error loading process areas:", areaError);
            return;
        }
        areas.forEach(area => {
            const option = document.createElement("option");
            option.value = area.id;
            option.textContent = `${area.name} (${area.code})`;
            processSelect.appendChild(option);
        });
        processSelect.disabled = false;
    }

    async function loadWorkshops() {
        const workshopSelect = document.getElementById("sop-workshop");
        const { data, error } = await supabaseClient
            .from("workshops")
            .select("id, name, code")
            .eq("active", true)
            .order("name");
        if (error) {
            console.error("Error loading workshops:", error);
            return;
        }
        workshopSelect.innerHTML = '<option value="">Select workshop</option>';
        data.forEach(workshop => {
            const option = document.createElement("option");
            option.value = workshop.id;
            option.textContent = `${workshop.name} (${workshop.code})`;
            workshopSelect.appendChild(option);
        });
    }


    async function saveNewSop() {
        const workshopId = document.getElementById("sop-workshop").value;
        const processAreaId = document.getElementById("sop-process").value;
        const modelId = document.getElementById("sop-model").value;
        const partNameId = document.getElementById("sop-part-name").value;
        const partNumber = document.getElementById("sop-part-number").value.trim();
        const operationName = document.getElementById("sop-operation").value.trim();
        const description = document.getElementById("sop-description").value.trim();
        if (!workshopId || !processAreaId || !modelId || !partNameId) {
            alert("Please complete all required selections.");
            return;
        }
        if (!partNumber || !operationName || !description) {
            alert("Please complete Part Number, Operation Name, and Description.");
            return;
        }
        const button = document.getElementById("save-sop-draft");
        button.disabled = true;
        button.textContent = "Saving...";
        const { data, error } = await supabaseClient.rpc("create_new_sop", {
            p_workshop_id: Number(workshopId),
            p_process_area_id: Number(processAreaId),
            p_model_id: Number(modelId),
            p_part_name_id: Number(partNameId),
            p_part_number: partNumber,
            p_operation_name: operationName,
            p_description: description
        });
        button.disabled = false;
        button.textContent = "Save Draft";
        if (error) {
            console.error("Error creating SOP:", error);
            alert("Error creating SOP. Check the console for details.");
            return;
        }
        console.log("SOP created:", data);
        alert(`SOP ${data[0].sop_code} created successfully as ${data[0].revision_code}.`);
    }


    loadWorkshops();
    document.getElementById("sop-workshop").addEventListener("change", event => {
        const workshopId = event.target.value;
        loadProcessAreas(workshopId);
        loadPartNames(workshopId);
    });
    document.getElementById("sop-model-series").addEventListener("change", event => {
        loadModels(event.target.value);
    });
    loadModelSeries();

    document.getElementById("save-sop-draft").addEventListener("click", saveNewSop);





    async function loadSopCatalog() {
        const catalogBody = document.getElementById("sop-catalog-body");
        catalogBody.innerHTML = '<tr><td colspan="11">Loading...</td></tr>';
        const { data, error } = await supabaseClient
            .from("sop_documents")
            .select(`
                id,
                sop_code,
                part_number,
                operation_name,
                created_at,
                workshops (
                    name,
                    code
                ),
                process_areas (
                    name,
                    code
                ),
                models (
                    name,
                    model_series (
                        name,
                        code
                    )
                ),
                part_names (
                    name,
                    code
                ),
                sop_revisions (
                    revision_code,
                    status,
                    created_at
                )
            `)
            .order("created_at", { ascending: false });
        if (error) {
            console.error("Error loading SOP catalog:", error);
            catalogBody.innerHTML = '<tr><td colspan="11">Error loading SOP catalog.</td></tr>';
            return;
        }
        if (!data || data.length === 0) {
            catalogBody.innerHTML = '<tr><td colspan="11">No SOPs found.</td></tr>';
            return;
        }
        renderSopCatalog(data);
    }

    function renderSopCatalog(sops) {
        const catalogBody = document.getElementById("sop-catalog-body");
        catalogBody.innerHTML = "";
        sops.forEach(sop => {
            const revisions = sop.sop_revisions || [];
            const currentRevision = revisions
                .sort((a, b) => {
                    const aNumber = parseInt(a.revision_code.replace("R", ""), 10);
                    const bNumber = parseInt(b.revision_code.replace("R", ""), 10);
                    return bNumber - aNumber;
                })[0];
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${sop.workshops?.name || ""}</td>
                <td>${sop.sop_code}</td>
                <td>${sop.process_areas?.name || ""}</td>
                <td>${sop.models?.name || ""}</td>
                <td>${sop.part_names?.name || ""}</td>
                <td>${sop.part_number || ""}</td>
                <td>${sop.operation_name || ""}</td>
                <td>${currentRevision?.revision_code || ""}</td>
                <td>${formatDate(sop.created_at)}</td>
                <td>${currentRevision?.status || ""}</td>
                <td>
                    <button type="button" class="secondary-button view-sop-button" data-sop-id="${sop.id}">View</button>
                </td>
            `;
            catalogBody.appendChild(row);
        });
    }

    function formatDate(dateString) {
        if (!dateString) return "";
        return new Date(dateString).toLocaleDateString("en-US");
    }
    loadSopCatalog();

    function openSopModal() {
        document.getElementById("sop-modal").classList.remove("hidden");
    }
    function closeSopModal() {
        document.getElementById("sop-modal").classList.add("hidden");
    }
    document.getElementById("sop-modal-close").addEventListener("click", closeSopModal);
    document.getElementById("sop-modal-close-footer").addEventListener("click", closeSopModal);
    document.querySelector(".sop-modal-overlay").addEventListener("click", closeSopModal);
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeSopModal();
        }
    });

    async function viewSop(sopId) {
        const modalBody = document.querySelector(".sop-modal-body");
        modalBody.innerHTML = "<p>Loading...</p>";
        openSopModal();
        const { data, error } = await supabaseClient
            .from("sop_documents")
            .select(`
                id,
                sop_code,
                part_number,
                operation_name,
                created_at,
                workshops (
                    name,
                    code
                ),
                process_areas (
                    name,
                    code
                ),
                models (
                    name,
                    model_series (
                        name,
                        code
                    )
                ),
                part_names (
                    name,
                    code
                ),
                sop_revisions (
                    revision_number,
                    revision_code,
                    description,
                    status,
                    created_at,
                    released_at
                )
            `)
            .eq("id", sopId)
            .single();
        if (error) {
            console.error("Error loading SOP:", error);
            modalBody.innerHTML = "<p>Error loading SOP information.</p>";
            return;
        }
        renderSopModal(data);
        document.getElementById("sop-modal").dataset.sop = JSON.stringify(data);
    }


    function renderSopModal(sop) {
        const modalBody = document.querySelector(".sop-modal-body");
        const revisions = sop.sop_revisions || [];
        const currentRevision = revisions
            .sort((a, b) => b.revision_number - a.revision_number)[0];
        modalBody.innerHTML = `
            <div class="sop-modal-grid">
                <div class="sop-modal-field">
                    <span>SOP Code</span>
                    <strong>${sop.sop_code}</strong>
                </div>
                <div class="sop-modal-field">
                    <span>Revision</span>
                    <strong>${currentRevision?.revision_code || ""}</strong>
                </div>
                <div class="sop-modal-field">
                    <span>Workshop</span>
                    <strong>${sop.workshops?.name || ""}</strong>
                </div>
                <div class="sop-modal-field">
                    <span>Process Area</span>
                    <strong>${sop.process_areas?.name || ""}</strong>
                </div>
                <div class="sop-modal-field">
                    <span>Model Series</span>
                    <strong>${sop.models?.model_series?.name || ""}</strong>
                </div>
                <div class="sop-modal-field">
                    <span>Model</span>
                    <strong>${sop.models?.name || ""}</strong>
                </div>
                <div class="sop-modal-field">
                    <span>Part Name</span>
                    <strong>${sop.part_names?.name || ""}</strong>
                </div>
                <div class="sop-modal-field">
                    <span>Part Number</span>
                    <strong>${sop.part_number || ""}</strong>
                </div>
                <div class="sop-modal-field">
                    <span>Operation Name</span>
                    <strong>${sop.operation_name || ""}</strong>
                </div>
                <div class="sop-modal-field">
                    <span>Status</span>
                    <strong>${currentRevision?.status || ""}</strong>
                </div>
                <div class="sop-modal-field sop-modal-field-full">
                    <span>Description</span>
                    <p>${currentRevision?.description || ""}</p>
                </div>
                <div class="sop-modal-actions">
                    <button type="button" class="remark-button modal-revision-button" data-sop-id="${sop.id}">
                        Revision
                    </button>
                </div>
            </div>
        `;
    }

    function openRevisionModal(sop) {
        const modalBody = document.querySelector(".sop-modal-body");
        const revisions = sop.sop_revisions || [];
        const currentRevision = revisions
            .sort((a, b) => b.revision_number - a.revision_number)[0];
        const currentRevisionNumber = currentRevision?.revision_number ?? 0;
        const nextRevisionNumber = currentRevisionNumber + 1;
        const currentRevisionCode = currentRevision?.revision_code || `R${String(currentRevisionNumber).padStart(2, "0")}`;
        const nextRevisionCode = `R${String(nextRevisionNumber).padStart(2, "0")}`;
        modalBody.innerHTML = `
            <div class="sop-revision-header">
                <h3>Revision Information</h3>
                <p>Create a new revision for this SOP.</p>
            </div>
            <div class="sop-modal-grid">
                <div class="sop-modal-field">
                    <span>SOP Code</span>
                    <strong>${sop.sop_code}</strong>
                </div>
                <div class="sop-modal-field">
                    <span>Current Revision</span>
                    <strong>${currentRevisionCode}</strong>
                </div>
                <div class="sop-modal-field">
                    <span>New Revision</span>
                    <strong>${nextRevisionCode}</strong>
                </div>
                <div class="sop-modal-field">
                    <span>Workshop</span>
                    <strong>${sop.workshops?.name || ""}</strong>
                </div>
                <div class="sop-modal-field">
                    <span>Process Area</span>
                    <strong>${sop.process_areas?.name || ""}</strong>
                </div>
                <div class="sop-modal-field">
                    <span>Model Series</span>
                    <strong>${sop.models?.model_series?.name || ""}</strong>
                </div>
                <div class="sop-modal-field">
                    <span>Model</span>
                    <strong>${sop.models?.name || ""}</strong>
                </div>
                <div class="sop-modal-field">
                    <span>Part Name</span>
                    <strong>${sop.part_names?.name || ""}</strong>
                </div>
                <div class="sop-modal-field">
                    <span>Part Number</span>
                    <strong>${sop.part_number || ""}</strong>
                </div>
                <div class="sop-modal-field">
                    <span>Operation Name</span>
                    <strong>${sop.operation_name || ""}</strong>
                </div>
            </div>
            <div class="sop-revision-section">
                <label for="revision-change-summary">Change Summary</label>
                <textarea id="revision-change-summary" rows="5" placeholder="Describe what changed in this revision."></textarea>
            </div>
            <div class="sop-revision-section">
                <label for="revision-file">New SOP File</label>
                <input type="file" id="revision-file" accept=".pdf,.xlsx,.xls,.docx,.doc">
                <small>Upload the updated SOP document.</small>
            </div>
            <div class="sop-modal-actions">
                <button type="button" class="secondary-button" id="revision-cancel-button">Cancel</button>
                <button type="button" class="primary-button" id="create-revision-button" data-sop-id="${sop.id}">
                    Create Revision
                </button>
            </div>
        `;
    }



    document.addEventListener("click", event => {
        const viewButton = event.target.closest(".view-sop-button");
        if (viewButton) {
            viewSop(viewButton.dataset.sopId);
            return;
        }
        const revisionButton = event.target.closest(".modal-revision-button");
        if (revisionButton) {
            const modal = document.getElementById("sop-modal");
            const sop = JSON.parse(modal.dataset.sop);
            openRevisionModal(sop);
            return;
        }
        const cancelRevisionButton = event.target.closest("#revision-cancel-button");
        if (cancelRevisionButton) {
            const modal = document.getElementById("sop-modal");
            const sop = JSON.parse(modal.dataset.sop);
            renderSopModal(sop);
            return;
        }
    });

}
