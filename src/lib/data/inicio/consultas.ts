import type { ClienteSupabase } from "@/lib/data/comun";
import { listarProyectos, type ProyectoFila } from "@/lib/data/proyectos/consultas";
import { aTarea, SELECT_TAREA, type TareaCruda, type TareaFila } from "@/lib/data/tareas/consultas";
import { sumarDias } from "@/lib/fechas";

// Una función por tarjeta del inicio. Cada una falla o tarda por su cuenta.

export type QuienConsulta = { usuarioId: string; hoy: string };

export const DIAS_PROXIMOS_PLAZOS = 7;
const MAXIMO_POR_TARJETA = 8;

/** Tareas vigentes: ni borradas, ni cerradas, ni de un proyecto borrado, terminado o cancelado. */
function contarAbiertas(db: ClienteSupabase) {
  return db
    .from("tareas")
    .select("id, proyecto:proyectos!tareas_organizacion_id_proyecto_id_fkey!inner(id)", { count: "exact", head: true })
    .is("eliminado_en", null)
    .is("proyecto.eliminado_en", null)
    .not("proyecto.estado", "in", "(terminado,cancelado)")
    .not("estado", "in", "(hecha,cancelada)");
}

function listarAbiertas(db: ClienteSupabase) {
  return db
    .from("tareas")
    .select(SELECT_TAREA)
    .is("eliminado_en", null)
    .is("proyecto.eliminado_en", null)
    .not("proyecto.estado", "in", "(terminado,cancelado)")
    .not("estado", "in", "(hecha,cancelada)");
}

function cantidad({ count, error }: { count: number | null; error: unknown }): number {
  if (error) throw error;
  return count ?? 0;
}

export async function contarVencidas(db: ClienteSupabase, { usuarioId, hoy }: QuienConsulta): Promise<number> {
  return cantidad(await contarAbiertas(db).eq("asignado_id", usuarioId).lt("fecha_limite", hoy));
}

export async function contarParaHoy(db: ClienteSupabase, { usuarioId, hoy }: QuienConsulta): Promise<number> {
  return cantidad(await contarAbiertas(db).eq("asignado_id", usuarioId).eq("fecha_limite", hoy));
}

export async function contarEnCurso(db: ClienteSupabase, { usuarioId }: Pick<QuienConsulta, "usuarioId">): Promise<number> {
  return cantidad(await contarAbiertas(db).eq("asignado_id", usuarioId).eq("estado", "en_curso"));
}

/** Solo tiene sentido para Admin y PM, pero el RLS es el que limita qué cuenta. */
export async function contarSinAsignar(db: ClienteSupabase): Promise<number> {
  return cantidad(await contarAbiertas(db).is("asignado_id", null));
}

export async function contarProyectosActivos(db: ClienteSupabase): Promise<number> {
  const { count, error } = await db
    .from("proyectos")
    .select("id", { count: "exact", head: true })
    .is("eliminado_en", null)
    .eq("estado", "activo");
  return cantidad({ count, error });
}

/** Tareas abiertas de los proyectos visibles que vencen de hoy a 7 días. */
export async function listarProximosPlazos(db: ClienteSupabase, hoy: string): Promise<TareaFila[]> {
  const { data, error } = await listarAbiertas(db)
    .gte("fecha_limite", hoy)
    .lte("fecha_limite", sumarDias(hoy, DIAS_PROXIMOS_PLAZOS))
    .order("fecha_limite")
    .order("id")
    .limit(MAXIMO_POR_TARJETA);
  if (error) throw error;
  return (data as unknown as TareaCruda[]).map(aTarea);
}

export async function listarProyectosActivos(db: ClienteSupabase, hoy: string): Promise<ProyectoFila[]> {
  const proyectos = await listarProyectos(db, { hoy, estados: ["activo"] });
  return proyectos.slice(0, MAXIMO_POR_TARJETA);
}

/** Mis tareas abiertas que vencen entre esos días. */
export async function listarMiSemana(db: ClienteSupabase, usuarioId: string, dias: readonly string[]): Promise<TareaFila[]> {
  const { data, error } = await listarAbiertas(db)
    .eq("asignado_id", usuarioId)
    .gte("fecha_limite", dias[0]!)
    .lte("fecha_limite", dias.at(-1)!)
    .order("fecha_limite")
    .order("posicion");
  if (error) throw error;
  return (data as unknown as TareaCruda[]).map(aTarea);
}
