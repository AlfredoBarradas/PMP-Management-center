(() => {

    fetch("/components/topbar/topbar.html")
        .then(response => response.text())
        .then(data => {

            document
                .getElementById("topbar-container")
                .innerHTML = data;

            const pageName = document.body.dataset.page;

            document.getElementById("page-title").textContent = pageName;

    });

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/components/topbar/topbar.css";
    document.head.appendChild(link);

    async function initializeTopbarUser() {
        const authData = await initializeSupabaseAuth();
        if (!authData?.user) {
            return;
        }
        const emailElement = document.getElementById("current-user-email");
        const roleElement = document.getElementById("current-user-role");
        if (emailElement) {
            emailElement.textContent = authData.user.email;
        }
        if (roleElement) {
            roleElement.textContent = authData.role;
        }
        const logoutButton = document.getElementById("logout-button");
        if (logoutButton) {
            logoutButton.addEventListener("click", async () => {
                const { error } = await supabaseClient.auth.signOut();
                if (error) {
                    console.error("Logout error:", error);
                    return;
                }
                window.location.href = "/auth/";
            });
        }
    }
    initializeTopbarUser();
    
})();