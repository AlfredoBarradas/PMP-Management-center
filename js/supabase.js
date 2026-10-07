const SUPABASE_URL = "https://abayotradvotgbjefqnd.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_iGisAkBlLvs7s8kufpkm2A_xdvVmEpL";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

let currentUser = null;
let currentUserRole = null;

async function initializeSupabaseAuth() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
        console.error("Error getting session:", error);
        return null;
    }

    currentUser = data.session?.user ?? null;

    if (!currentUser) {
        currentUserRole = null;
        return null;
    }

    const { data: role, error: roleError } = await supabaseClient.rpc(
        "get_user_role",
        { p_user_id: currentUser.id }
    );

    if (roleError) {
        console.error("Error getting user role:", roleError);
        currentUserRole = null;
        return null;
    }

    currentUserRole = role;

    return {
        user: currentUser,
        role: currentUserRole
    };
}

supabaseClient.auth.onAuthStateChange(async (event, session) => {
    currentUser = session?.user ?? null;

    if (!currentUser) {
        currentUserRole = null;
        return;
    }

    const { data: role, error } = await supabaseClient.rpc(
        "get_user_role",
        { p_user_id: currentUser.id }
    );

    if (error) {
        console.error("Error getting user role:", error);
        currentUserRole = null;
        return;
    }

    currentUserRole = role;
});