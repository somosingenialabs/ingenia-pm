import type { ClienteSupabase } from "@/lib/data/comun";

/** Una fila tal como la manda la base, y tal como llega en el payload de Realtime. */
export type ComentarioFila = {
  id: string;
  tarea_id: string;
  autor_id: string;
  cuerpo: string;
  creado_en: string;
  editado_en: string | null;
  eliminado_en: string | null;
};

export const SELECT_COMENTARIO = "id, tarea_id, autor_id, cuerpo, creado_en, editado_en, eliminado_en";

/**
 * Comentarios de una tarea, en orden cronológico. Trae también los borrados: se muestran como
 * "Comentario eliminado" para no romper el hilo. El autor no viene acá: sale de la lista de
 * miembros en caché, igual que con los eventos de Realtime, que no lo traen.
 */
export async function listarComentarios(db: ClienteSupabase, tareaId: string): Promise<ComentarioFila[]> {
  const { data, error } = await db
    .from("comentarios")
    .select(SELECT_COMENTARIO)
    .eq("tarea_id", tareaId)
    .order("creado_en")
    .order("id")
    .limit(500);
  if (error) throw error;
  return data;
}
