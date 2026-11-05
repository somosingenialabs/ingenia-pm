import type { ClienteSupabase, Ref } from "@/lib/data/comun";
import { estaCerrada } from "@/lib/data/tareas/reglas";
import type { EstadoTarea } from "@/lib/validaciones/tareas";

export type TareaVinculada = { id: string; titulo: string; estado: EstadoTarea; desfaseDias: number };
export type DependenciasDeTarea = { dependeDe: TareaVinculada[]; bloquea: TareaVinculada[] };

// Las dos FK compuestas de tarea_dependencias: una por cada lado.
const PREDECESORA = "predecesora:tareas!tarea_dependencias_organizacion_id_depende_de_id_fkey!inner(id, titulo, estado, eliminado_en)";
const SUCESORA = "sucesora:tareas!tarea_dependencias_organizacion_id_tarea_id_fkey!inner(id, titulo, estado, eliminado_en)";

type Lado = { id: string; titulo: string; estado: EstadoTarea };

/** De qué tareas depende esta, y cuáles bloquea. Sin las borradas. */
export async function listarDependenciasDeTarea(db: ClienteSupabase, tareaId: string): Promise<DependenciasDeTarea> {
  const [previas, siguientes] = await Promise.all([
    db.from("tarea_dependencias").select(`desfase_dias, ${PREDECESORA}`).eq("tarea_id", tareaId).is("predecesora.eliminado_en", null),
    db.from("tarea_dependencias").select(`desfase_dias, ${SUCESORA}`).eq("depende_de_id", tareaId).is("sucesora.eliminado_en", null),
  ]);
  if (previas.error) throw previas.error;
  if (siguientes.error) throw siguientes.error;

  const aVinculada = (t: Lado, desfase: number): TareaVinculada => ({ id: t.id, titulo: t.titulo, estado: t.estado, desfaseDias: desfase });
  const porTitulo = (a: TareaVinculada, b: TareaVinculada) => a.titulo.localeCompare(b.titulo);
  return {
    dependeDe: (previas.data as unknown as { desfase_dias: number; predecesora: Lado }[]).map((d) => aVinculada(d.predecesora, d.desfase_dias)).sort(porTitulo),
    bloquea: (siguientes.data as unknown as { desfase_dias: number; sucesora: Lado }[]).map((d) => aVinculada(d.sucesora, d.desfase_dias)).sort(porTitulo),
  };
}

/**
 * Para el tablero y la lista: por cada tarea del proyecto, los títulos de sus predecesoras
 * abiertas. Es informativo: no impide mover la tarea.
 */
export async function listarBloqueosDeProyecto(db: ClienteSupabase, proyectoId: string): Promise<Record<string, string[]>> {
  const { data, error } = await db
    .from("tarea_dependencias")
    .select(`tarea_id, predecesora:tareas!tarea_dependencias_organizacion_id_depende_de_id_fkey!inner(titulo, estado, eliminado_en, proyecto_id)`)
    .eq("predecesora.proyecto_id", proyectoId)
    .is("predecesora.eliminado_en", null);
  if (error) throw error;

  const bloqueos: Record<string, string[]> = {};
  for (const d of data as unknown as { tarea_id: string; predecesora: { titulo: string; estado: string } }[]) {
    if (estaCerrada(d.predecesora.estado)) continue;
    (bloqueos[d.tarea_id] ??= []).push(d.predecesora.titulo);
  }
  return bloqueos;
}

/** Tareas del mismo proyecto para el combo de dependencias, sin la propia ni las ya vinculadas. */
export async function buscarTareasDelProyecto(
  db: ClienteSupabase,
  { proyectoId, texto, excluir, limite = 20 }: { proyectoId: string; texto: string; excluir: readonly string[]; limite?: number },
): Promise<Ref[]> {
  let consulta = db
    .from("tareas")
    .select("id, titulo")
    .eq("proyecto_id", proyectoId)
    .is("eliminado_en", null)
    .neq("estado", "cancelada")
    .order("titulo")
    .limit(limite + excluir.length);
  if (texto) consulta = consulta.ilike("titulo", `%${texto.replace(/[\\%_]/g, "\\$&")}%`);
  const { data, error } = await consulta;
  if (error) throw error;
  return data.filter((t) => !excluir.includes(t.id)).slice(0, limite).map((t) => ({ id: t.id, nombre: t.titulo }));
}
