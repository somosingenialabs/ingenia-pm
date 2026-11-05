"use server";

import { obtenerContexto } from "@/lib/auth/contexto";
import type { Resultado } from "@/lib/data/comun";
import { errorDeBase, errorDeValidacion, SIN_FILAS } from "@/lib/data/errores";
import type { Database } from "@/lib/supabase/database.types";
import { crearClienteServidor } from "@/lib/supabase/server";
import { idValido } from "@/lib/validaciones/comun";
import { esquemaDetener, esquemaEdicionRegistro, esquemaRegistroManual } from "@/lib/validaciones/tiempo";

type InsertRegistro = Database["public"]["Tables"]["registros_tiempo"]["Insert"];

// Sin revalidatePath: las horas se leen desde el navegador con TanStack Query, y la pantalla
// invalida sus consultas después de cada acción.
// El temporizador pasa por las funciones de la base: la hora es siempre la del servidor.

/** Detiene el que esté corriendo y prende uno en esta tarea. */
export async function iniciarTemporizador(tareaId: string): Promise<Resultado> {
  const idOk = idValido.safeParse(tareaId);
  if (!idOk.success) return errorDeValidacion(idOk.error);

  const db = await crearClienteServidor();
  const { error } = await db.rpc("iniciar_temporizador", { p_tarea: tareaId });
  if (error) return errorDeBase(error, "iniciarTemporizador");
  return { ok: true, datos: undefined };
}

/** `minutos` corrige lo medido: la base lo exige si pasaron más de 24 h. */
export async function detenerTemporizador(datos: unknown = {}): Promise<Resultado<{ minutos: number }>> {
  const validado = esquemaDetener.safeParse(datos);
  if (!validado.success) return errorDeValidacion(validado.error);

  const db = await crearClienteServidor();
  const { data, error } = await db.rpc("detener_temporizador", {
    ...(validado.data.minutos ? { p_minutos: validado.data.minutos } : {}),
    ...(validado.data.nota ? { p_nota: validado.data.nota } : {}),
  });
  if (error) return errorDeBase(error, "detenerTemporizador");
  return { ok: true, datos: { minutos: data.minutos ?? 0 } };
}

export async function descartarTemporizador(): Promise<Resultado> {
  const db = await crearClienteServidor();
  const { error } = await db.rpc("descartar_temporizador");
  if (error) return errorDeBase(error, "descartarTemporizador");
  return { ok: true, datos: undefined };
}

/** Carga manual, siempre a nombre propio (el RLS no deja otra cosa). */
export async function crearRegistro(datos: unknown): Promise<Resultado> {
  const validado = esquemaRegistroManual.safeParse(datos);
  if (!validado.success) return errorDeValidacion(validado.error);

  const { usuario, organizacion } = await obtenerContexto();
  const db = await crearClienteServidor();
  const { tarea_id, fecha, duracion, nota } = validado.data;
  const fila = {
    organizacion_id: organizacion.id,
    usuario_id: usuario.id,
    tarea_id,
    fecha,
    minutos: duracion,
    nota: nota ?? null,
    origen: "manual",
  } satisfies Omit<InsertRegistro, "proyecto_id">;
  // proyecto_id lo copia la base desde la tarea (app.registro_completar); el tipo generado lo pide igual.
  const { error } = await db.from("registros_tiempo").insert(fila as InsertRegistro);
  if (error) return errorDeBase(error, "crearRegistro");
  return { ok: true, datos: undefined };
}

/**
 * El propio, o cualquiera si sos Admin (RLS). Un registro de temporizador conserva su inicio y
 * su fin: cambiar los minutos lo corrige, pero no inventa otro horario.
 */
export async function editarRegistro(datos: unknown): Promise<Resultado> {
  const validado = esquemaEdicionRegistro.safeParse(datos);
  if (!validado.success) return errorDeValidacion(validado.error);

  const db = await crearClienteServidor();
  const { id, tarea_id, fecha, duracion, nota } = validado.data;
  const { data, error } = await db
    .from("registros_tiempo")
    .update({ tarea_id, fecha, minutos: duracion, nota: nota ?? null })
    .eq("id", id)
    // El que corre se cierra con detener, no desde acá.
    .not("minutos", "is", null)
    .select("id");
  if (error) return errorDeBase(error, "editarRegistro");
  if (data.length === 0) return SIN_FILAS;
  return { ok: true, datos: undefined };
}

export async function eliminarRegistro(id: string): Promise<Resultado> {
  const idOk = idValido.safeParse(id);
  if (!idOk.success) return errorDeValidacion(idOk.error);

  const db = await crearClienteServidor();
  const { data, error } = await db.from("registros_tiempo").delete().eq("id", id).select("id");
  if (error) return errorDeBase(error, "eliminarRegistro");
  if (data.length === 0) return SIN_FILAS;
  return { ok: true, datos: undefined };
}
