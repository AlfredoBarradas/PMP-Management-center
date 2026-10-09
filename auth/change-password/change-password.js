
document.addEventListener("DOMContentLoaded", async () => {
    const form = document.getElementById("change-password-form");
    const newPasswordInput = document.getElementById("new-password");
    const confirmPasswordInput = document.getElementById("confirm-password");
    const message = document.getElementById("change-password-message");
    const button = document.getElementById("change-password-button");
    const authData = await requireAuth();

    const backButton = document.getElementById("back-to-login-button");
    backButton.addEventListener("click", async () => {
        backButton.disabled = true;
        backButton.textContent = "Signing out...";
        try {
            await signOutUser();
        } catch (error) {
            console.error("Sign out error:", error);
        }
        window.location.replace("/auth/");
    });

    if (!authData) return;
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        message.textContent = "";
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        if (newPassword.length < 8) {
            message.textContent = "Password must be at least 8 characters.";
            return;
        }
        if (newPassword.length >= 128) {
            message.textContent = "Password must be less than 128 characters.";
            return;
        }
        if (newPassword !== confirmPassword) {
            message.textContent = "Passwords do not match.";
            confirmPasswordInput.focus();
            return;
        }
        button.disabled = true;
        button.textContent = "Updating...";
        try {
            const { data, error } = await supabaseClient.functions.invoke("change-password", {
                body: { new_password: newPassword }
            });
            if (error) {
                let detail = "";
                try {
                    detail = await error.context?.json().then((body) => body.error || "").catch(() => "");
                } catch {}
                throw new Error(detail || "Unable to update password. Please try again.");
            }
            if (!data?.success) {
                throw new Error(data?.error || "Unable to update password.");
            }
            newPasswordInput.value = "";
            confirmPasswordInput.value = "";
            message.textContent = "Password updated successfully. Redirecting...";
            window.location.replace("/");
        } catch (error) {
            console.error("Change password error:", error);
            message.textContent = error.message || "An unexpected error occurred.";
            button.disabled = false;
            button.textContent = "Update Password";
        }
    });
});
