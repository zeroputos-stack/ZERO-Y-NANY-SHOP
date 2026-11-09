import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const allowedRoles = new Set(["admin", "editor"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "Faltan secretos de Supabase en la función manage-team." }, 500);
    }

    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Inicia sesión para continuar." }, 401);

    const callerClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await callerClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "La sesión no es válida." }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: callerProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (profileError || callerProfile?.role !== "admin") {
      return json({ error: "Solo un administrador puede gestionar usuarios." }, 403);
    }

    const body = await req.json();
    const action = String(body?.action || "");

    if (action === "list") {
      const [{ data: profiles, error: profilesError }, { data: authUsers, error: usersError }] = await Promise.all([
        adminClient.from("profiles").select("user_id, role, created_at").in("role", ["admin", "editor"]),
        adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ]);
      if (profilesError) throw profilesError;
      if (usersError) throw usersError;
      const userById = new Map<string, string>((authUsers.users || []).map((u) => [u.id, u.email || ""] as [string, string]));
      const members = (profiles || []).map((p) => {
        return {
          user_id: p.user_id,
          email: userById.get(p.user_id) || "Correo no disponible",
          role: p.role,
          created_at: p.created_at,
          is_current_user: p.user_id === authData.user.id,
        };
      });
      return json({ members });
    }

    if (action === "invite") {
      const email = String(body?.email || "").trim().toLowerCase();
      const role = String(body?.role || "editor");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Escribe un correo válido." }, 400);
      if (!allowedRoles.has(role)) return json({ error: "El rol debe ser administrador o editor." }, 400);

      const { data: authUsers, error: usersError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (usersError) throw usersError;
      const existing = (authUsers.users || []).find((u) => (u.email || "").toLowerCase() === email);

      if (existing) {
        const { error: upsertError } = await adminClient.from("profiles").upsert(
          { user_id: existing.id, role }, { onConflict: "user_id" },
        );
        if (upsertError) throw upsertError;
        return json({ message: `La cuenta ${email} ya existía. Se asignó el rol ${role === "admin" ? "administrador" : "editor"}.`, invited: false });
      }

      const siteUrl = Deno.env.get("SITE_URL") || req.headers.get("origin") || "";
      const inviteOptions = siteUrl ? { redirectTo: `${siteUrl.replace(/\/$/, "")}/admin.html` } : {};
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, inviteOptions);
      if (inviteError) throw inviteError;
      if (!inviteData.user) throw new Error("Supabase no devolvió el usuario invitado.");

      const { error: upsertError } = await adminClient.from("profiles").upsert(
        { user_id: inviteData.user.id, role }, { onConflict: "user_id" },
      );
      if (upsertError) throw upsertError;
      return json({ message: `Invitación enviada a ${email}. Cuando acepte, podrá entrar como ${role === "admin" ? "administrador" : "editor"}.`, invited: true });
    }

    if (action === "update_role") {
      const userId = String(body?.user_id || "");
      const role = String(body?.role || "");
      if (!userId || !allowedRoles.has(role)) return json({ error: "Usuario o rol no válido." }, 400);
      if (userId === authData.user.id) return json({ error: "No puedes cambiar tu propio rol desde esta pantalla." }, 400);

      const { data: target, error: targetError } = await adminClient.from("profiles")
        .select("role").eq("user_id", userId).maybeSingle();
      if (targetError) throw targetError;
      if (!target) return json({ error: "No se encontró el perfil del usuario." }, 404);
      if (target.role === "admin" && role !== "admin") {
        const { count, error: countError } = await adminClient.from("profiles")
          .select("user_id", { count: "exact", head: true }).eq("role", "admin");
        if (countError) throw countError;
        if ((count || 0) <= 1) return json({ error: "Debe permanecer al menos un administrador." }, 400);
      }
      const { error } = await adminClient.from("profiles").update({ role }).eq("user_id", userId);
      if (error) throw error;
      return json({ message: "Permisos actualizados." });
    }

    if (action === "remove") {
      const userId = String(body?.user_id || "");
      if (!userId) return json({ error: "Usuario no válido." }, 400);
      if (userId === authData.user.id) return json({ error: "No puedes quitarte tu propio acceso." }, 400);
      const { data: target, error: targetError } = await adminClient.from("profiles")
        .select("role").eq("user_id", userId).maybeSingle();
      if (targetError) throw targetError;
      if (!target) return json({ error: "No se encontró el usuario del equipo." }, 404);
      if (target.role === "admin") {
        const { count, error: countError } = await adminClient.from("profiles")
          .select("user_id", { count: "exact", head: true }).eq("role", "admin");
        if (countError) throw countError;
        if ((count || 0) <= 1) return json({ error: "No puedes eliminar al último administrador." }, 400);
      }
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) throw error;
      return json({ message: "Acceso del usuario eliminado." });
    }

    return json({ error: "Acción no reconocida." }, 400);
  } catch (error) {
    console.error("manage-team error:", error);
    return json({ error: error instanceof Error ? error.message : "Ocurrió un error al gestionar el equipo." }, 500);
  }
});
