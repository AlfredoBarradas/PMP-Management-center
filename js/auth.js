const PAGE_MODULES = {
    "Documents": ["SOP", "Layout", "TI", "MDR"],
    "SOP": ["SOP"],
    "Layout": ["Layout"],
    "TI": ["TI"],
    "MDR": ["MDR"],
    "Losstime": ["Losstime"],
    "Efficiency": ["Efficiency"],
    "Scrap": ["Scrap"],
    "Production": ["Production"],
    "New Models": ["New Models", "PFMEA"]
};
let authGuardPromise = null;
function getRequiredModules() {
    const configuredModules = document.body.dataset.requiredModules;
    if (configuredModules) {
        return configuredModules.split(",").map(module => module.trim()).filter(Boolean);
    }
    return PAGE_MODULES[document.body.dataset.page] ?? [];
}
function redirectTo(path) {
    window.location.replace(path);
    return null;
}
async function requireAuth() {
    if (authGuardPromise) return authGuardPromise;
    authGuardPromise = (async () => {
        try {
            const authData = await initializeSupabaseAuth();
            const path = window.location.pathname;
            const isChangePasswordPage = path.startsWith("/auth/change-password");
            if (!authData?.user) return redirectTo("/auth/");
            if (!authData.profile || !authData.roleData) {
                console.error("Authenticated user has no valid profile or role.");
                await signOutUser();
                return redirectTo("/auth/");
            }
            if (!authData.profile.active || !authData.roleData.active) {
                console.error("User account or role is inactive.");
                await signOutUser();
                return redirectTo("/auth/");
            }
            if (authData.profile.must_change_password && !isChangePasswordPage) {
                return redirectTo("/auth/change-password/");
            }
            if (!authData.profile.must_change_password && isChangePasswordPage) {
                return redirectTo("/");
            }
            const adminOnly = document.body.dataset.adminOnly === "true" ||
                path.startsWith("/settings/users") ||
                path.startsWith("/settings/roles");
            if (adminOnly && !isAdmin()) return redirectTo("/");
            const requiredModules = getRequiredModules();
            const pageName = document.body.dataset.page;
            if (!adminOnly && !isChangePasswordPage && pageName !== "Home" && !requiredModules.length) {
                console.error("No access policy configured for page:", pageName);
                return redirectTo("/");
            }
            if (requiredModules.length && !isAdmin()) {
                const canViewPage = currentUserPermissions.some(permission =>
                    requiredModules.includes(permission.module) &&
                    String(permission.action).toLowerCase() === "view"
                );
                if (!canViewPage) return redirectTo("/");
            }
            return authData;
        } catch (error) {
            console.error("Access validation failed:", error);
            return redirectTo("/auth/");
        }
    })();
    return authGuardPromise;
}
document.addEventListener("DOMContentLoaded", async () => {
    const authData = await requireAuth();
    if (authData && document.body.classList.contains("auth-pending") &&
        document.body.dataset.authDefer !== "true") {
        document.body.classList.remove("auth-pending");
    }
});