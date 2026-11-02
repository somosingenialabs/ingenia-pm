import type { ClienteSupabase, PersonaRef, Ref } from "@/lib/data/comun";
import { aPersona, SELECT_PERSONA, type PerfilCrudo } from "@/lib/data/proyectos/consultas";
import type { EstadoTarea, Prioridad } from "@/lib/validaciones/tareas";

export type TareaFila = {
  id: string;
  proyecto_id: string;
  proyecto: Ref;
  titulo: string;
  descripcion: string | null;
  estado: EstadoTarea;
  prioridad: Prioridad;
  asignado: PersonaRef | null;
  fecha_inicio: string | null;
  fecha_limite: string | null;
  horas_estimadas: number | null;
  posicion: number;
};

// Una tarea de un proyecto borrado tampoco existe: por eso el !inner y el filtro de proyecto.
export const SELECT_TAREA = `id, proyecto_id, titulo, descripcion, estado, prioridad, fecha_inicio, fecha_limite, horas_estimadas, posicion,
  asignado:miembros!tareas_organizacion_id_asignado_id_fkey(${SELECT_PERSONA}),
  proyecto:proyectos!tareas_organizacion_id_proyecto_id_fkey!inner(id, nombre, estado, eliminado_en)`;

export type TareaCruda = Omit<TareaFila, "asignado" | "proyecto"> & {
  asignado: { perfil: PerfilCrudo | null } | null;
  proyecto: { id: string; nombre: string };
};

export function aTarea(fila: TareaCruda): TareaFila {
  return {
    ...fila,
    asignado: aPersona(fila.asignado?.perfil),
    proyecto: { id: fila.proyecto.id, nombre: fila.proyecto.nombre },
  };
}

export type FiltrosTareas = {
  estado?: EstadoTarea;
  asignadoId?: string;
  prioridad?: Prioridad;
};

export async function listarTareasDeProyecto(db: ClienteSupabase, id: string, filtros: FiltrosTareas = {}): Promise<TareaFila[]> {
  let consulta = db
    .from("tareas")
    .select(SELECT_TAREA)
    .eq("proyecto_id", id)
    .is("eliminado_en", null)
    .is("proyecto.eliminado_en", null)
    .order("posicion")
    .order("id");
  if (filtros.estado) consulta = consulta.eq("estado", filtros.estado);
  if (filtros.asignadoId) consulta = consulta.eq("asignado_id", filtros.asignadoId);
  if (filtros.prioridad) consulta = consulta.eq("prioridad", filtros.prioridad);

  const { data, error } = await consulta;
  if (error) throw error;
  return (data as unknown as TareaCruda[]).map(aTarea);
}

/**
 * Tareas abiertas a mi nombre. Un proyecto terminado o cancelado no tiene más trabajo: si le
 * quedó una tarea abierta, no sigue apareciendo como vencida para siempre.
 */
export async function listarMisTareas(db: ClienteSupabase, usuarioId: string): Promise<TareaFila[]> {
  const { data, error } = await db
    .from("tareas")
    .select(SELECT_TAREA)
    .eq("asignado_id", usuarioId)
    .is("eliminado_en", null)
    .is("proyecto.eliminado_en", null)
    .not("proyecto.estado", "in", "(terminado,cancelado)")
    .not("estado", "in", "(hecha,cancelada)")
    .order("fecha_limite", { nullsFirst: false })
    .order("posicion");
  if (error) throw error;
  return (data as unknown as TareaCruda[]).map(aTarea);
}

/** Null si no existe, está borrada o el RLS no la deja ver. */
export async function obtenerTarea(db: ClienteSupabase, id: string): Promise<TareaFila | null> {
  const { data, error } = await db
    .from("tareas")
    .select(SELECT_TAREA)
    .eq("id", id)
    .is("eliminado_en", null)
    .is("proyecto.eliminado_en", null)
    .maybeSingle();
  if (error) {
    if (error.code === "22P02") return null;
    throw error;
  }
  return data ? aTarea(data as unknown as TareaCruda) : null;
}

/** Para la paleta de comandos. Los comodines de ILIKE se escapan: "100%" busca "100%". */
export async function buscarTareas(db: ClienteSupabase, texto: string, limite = 8): Promise<(Ref & { proyectoId: string })[]> {
  const patron = `%${texto.replace(/[\\%_]/g, "\\$&")}%`;
  const { data, error } = await db
    .from("tareas")
    .select("id, titulo, proyecto_id, proyecto:proyectos!tareas_organizacion_id_proyecto_id_fkey!inner(id)")
    .ilike("titulo", patron)
    .is("eliminado_en", null)
    .is("proyecto.eliminado_en", null)
    .order("actualizado_en", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []).map((t) => ({ id: t.id, nombre: t.titulo, proyectoId: t.proyecto_id }));
}
