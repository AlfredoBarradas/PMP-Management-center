
document.getElementById("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const employeeNumber = document.getElementById("login-employee-number").value.trim();
    const password = document.getElementById("login-password").value;
    const message = document.getElementById("login-message");
    const button = event.currentTarget.querySelector('button[type="submit"]');
    message.textContent = "";
    if (!employeeNumber || !password) {
        message.textContent = "Please enter your employee number and password.";
        return;
    }
    button.disabled = true;
    const technicalEmail = `${employeeNumber}@auth.pmp.local`;
    const { error } = await supabaseClient.auth.signInWithPassword({
        email: technicalEmail,
        password
    });
    if (error) {
        console.error("Login error:", error);
        message.textContent = "Invalid employee number or password.";
        button.disabled = false;
        return;
    }
    const authData = await initializeSupabaseAuth();
    if (!authData?.user || !authData.profile) {
        console.error("Authenticated user has no valid profile.");
        await signOutUser();
        message.textContent = "Unable to load user profile.";
        button.disabled = false;
        return;
    }
    if (!authData.profile.active) {
        await signOutUser();
        message.textContent = "This account is inactive.";
        button.disabled = false;
        return;
    }
    if (!authData.roleData || !authData.roleData.active) {
        await signOutUser();
        message.textContent = "This account does not have an active role.";
        button.disabled = false;
        return;
    }
    console.log("Login successful:", {
        employeeNumber: authData.profile.employee_number,
        name: authData.profile.full_name,
        role: authData.roleData.name
    });
    window.location.href = authData.profile.must_change_password
        ? "/auth/change-password/"
        : "/";
});
