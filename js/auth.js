
async function requireAuth() {
    const authData = await initializeSupabaseAuth();
    const isChangePasswordPage = window.location.pathname.startsWith("/auth/change-password");
    if (!authData?.user) {
        window.location.href = "/auth/";
        return null;
    }
    if (!authData.profile) {
        console.error("Authenticated user has no profile.");
        await signOutUser();
        window.location.href = "/auth/";
        return null;
    }
    if (!authData.profile.active) {
        console.error("User account is inactive.");
        await signOutUser();
        window.location.href = "/auth/";
        return null;
    }
    if (!authData.roleData || !authData.roleData.active) {
        console.error("User has no valid active role.");
        await signOutUser();
        window.location.href = "/auth/";
        return null;
    }
    if (authData.profile.must_change_password && !isChangePasswordPage) {
        window.location.href = "/auth/change-password/";
        return null;
    }
    if (!authData.profile.must_change_password && isChangePasswordPage) {
        window.location.href = "/";
        return null;
    }
    return authData;
}
document.addEventListener("DOMContentLoaded", async () => {
    await requireAuth();
});
