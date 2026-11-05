"use server";

import { revalidatePath } from "next/cache";
import { obtenerContexto } from "@/lib/auth/contexto";
import { textoConflicto } from "@/lib/data/calendario/reglas";
import type { ClienteSupabase, Resultado } from "@/lib/data/comun";
import { errorDeBase, errorDeValidacion, SIN_FILAS } from "@/lib/data/errores";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esquemaDependencia, esquemaQuitarDependencia } from "@/lib/validaciones/dependencias";

/** El tablero muestra "Bloqueada por": su página se vuelve a armar. Devuelve el proyecto. */
async function revalidarProyectoDe(db: ClienteSupabase, tareaId: string): Promise<string | null> {
  const { data } = await db.from("tareas").select("proyecto_id").eq("id", tareaId).maybeSingle();
  if (data) revalidatePath(`/proyectos/${data.proyecto_id}`);
  return data?.proyecto_id ?? null;
}

/**
 * Suma una dependencia. Solo gestor (RLS). Mismo proyecto y sin ciclos lo valida la base, con
 * mensajes propios. Si queda en conflicto con las fechas, se guarda igual y vuelve el aviso,
 * desde el punto de vista de `vista` (la tarea abierta en el detalle).
 */
export async function agregarDependencia(datos: unknown, vista: string): Promise<Resultado<{ avisos: string[] }>> {
  const validado = esquemaDependencia.safeParse(datos);
  if (!validado.success) return errorDeValidacion(validado.error);

  const { organizacion } = await obtenerContexto();
  const db = await crearClienteServidor();
  const { error } = await db.from("tarea_dependencias").insert({ ...validado.data, organizacion_id: organizacion.id });
  if (error) return errorDeBase(error, "agregarDependencia");
  const proyectoId = await revalidarProyectoDe(db, validado.data.tarea_id);
  if (!proyectoId) return { ok: true, datos: { avisos: [] } };

  // El aviso es un extra: si la consulta falla, la dependencia ya quedó guardada.
  const { data: conflictos } = await db.rpc("conflictos_dependencias", { p_proyecto: proyectoId });
  const propio = (conflictos ?? []).find((c) => c.tarea_id === validado.data.tarea_id && c.depende_de_id === validado.data.depende_de_id);
  if (!propio) return { ok: true, datos: { avisos: [] } };

  const { data: tareas } = await db.from("tareas").select("id, titulo").in("id", [propio.tarea_id, propio.depende_de_id]);
  const titulos = Object.fromEntries((tareas ?? []).map((t) => [t.id, t.titulo]));
  return { ok: true, datos: { avisos: [textoConflicto(vista, { tareaId: propio.tarea_id, dependeDeId: propio.depende_de_id }, titulos)] } };
}

export async function quitarDependencia(datos: unknown): Promise<Resultado> {
  const validado = esquemaQuitarDependencia.safeParse(datos);
  if (!validado.success) return errorDeValidacion(validado.error);

  const db = await crearClienteServidor();
  const { data, error } = await db
    .from("tarea_dependencias")
    .delete()
    .eq("tarea_id", validado.data.tarea_id)
    .eq("depende_de_id", validado.data.depende_de_id)
    .select("tarea_id");
  if (error) return errorDeBase(error, "quitarDependencia");
  if (data.length === 0) return SIN_FILAS;

  await revalidarProyectoDe(db, validado.data.tarea_id);
  return { ok: true, datos: undefined };
}
