"use server";

import { revalidatePath } from "next/cache";
import { obtenerContexto } from "@/lib/auth/contexto";
import type { ClienteSupabase, Resultado } from "@/lib/data/comun";
import { errorDeBase, errorDeValidacion, SIN_FILAS } from "@/lib/data/errores";
import { crearClienteServidor } from "@/lib/supabase/server";
import { idValido } from "@/lib/validaciones/comun";
import { esquemaEdicionTarea, esquemaLoteTareas, esquemaMoverTarea, esquemaTarea, type EstadoTarea } from "@/lib/validaciones/tareas";
import { calcularPosicion } from "./reglas";

function revalidarTareas(proyectoId: string) {
  revalidatePath(`/proyectos/${proyectoId}`);
  revalidatePath("/proyectos");
  revalidatePath("/mis-tareas");
  revalidatePath("/inicio");
}

/** Última de la columna + 1000. */
async function posicionAlFinal(db: ClienteSupabase, proyectoId: string, estado: EstadoTarea): Promise<number> {
  const { data } = await db
    .from("tareas")
    .select("posicion")
    .eq("proyecto_id", proyectoId)
    .eq("estado", estado)
    .is("eliminado_en", null)
    .order("posicion", { ascending: false })
    .limit(1)
    .maybeSingle();
  return calcularPosicion(data?.posicion ?? null, null);
}

export async function crearTarea(datos: unknown): Promise<Resultado<{ id: string }>> {
  const validado = esquemaTarea.safeParse(datos);
  if (!validado.success) return errorDeValidacion(validado.error);

  const { organizacion } = await obtenerContexto();
  const db = await crearClienteServidor();
  const posicion = await posicionAlFinal(db, validado.data.proyecto_id, validado.data.estado);
  const { data, error } = await db
    .from("tareas")
    .insert({ ...validado.data, organizacion_id: organizacion.id, posicion })
    .select("id")
    .single();
  if (error) return errorDeBase(error, "crearTarea");

  revalidarTareas(validado.data.proyecto_id);
  return { ok: true, datos: { id: data.id } };
}

/**
 * Solo toca los campos que vienen. Quien no es gestor manda estado y descripción: el resto lo
 * rechazaría `app.proteger_tarea`. Si cambia el estado, va al final de su nueva columna.
 */
export async function editarTarea(id: string, datos: unknown): Promise<Resultado> {
  const idOk = idValido.safeParse(id);
  if (!idOk.success) return errorDeValidacion(idOk.error);
  const validado = esquemaEdicionTarea.safeParse(datos);
  if (!validado.success) return errorDeValidacion(validado.error);

  const db = await crearClienteServidor();
  const { data: actual, error: errorActual } = await db
    .from("tareas")
    .select("proyecto_id, estado, fecha_inicio, fecha_limite")
    .eq("id", id)
    .is("eliminado_en", null)
    .maybeSingle();
  if (errorActual) return errorDeBase(errorActual, "editarTarea");
  if (!actual) return SIN_FILAS;

  const cambios = Object.fromEntries(Object.entries(validado.data).filter(([, v]) => v !== undefined)) as typeof validado.data;
  const posicion =
    cambios.estado && cambios.estado !== actual.estado ? await posicionAlFinal(db, actual.proyecto_id, cambios.estado) : undefined;

  const { data, error } = await db
    .from("tareas")
    .update(posicion === undefined ? cambios : { ...cambios, posicion })
    .eq("id", id)
    .is("eliminado_en", null)
    .select("id");
  if (error) return errorDeBase(error, "editarTarea");
  if (data.length === 0) return SIN_FILAS;

  revalidarTareas(actual.proyecto_id);
  return { ok: true, datos: undefined };
}

/** La posición la calcula quien mueve, con `posicionAlSoltar`. Sin posición, va al final de la columna. */
export async function moverTarea(datos: unknown): Promise<Resultado> {
  const validado = esquemaMoverTarea.safeParse(datos);
  if (!validado.success) return errorDeValidacion(validado.error);
  const { id, estado } = validado.data;

  const db = await crearClienteServidor();
  const { data: actual, error: errorActual } = await db
    .from("tareas")
    .select("proyecto_id")
    .eq("id", id)
    .is("eliminado_en", null)
    .maybeSingle();
  if (errorActual) return errorDeBase(errorActual, "moverTarea");
  if (!actual) return SIN_FILAS;

  const posicion = validado.data.posicion ?? (await posicionAlFinal(db, actual.proyecto_id, estado));
  const { data, error } = await db.from("tareas").update({ estado, posicion }).eq("id", id).select("id");
  if (error) return errorDeBase(error, "moverTarea");
  if (data.length === 0) return SIN_FILAS;

  revalidarTareas(actual.proyecto_id);
  return { ok: true, datos: undefined };
}

/** Selección múltiple de la lista: estado o asignado de varias tareas de un proyecto. Solo gestor. */
export async function editarTareasEnLote(proyectoId: string, datos: unknown): Promise<Resultado<{ actualizadas: number }>> {
  const idOk = idValido.safeParse(proyectoId);
  if (!idOk.success) return errorDeValidacion(idOk.error);
  const validado = esquemaLoteTareas.safeParse(datos);
  if (!validado.success) return errorDeValidacion(validado.error);
  const { ids, ...cambios } = validado.data;

  const db = await crearClienteServidor();
  const { data, error } = await db
    .from("tareas")
    .update(cambios)
    .eq("proyecto_id", proyectoId)
    .in("id", ids)
    .is("eliminado_en", null)
    .select("id");
  if (error) return errorDeBase(error, "editarTareasEnLote");
  if (data.length === 0) return SIN_FILAS;

  revalidarTareas(proyectoId);
  return { ok: true, datos: { actualizadas: data.length } };
}

/** Borrado lógico. Solo gestor: lo hace cumplir `app.proteger_tarea`. */
export async function eliminarTarea(id: string): Promise<Resultado> {
  const idOk = idValido.safeParse(id);
  if (!idOk.success) return errorDeValidacion(idOk.error);

  const db = await crearClienteServidor();
  const { data, error } = await db
    .from("tareas")
    .update({ eliminado_en: new Date().toISOString() })
    .eq("id", id)
    .is("eliminado_en", null)
    .select("proyecto_id");
  if (error) return errorDeBase(error, "eliminarTarea");
  if (data.length === 0) return SIN_FILAS;

  revalidarTareas(data[0]!.proyecto_id);
  return { ok: true, datos: undefined };
}
