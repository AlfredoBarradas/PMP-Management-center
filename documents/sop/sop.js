document.addEventListener("DOMContentLoaded", () => {
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
});