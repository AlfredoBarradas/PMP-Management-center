(() => {
    async function loadTopbar() {
        const container = document.getElementById("topbar-container");

        if (!container) {
            return;
        }

        const response = await fetch("/components/topbar/topbar.html");

        if (!response.ok) {
            console.error("Error loading topbar:", response.status);
            return;
        }

        container.innerHTML = await response.text();

        const pageName = document.body.dataset.page;
        const pageTitle = document.getElementById("page-title");

        if (pageTitle) {
            pageTitle.textContent = pageName ?? "";
        }

        const authData = await initializeSupabaseAuth();

        if (!authData?.user || !authData.profile || !authData.roleData) {
            return;
        }

        const userNameElement = document.getElementById("current-user-name");
        const roleElement = document.getElementById("current-user-role");

        if (userNameElement) {
            userNameElement.textContent = authData.profile.full_name ?? "";
        }

        if (roleElement) {
            roleElement.textContent = authData.roleData.name ?? "";
        }
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/components/topbar/topbar.css";
    document.head.appendChild(link);

    loadTopbar();
})();