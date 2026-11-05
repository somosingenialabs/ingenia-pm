"use server";

import { revalidatePath } from "next/cache";
import type { Resultado } from "@/lib/data/comun";
import { errorDeBase, errorDeValidacion, SIN_FILAS } from "@/lib/data/errores";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esquemaFechasTarea } from "@/lib/validaciones/tareas";
import { textoConflicto } from "./reglas";

/**
 * Cambia las fechas de una tarea desde el calendario. Solo gestor: quien no lo es choca con
 * `app.proteger_tarea`. Si el cambio deja una dependencia en conflicto, se guarda igual y vuelve
 * el aviso. No mueve otras tareas.
 */
export async function moverTareaEnCalendario(datos: unknown): Promise<Resultado<{ avisos: string[] }>> {
  const validado = esquemaFechasTarea.safeParse(datos);
  if (!validado.success) return errorDeValidacion(validado.error);
  const { id, ...fechas } = validado.data;
  const cambios = fechas.fecha_inicio === undefined ? { fecha_limite: fechas.fecha_limite } : fechas;

  const db = await crearClienteServidor();
  const { data, error } = await db.from("tareas").update(cambios).eq("id", id).is("eliminado_en", null).select("proyecto_id");
  if (error) return errorDeBase(error, "moverTareaEnCalendario");
  if (data.length === 0) return SIN_FILAS;
  const proyectoId = data[0]!.proyecto_id;

  revalidatePath(`/proyectos/${proyectoId}`);
  revalidatePath("/mis-tareas");
  revalidatePath("/inicio");

  // El aviso es un extra: si falla la consulta, el movimiento ya quedó guardado.
  const { data: conflictos } = await db.rpc("conflictos_dependencias", { p_proyecto: proyectoId });
  const propios = (conflictos ?? []).filter((c) => c.tarea_id === id || c.depende_de_id === id);
  if (propios.length === 0) return { ok: true, datos: { avisos: [] } };

  const ids = [...new Set(propios.flatMap((c) => [c.tarea_id, c.depende_de_id]))];
  const { data: tareas } = await db.from("tareas").select("id, titulo").in("id", ids);
  const titulos = Object.fromEntries((tareas ?? []).map((t) => [t.id, t.titulo]));
  return {
    ok: true,
    datos: { avisos: propios.map((c) => textoConflicto(id, { tareaId: c.tarea_id, dependeDeId: c.depende_de_id }, titulos)) },
  };
}
