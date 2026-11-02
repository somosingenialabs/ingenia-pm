"use server";

import { revalidatePath } from "next/cache";
import { obtenerContexto } from "@/lib/auth/contexto";
import { puedeConfigurar } from "@/lib/auth/permisos";
import type { Resultado } from "@/lib/data/comun";
import { errorDeBase, errorDeValidacion, SIN_FILAS } from "@/lib/data/errores";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esquemaOrganizacion, esquemaPerfil } from "@/lib/validaciones/configuracion";

// Perfil y empresa. Los archivos los sube el navegador directo a Storage, donde rige la política
// de cada carpeta; acá se recibe la ruta y se arma la URL. Una URL armada por el cliente podría
// apuntar a cualquier lado.

async function urlPublica(ruta: string | null, usuarioId: string): Promise<{ url: string | null } | null> {
  if (ruta === null) return { url: null };
  if (!ruta.startsWith(`${usuarioId}/`) || ruta.includes("..")) return null;
  const db = await crearClienteServidor();
  return { url: db.storage.from("avatares").getPublicUrl(ruta).data.publicUrl };
}

export async function guardarPerfil(datos: unknown): Promise<Resultado> {
  const validado = esquemaPerfil.safeParse(datos);
  if (!validado.success) return errorDeValidacion(validado.error);

  const { usuario } = await obtenerContexto();
  const db = await crearClienteServidor();
  const { data, error } = await db.from("perfiles").update(validado.data).eq("id", usuario.id).select("id");
  if (error) return errorDeBase(error, "guardarPerfil");
  if (data.length === 0) return SIN_FILAS;

  revalidatePath("/", "layout");
  return { ok: true, datos: undefined };
}

/** `ruta` es dentro del bucket: `<mi id>/...`. Null saca el avatar. */
export async function guardarAvatar(ruta: string | null): Promise<Resultado> {
  const { usuario } = await obtenerContexto();
  const destino = await urlPublica(ruta, usuario.id);
  if (!destino) return { ok: false, error: "No pudimos guardar esa imagen." };

  const db = await crearClienteServidor();
  const { data, error } = await db.from("perfiles").update({ avatar_url: destino.url }).eq("id", usuario.id).select("id");
  if (error) return errorDeBase(error, "guardarAvatar");
  if (data.length === 0) return SIN_FILAS;

  revalidatePath("/", "layout");
  return { ok: true, datos: undefined };
}

export async function guardarOrganizacion(datos: unknown): Promise<Resultado> {
  const validado = esquemaOrganizacion.safeParse(datos);
  if (!validado.success) return errorDeValidacion(validado.error);

  const { organizacion, rol } = await obtenerContexto();
  if (!puedeConfigurar(rol)) return { ok: false, error: "Solo un Admin puede cambiar los datos de la empresa." };

  const db = await crearClienteServidor();
  const { data, error } = await db.from("organizaciones").update(validado.data).eq("id", organizacion.id).select("id");
  if (error) return errorDeBase(error, "guardarOrganizacion");
  if (data.length === 0) return SIN_FILAS;

  revalidatePath("/", "layout");
  return { ok: true, datos: undefined };
}

/** El logo se sube a la carpeta del Admin que lo elige. Null lo saca. */
export async function guardarLogo(ruta: string | null): Promise<Resultado> {
  const { usuario, organizacion, rol } = await obtenerContexto();
  if (!puedeConfigurar(rol)) return { ok: false, error: "Solo un Admin puede cambiar los datos de la empresa." };
  const destino = await urlPublica(ruta, usuario.id);
  if (!destino) return { ok: false, error: "No pudimos guardar esa imagen." };

  const db = await crearClienteServidor();
  const { data, error } = await db.from("organizaciones").update({ logo_url: destino.url }).eq("id", organizacion.id).select("id");
  if (error) return errorDeBase(error, "guardarLogo");
  if (data.length === 0) return SIN_FILAS;

  revalidatePath("/", "layout");
  return { ok: true, datos: undefined };
}
