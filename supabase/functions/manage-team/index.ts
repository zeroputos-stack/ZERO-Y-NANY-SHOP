
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método no permitido." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "Faltan secretos de Supabase." }, 500);
    }

    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");

    if (!token) {
      return json({ error: "Inicia sesión para continuar." }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } =
      await callerClient.auth.getUser(token);

    if (authError || !authData.user) {
      return json({ error: "La sesión no es válida." }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerProfile, error: profileError } =
      await adminClient
        .from("profiles")
        .select("role")
        .eq("user_id", authData.user.id)
        .maybeSingle();

    if (profileError || callerProfile?.role !== "admin") {
      return json({
        error: "Solo un administrador puede gestionar usuarios."
      }, 403);
    }

    const body = await req.json();
    const action = String(body?.action || "");

    // =====================================
    // 1. LISTAR ADMINISTRADORES Y EDITORES
    // =====================================

    if (action === "list") {
      const [{ data: profiles, error: profilesError },
        { data: authUsers, error: usersError }] = await Promise.all([
        adminClient.from("profiles")
          .select("user_id, role, created_at")
          .in("role", ["admin", "editor"]),
        adminClient.auth.admin.listUsers({
          page: 1,
          perPage: 1000
        })
      ]);

      if (profilesError) throw profilesError;
      if (usersError) throw usersError;

      const userById = new Map(
        (authUsers.users || []).map(u => [u.id, u])
      );

      const users = (profiles || []).map(p => {
        const u = userById.get(p.user_id);
        const metadata = u?.user_metadata || {};

        return {
          id: p.user_id,
          user_id: p.user_id,
          email: u?.email || "Correo no disponible",
          name: String(
            metadata.full_name ||
            metadata.name ||
            metadata.username ||
            ""
          ),
          phone: u?.phone || String(metadata.phone || ""),
          role: p.role,
          confirmed: !!(
            u?.email_confirmed_at ||
            u?.phone_confirmed_at
          ),
          created_at: p.created_at,
          is_current_user: p.user_id === authData.user.id
        };
      });

      return json({ users, members: users });
    }

    // =====================================
    // 2. LISTAR TODOS LOS USUARIOS REGISTRADOS
    // =====================================

    if (action === "list-users" || action === "list_users") {
      const [{ data: authUsers, error: usersError },
        { data: profiles, error: profilesError }] = await Promise.all([
        adminClient.auth.admin.listUsers({
          page: 1,
          perPage: 1000
        }),
        adminClient.from("profiles")
          .select("user_id, role, created_at")
      ]);

      if (usersError) throw usersError;
      if (profilesError) throw profilesError;

      const profileById = new Map(
        (profiles || []).map(p => [p.user_id, p])
      );

      const users = (authUsers.users || []).map(u => {
        const profile = profileById.get(u.id);
        const metadata = u.user_metadata || {};

        return {
          id: u.id,
          user_id: u.id,
          name: String(
            metadata.full_name ||
            metadata.name ||
            metadata.username ||
            ""
          ),
          email: u.email || "",
          phone: u.phone || String(metadata.phone || ""),
          role: profile?.role || "user",
          confirmed: !!(
            u.email_confirmed_at ||
            u.phone_confirmed_at
          ),
          email_confirmed: !!u.email_confirmed_at,
          phone_confirmed: !!u.phone_confirmed_at,
          created_at: u.created_at,
          is_current_user: u.id === authData.user.id
        };
      });

      users.sort((a, b) =>
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      );

      return json({ users });
    }

    // =====================================
    // 3. INVITAR ADMINISTRADOR O EDITOR
    // =====================================

    if (action === "invite") {
      const email = String(body?.email || "")
        .trim().toLowerCase();

      const role = String(body?.role || "editor");

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: "Escribe un correo válido." }, 400);
      }

      if (!allowedRoles.has(role)) {
        return json({ error: "Rol no válido." }, 400);
      }

      const { data: authUsers, error: usersError } =
        await adminClient.auth.admin.listUsers({
          page: 1,
          perPage: 1000
        });

      if (usersError) throw usersError;

      const existing = (authUsers.users || []).find(
        u => (u.email || "").toLowerCase() === email
      );

      if (existing) {
        const { error } = await adminClient
          .from("profiles")
          .upsert(
            { user_id: existing.id, role },
            { onConflict: "user_id" }
          );

        if (error) throw error;

        return json({
          message: `Se asignó el rol ${role} a ${email}.`,
          invited: false
        });
      }

      const siteUrl =
        Deno.env.get("SITE_URL") ||
        req.headers.get("origin") || "";

      const inviteOptions = siteUrl
        ? {
            redirectTo:
              `${siteUrl.replace(/\/$/, "")}/admin.html`
          }
        : {};

      const { data: inviteData, error: inviteError } =
        await adminClient.auth.admin.inviteUserByEmail(
          email,
          inviteOptions
        );

      if (inviteError) throw inviteError;
      if (!inviteData.user) {
        throw new Error("No se pudo crear la invitación.");
      }

      const { error } = await adminClient
        .from("profiles")
        .upsert(
          { user_id: inviteData.user.id, role },
          { onConflict: "user_id" }
        );

      if (error) throw error;

      return json({
        message: `Invitación enviada a ${email}.`,
        invited: true
      });
    }

    // =====================================
    // 4. CAMBIAR ROL DE USUARIO
    // =====================================

    if (action === "update_role" || action === "set-role") {
      const userId = String(body?.user_id || "");
      const role = String(body?.role || "");

      if (!userId || !allowedRoles.has(role)) {
        return json({ error: "Usuario o rol no válido." }, 400);
      }

      if (userId === authData.user.id) {
        return json({
          error: "No puedes cambiar tu propio rol."
        }, 400);
      }

      const { data: target, error: targetError } =
        await adminClient.from("profiles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();

      if (targetError) throw targetError;
      if (!target) {
        return json({ error: "No se encontró el usuario." }, 404);
      }

      if (target.role === "admin" && role !== "admin") {
        const { count, error } = await adminClient
          .from("profiles")
          .select("user_id", {
            count: "exact",
            head: true
          })
          .eq("role", "admin");

        if (error) throw error;

        if ((count || 0) <= 1) {
          return json({
            error: "Debe permanecer al menos un administrador."
          }, 400);
        }
      }

      const { error } = await adminClient
        .from("profiles")
        .update({ role })
        .eq("user_id", userId);

      if (error) throw error;

      return json({ message: "Permisos actualizados." });
    }

    // =====================================
    // 5. RETIRAR ACCESO AL PANEL
    // =====================================

    if (action === "remove" || action === "revoke") {
      const userId = String(body?.user_id || "");

      if (!userId) {
        return json({ error: "Usuario no válido." }, 400);
      }

      if (userId === authData.user.id) {
        return json({
          error: "No puedes quitarte tu propio acceso."
        }, 400);
      }

      const { data: target, error: targetError } =
        await adminClient.from("profiles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();

      if (targetError) throw targetError;
      if (!target) {
        return json({ error: "No se encontró el usuario." }, 404);
      }

      if (target.role === "admin") {
        const { count, error } = await adminClient
          .from("profiles")
          .select("user_id", {
            count: "exact",
            head: true
          })
          .eq("role", "admin");

        if (error) throw error;

        if ((count || 0) <= 1) {
          return json({
            error: "No puedes eliminar al último administrador."
          }, 400);
        }
      }

      // Se elimina únicamente el perfil de acceso al panel.
      // La cuenta Auth del usuario se conserva.
      const { error } = await adminClient
        .from("profiles")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;

      return json({
        message: "Acceso administrativo retirado. La cuenta del usuario se conserva."
      });
    }

    // =====================================
    // 6. CAMBIAR CONTRASEÑA DE UN USUARIO
    // =====================================

    if (
      action === "reset_password" ||
      action === "reset-password" ||
      action === "set_password"
    ) {
      const userId = String(body?.user_id || "");
      const password = String(
        body?.new_password || body?.password || ""
      );

      if (!userId) {
        return json({ error: "Selecciona un usuario." }, 400);
      }

      if (userId === authData.user.id) {
        return json({
          error: "Para cambiar tu propia contraseña utiliza la configuración de tu cuenta."
        }, 400);
      }

      if (password.length < 8) {
        return json({
          error: "La contraseña debe tener al menos 8 caracteres."
        }, 400);
      }

      const { data: updatedUser, error } =
        await adminClient.auth.admin.updateUserById(
          userId,
          { password }
        );

      if (error) throw error;
      if (!updatedUser.user) {
        return json({
          error: "No se pudo actualizar la contraseña."
        }, 400);
      }

      return json({
        message: "Contraseña actualizada correctamente."
      });
    }

    return json({ error: "Acción no reconocida." }, 400);

  } catch (error) {
    console.error("manage-team error:", error);

    return json({
      error: error instanceof Error
        ? error.message
        : "Ocurrió un error al gestionar el equipo."
    }, 500);
  }
});
