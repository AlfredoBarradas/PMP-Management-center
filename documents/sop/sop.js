document.addEventListener("DOMContentLoaded", () => {
    const sections = document.querySelectorAll(".sop-view");
    const navigationButtons = document.querySelectorAll("[data-section]");

    function showSection(sectionId) {
        sections.forEach(section => section.classList.add("hidden"));
        const targetSection = document.getElementById(sectionId);
        if (targetSection) targetSection.classList.remove("hidden");
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    navigationButtons.forEach(button => {
        button.addEventListener("click", () => {
            showSection(button.dataset.section);
        });
    });

    const sopForm = document.getElementById("sop-form");
    const editorTitle = document.getElementById("sop-editor-title");

    function openCreateSop() {
        editorTitle.textContent = "Create New SOP";
        sopForm.reset();
        document.getElementById("sop-revision").value = "Draft 01";
        showSection("sop-create");
    }

    function openEditSop() {
        editorTitle.textContent = "Edit Draft SOP";
        document.getElementById("sop-code").value = "SOP-001";
        document.getElementById("sop-area").value = "Injection";
        document.getElementById("sop-process").value = "Injection";
        document.getElementById("sop-model").value = "65A60QUR";
        document.getElementById("sop-part-name").value = "Backplane";
        document.getElementById("sop-part-number").value = "T450612";
        document.getElementById("sop-operation").value = "Injection Molding";
        document.getElementById("sop-revision").value = "Draft 02";
        document.getElementById("sop-description").value = "Example SOP draft for injection molding.";
        showSection("sop-create");
    }

    document.querySelectorAll(".create-sop-button").forEach(button => {
        button.addEventListener("click", openCreateSop);
    });

    document.querySelectorAll(".edit-draft-button").forEach(button => {
        button.addEventListener("click", openEditSop);
    });

    document.getElementById("save-sop-draft").addEventListener("click", () => {
        alert("SOP saved as draft.");
    });

    sopForm.addEventListener("submit", event => {
        event.preventDefault();
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