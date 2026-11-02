import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Contexto, Rol } from "./tipos";

/**
 * Usuario, empresa activa y rol de quien hace el pedido. Una sola consulta por pedido
 * (cache de React). Sin sesión manda a /ingresar; sin empresa activa, a /sin-empresa.
 *
 * Ojo: esto ordena la navegación y la interfaz. La seguridad de los datos es el RLS.
 */
export const obtenerContexto = cache(async (): Promise<Contexto> => {
  const db = await crearClienteServidor();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: perfil } = await db
    .from("perfiles")
    .select("nombre_completo, avatar_url, organizacion_activa_id")
    .eq("id", user.id)
    .maybeSingle();
  const orgId = perfil?.organizacion_activa_id ?? null;
  if (!orgId) redirect("/sin-empresa");

  const [{ data: organizacion }, { data: miembro }] = await Promise.all([
    db.from("organizaciones").select("id, nombre, zona_horaria, logo_url, color_acento").eq("id", orgId).maybeSingle(),
    db.from("miembros").select("rol").eq("organizacion_id", orgId).eq("usuario_id", user.id).eq("activo", true).maybeSingle(),
  ]);
  if (!organizacion || !miembro) redirect("/sin-empresa");

  return {
    usuario: {
      id: user.id,
      email: user.email ?? null,
      nombre: perfil?.nombre_completo ?? user.email ?? "",
      avatarUrl: perfil?.avatar_url ?? null,
    },
    organizacion: {
      id: organizacion.id,
      nombre: organizacion.nombre,
      zonaHoraria: organizacion.zona_horaria,
      logoUrl: organizacion.logo_url,
      colorAcento: organizacion.color_acento,
    },
    rol: miembro.rol as Rol,
  };
});
