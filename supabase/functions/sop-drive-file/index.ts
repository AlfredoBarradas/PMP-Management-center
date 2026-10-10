import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

function base64Url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToBytes(pem: string): Uint8Array {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  return Uint8Array.from(atob(body), (char) => char.charCodeAt(0));
}

async function getDriveAccessToken(): Promise<string> {
  const email = Deno.env.get("GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = Deno.env.get("GOOGLE_DRIVE_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  if (!email || !privateKey) throw new Error("Google Drive service account secrets are not configured.");
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = header + "." + claims;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const assertion = unsigned + "." + base64Url(signature);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new Error("Google Drive authentication failed: " + (payload.error_description ?? payload.error ?? response.status));
  return payload.access_token as string;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return Response.json({ error: "Authentication required." }, { status: 401, headers: corsHeaders });
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Supabase function secrets are not configured.");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return Response.json({ error: "Invalid session." }, { status: 401, headers: corsHeaders });
    const { data: canCreate, error: permissionError } = await userClient.rpc("has_permission", { p_permission_code: "documents.sop.create" });
    if (permissionError || canCreate !== true) return Response.json({ error: "You do not have permission to attach SOP files." }, { status: 403, headers: corsHeaders });

    const form = await request.formData();
    const sopId = Number(form.get("sop_id"));
    const revisionId = Number(form.get("revision_id"));
    const file = form.get("file");
    if (!Number.isSafeInteger(sopId) || sopId <= 0 || !Number.isSafeInteger(revisionId) || revisionId <= 0 || !(file instanceof File)) {
      return Response.json({ error: "SOP, revision, and file are required." }, { status: 400, headers: corsHeaders });
    }
    if (file.size === 0 || file.size > 20 * 1024 * 1024) return Response.json({ error: "File must be between 1 byte and 20 MB." }, { status: 400, headers: corsHeaders });
    const extension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
    const extensionTypes: Record<string, string> = {
      ".pdf": "application/pdf",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".xls": "application/vnd.ms-excel",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".doc": "application/msword",
    };
    const mimeType = extensionTypes[extension];
    if (!mimeType || (file.type && file.type !== mimeType) || !allowedMimeTypes.has(mimeType)) {
      return Response.json({ error: "Unsupported file type. Use PDF, Excel, or Word." }, { status: 400, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: revision, error: revisionError } = await admin
      .from("sop_revisions")
      .select("id, sop_id, status, created_by, revision_code")
      .eq("id", revisionId)
      .eq("sop_id", sopId)
      .maybeSingle();
    if (revisionError) throw revisionError;
    if (!revision || revision.status !== "Draft" || revision.created_by !== userData.user.id) {
      return Response.json({ error: "The draft revision was not found or does not belong to the current user." }, { status: 403, headers: corsHeaders });
    }

    const folderId = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID");
    if (!folderId) throw new Error("Google Drive folder is not configured.");
    const accessToken = await getDriveAccessToken();
    const safeName = file.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(-180);
    const metadata = {
      name: `SOP-${sopId}-${revision.revision_code}-${safeName}`,
      mimeType,
      parents: [folderId],
      appProperties: { pmp_sop_id: String(sopId), pmp_revision_id: String(revisionId) },
    };
    const boundary = "pmp_sop_" + crypto.randomUUID();
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const prefix = new TextEncoder().encode(
      "--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) + "\r\n--" + boundary + "\r\nContent-Type: " + mimeType + "\r\n\r\n",
    );
    const suffix = new TextEncoder().encode("\r\n--" + boundary + "--");
    const body = new Uint8Array(prefix.length + fileBytes.length + suffix.length);
    body.set(prefix, 0);
    body.set(fileBytes, prefix.length);
    body.set(suffix, prefix.length + fileBytes.length);
    const uploadResponse = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,mimeType", {
      method: "POST",
      headers: { Authorization: "Bearer " + accessToken, "Content-Type": "multipart/related; boundary=" + boundary },
      body,
    });
    const driveFile = await uploadResponse.json();
    if (!uploadResponse.ok || !driveFile.id) throw new Error("Google Drive upload failed: " + (driveFile.error?.message ?? uploadResponse.status));

    const driveUrl = driveFile.webViewLink ?? ("https://drive.google.com/file/d/" + driveFile.id + "/view");
    const { error: updateError } = await admin
      .from("sop_revisions")
      .update({ drive_file_id: driveFile.id, drive_url: driveUrl, document_name: file.name })
      .eq("id", revisionId)
      .eq("sop_id", sopId)
      .eq("status", "Draft")
      .eq("created_by", userData.user.id);
    if (updateError) {
      await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(driveFile.id), {
        method: "DELETE",
        headers: { Authorization: "Bearer " + accessToken },
      }).catch(() => undefined);
      throw updateError;
    }
    return Response.json({ success: true, file_id: driveFile.id, file_name: file.name, drive_url: driveUrl }, { headers: corsHeaders });
  } catch (error) {
    console.error("sop-drive-file error:", error);
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected Drive upload error." }, { status: 500, headers: corsHeaders });
  }
});
