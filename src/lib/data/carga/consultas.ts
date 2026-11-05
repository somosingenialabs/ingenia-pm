import type { ClienteSupabase } from "@/lib/data/comun";
import { listarMiembros } from "@/lib/data/miembros/consultas";
import { sumarDias } from "@/lib/fechas";
import type { EstadoTarea, Prioridad } from "@/lib/validaciones/tareas";
import { armarGrilla, semanasDesde, type FilaCarga, type PersonaCarga } from "./reglas";

export type Carga = { semanas: string[]; personas: PersonaCarga[] };

/**
 * Grilla de carga desde el lunes `desde`, 8 semanas. La cuenta la hace analitica.carga_por_persona
 * (security invoker): un colaborador recibe solo su fila.
 */
export async function obtenerCarga(
  db: ClienteSupabase,
  { organizacionId, desde, proyectoId }: { organizacionId: string; desde: string; proyectoId?: string | null },
): Promise<Carga> {
  const semanas = semanasDesde(desde);
  const hasta = sumarDias(semanas.at(-1)!, 6);
  const [filas, miembros] = await Promise.all([
    db.schema("analitica").rpc("carga_por_persona", { p_desde: desde, p_hasta: hasta, ...(proyectoId ? { p_proyecto: proyectoId } : {}) }),
    listarMiembros(db, organizacionId),
  ]);
  if (filas.error) throw filas.error;
  return { semanas, personas: armarGrilla(filas.data as FilaCarga[], miembros, semanas) };
}

export type TareaDeCarga = {
  id: string;
  titulo: string;
  proyectoNombre: string;
  estado: EstadoTarea;
  prioridad: Prioridad;
  fechaInicio: string | null;
  fechaLimite: string;
  horasEstimadas: number | null;
  /** Vencida y abierta: sus horas cayeron en hoy. */
  atrasada: boolean;
};

/**
 * Tareas que una persona tiene abiertas en una semana: las que suman a la celda, y las sin
 * estimar de esa semana, que no suman y por eso se muestran aparte. Mismo criterio que la función
 * de la base: abiertas, de proyectos no borrados ni cerrados.
 */
export async function listarTareasDeSemana(
  db: ClienteSupabase,
  { personaId, lunes, hoy, proyectoId }: { personaId: string; lunes: string; hoy: string; proyectoId?: string | null },
): Promise<TareaDeCarga[]> {
  const domingo = sumarDias(lunes, 6);
  // La semana de hoy también tiene las vencidas: la función de la base pone ahí sus horas.
  const esSemanaDeHoy = lunes <= hoy && hoy <= domingo;
  let consulta = db
    .from("tareas")
    .select(
      "id, titulo, estado, prioridad, fecha_inicio, fecha_limite, horas_estimadas, proyecto:proyectos!tareas_organizacion_id_proyecto_id_fkey!inner(nombre, estado, eliminado_en)",
    )
    .eq("asignado_id", personaId)
    .is("eliminado_en", null)
    .is("proyecto.eliminado_en", null)
    .not("proyecto.estado", "in", "(terminado,cancelado)")
    .in("estado", ["por_hacer", "en_curso", "en_revision"])
    .or(`fecha_inicio.lte.${domingo},and(fecha_inicio.is.null,fecha_limite.lte.${domingo})`)
    .gte("fecha_limite", esSemanaDeHoy ? "0001-01-01" : lunes)
    .order("fecha_limite")
    .limit(200);
  if (proyectoId) consulta = consulta.eq("proyecto_id", proyectoId);
  const { data, error } = await consulta;
  if (error) throw error;

  type Cruda = Omit<TareaDeCarga, "proyectoNombre" | "fechaInicio" | "fechaLimite" | "horasEstimadas"> & {
    fecha_inicio: string | null;
    fecha_limite: string;
    horas_estimadas: number | null;
    proyecto: { nombre: string };
  };
  return (data as unknown as Cruda[]).map((t) => ({
    id: t.id,
    titulo: t.titulo,
    proyectoNombre: t.proyecto.nombre,
    estado: t.estado,
    prioridad: t.prioridad,
    fechaInicio: t.fecha_inicio,
    fechaLimite: t.fecha_limite,
    horasEstimadas: t.horas_estimadas === null ? null : Number(t.horas_estimadas),
    atrasada: t.fecha_limite < hoy,
  }));
}
