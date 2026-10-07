async function requireAuth() {
    const authData = await initializeSupabaseAuth();

    if (!authData?.user) {
        window.location.href = "/auth/";
        return false;
    }

    return true;
}

document.addEventListener("DOMContentLoaded", async () => {
    await requireAuth();
});