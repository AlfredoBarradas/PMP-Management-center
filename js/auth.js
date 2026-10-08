async function requireAuth() {
    const authData = await initializeSupabaseAuth();

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

    if (!authData.roleData) {
        console.error("User has no valid role.");
        await signOutUser();
        window.location.href = "/auth/";
        return null;
    }

    if (!authData.roleData.active) {
        console.error("User role is inactive.");
        await signOutUser();
        window.location.href = "/auth/";
        return null;
    }

    return authData;
}

document.addEventListener("DOMContentLoaded", async () => {
    await requireAuth();
});