"use server";

import { revalidatePath } from "next/cache";
import { obtenerContexto } from "@/lib/auth/contexto";
import { puedeCrearProyecto } from "@/lib/auth/permisos";
import type { Resultado } from "@/lib/data/comun";
import { errorDeBase, errorDeValidacion, SIN_FILAS } from "@/lib/data/errores";
import { crearClienteServidor } from "@/lib/supabase/server";
import { idValido } from "@/lib/validaciones/comun";
import { esquemaMiembroProyecto, esquemaProyecto } from "@/lib/validaciones/proyectos";

function revalidarProyecto(id?: string) {
  revalidatePath("/proyectos");
  revalidatePath("/inicio");
  if (id) revalidatePath(`/proyectos/${id}`);
}

export async function crearProyecto(datos: unknown): Promise<Resultado<{ id: string }>> {
  const validado = esquemaProyecto.safeParse(datos);
  if (!validado.success) return errorDeValidacion(validado.error);

  const { organizacion, rol } = await obtenerContexto();
  if (!puedeCrearProyecto(rol)) return { ok: false, error: "No tenés permiso para crear proyectos." };

  const db = await crearClienteServidor();
  const { data, error } = await db
    .from("proyectos")
    .insert({ ...validado.data, organizacion_id: organizacion.id })
    .select("id")
    .single();
  if (error) return errorDeBase(error, "crearProyecto");

  revalidarProyecto();
  return { ok: true, datos: { id: data.id } };
}

export async function editarProyecto(id: string, datos: unknown): Promise<Resultado> {
  const idOk = idValido.safeParse(id);
  if (!idOk.success) return errorDeValidacion(idOk.error);
  const validado = esquemaProyecto.safeParse(datos);
  if (!validado.success) return errorDeValidacion(validado.error);

  const db = await crearClienteServidor();
  const { data, error } = await db.from("proyectos").update(validado.data).eq("id", id).is("eliminado_en", null).select("id");
  if (error) return errorDeBase(error, "editarProyecto");
  if (data.length === 0) return SIN_FILAS;

  revalidarProyecto(id);
  return { ok: true, datos: undefined };
}

/** Borrado lógico. Solo Admin: lo hace cumplir `app.proteger_proyecto`. */
export async function eliminarProyecto(id: string): Promise<Resultado> {
  const idOk = idValido.safeParse(id);
  if (!idOk.success) return errorDeValidacion(idOk.error);

  const db = await crearClienteServidor();
  const { data, error } = await db
    .from("proyectos")
    .update({ eliminado_en: new Date().toISOString() })
    .eq("id", id)
    .is("eliminado_en", null)
    .select("id");
  if (error) return errorDeBase(error, "eliminarProyecto");
  if (data.length === 0) return SIN_FILAS;

  revalidarProyecto(id);
  return { ok: true, datos: undefined };
}

export async function agregarMiembro(datos: unknown): Promise<Resultado> {
  const validado = esquemaMiembroProyecto.safeParse(datos);
  if (!validado.success) return errorDeValidacion(validado.error);

  const { organizacion } = await obtenerContexto();
  const db = await crearClienteServidor();
  const { error } = await db.from("proyecto_miembros").insert({
    organizacion_id: organizacion.id,
    proyecto_id: validado.data.proyectoId,
    usuario_id: validado.data.usuarioId,
  });
  if (error) return errorDeBase(error, "agregarMiembro");

  revalidarProyecto(validado.data.proyectoId);
  return { ok: true, datos: undefined };
}

/**
 * Si la persona tiene tareas abiertas en el proyecto, no la quita y devuelve cuántas son, para
 * que la pantalla pida reasignarlas. La base no lo impediría: quedarían a su nombre.
 */
export async function quitarMiembro(datos: unknown): Promise<Resultado<{ quitado: boolean; tareasAbiertas: number }>> {
  const validado = esquemaMiembroProyecto.safeParse(datos);
  if (!validado.success) return errorDeValidacion(validado.error);
  const { proyectoId, usuarioId } = validado.data;

  const db = await crearClienteServidor();
  const { data: proyecto, error: errorProyecto } = await db
    .from("proyectos")
    .select("responsable_id")
    .eq("id", proyectoId)
    .maybeSingle();
  if (errorProyecto) return errorDeBase(errorProyecto, "quitarMiembro");
  if (proyecto?.responsable_id === usuarioId) {
    return { ok: false, error: "Es la persona responsable del proyecto. Cambiá el responsable antes de quitarla." };
  }

  const { count, error: errorConteo } = await db
    .from("tareas")
    .select("id", { count: "exact", head: true })
    .eq("proyecto_id", proyectoId)
    .eq("asignado_id", usuarioId)
    .is("eliminado_en", null)
    .not("estado", "in", "(hecha,cancelada)");
  if (errorConteo) return errorDeBase(errorConteo, "quitarMiembro");
  if (count) return { ok: true, datos: { quitado: false, tareasAbiertas: count } };

  const { data, error } = await db
    .from("proyecto_miembros")
    .delete()
    .eq("proyecto_id", proyectoId)
    .eq("usuario_id", usuarioId)
    .select("usuario_id");
  if (error) return errorDeBase(error, "quitarMiembro");
  if (data.length === 0) return SIN_FILAS;

  revalidarProyecto(proyectoId);
  return { ok: true, datos: { quitado: true, tareasAbiertas: 0 } };
}
