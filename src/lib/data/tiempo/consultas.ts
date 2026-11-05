import type { ClienteSupabase, PersonaRef } from "@/lib/data/comun";
import { aPersona, SELECT_PERSONA, type PerfilCrudo } from "@/lib/data/proyectos/consultas";
import { sumarDias } from "@/lib/fechas";

export type RegistroFila = {
  id: string;
  tareaId: string;
  tareaTitulo: string;
  proyectoId: string;
  proyectoNombre: string;
  usuarioId: string;
  persona: PersonaRef | null;
  origen: "temporizador" | "manual";
  inicio: string | null;
  fin: string | null;
  /** Nulo mientras el temporizador corre. */
  minutos: number | null;
  fecha: string;
  nota: string | null;
};

// proyecto_id no tiene clave foránea propia (lo copia un trigger desde la tarea): el nombre sale de la tarea.
export const SELECT_REGISTRO = `id, tarea_id, proyecto_id, usuario_id, origen, inicio, fin, minutos, fecha, nota,
  tarea:tareas!registros_tiempo_organizacion_id_tarea_id_fkey(titulo, proyecto:proyectos!tareas_organizacion_id_proyecto_id_fkey(nombre)),
  persona:miembros!registros_tiempo_organizacion_id_usuario_id_fkey(${SELECT_PERSONA})`;

type Crudo = {
  id: string;
  tarea_id: string;
  proyecto_id: string;
  usuario_id: string;
  origen: string;
  inicio: string | null;
  fin: string | null;
  minutos: number | null;
  fecha: string;
  nota: string | null;
  tarea: { titulo: string; proyecto: { nombre: string } | null } | null;
  persona: { perfil: PerfilCrudo | null } | null;
};

export function aRegistro(f: Crudo): RegistroFila {
  return {
    id: f.id,
    tareaId: f.tarea_id,
    tareaTitulo: f.tarea?.titulo ?? "Tarea sin nombre",
    proyectoId: f.proyecto_id,
    proyectoNombre: f.tarea?.proyecto?.nombre ?? "",
    usuarioId: f.usuario_id,
    persona: aPersona(f.persona?.perfil),
    origen: f.origen === "manual" ? "manual" : "temporizador",
    inicio: f.inicio,
    fin: f.fin,
    minutos: f.minutos,
    fecha: f.fecha,
    nota: f.nota,
  };
}

/** El temporizador que corre a nombre de la persona, o null. El tiempo lo calcula el navegador desde `inicio`. */
export async function obtenerTemporizador(db: ClienteSupabase, usuarioId: string): Promise<RegistroFila | null> {
  const { data, error } = await db
    .from("registros_tiempo")
    .select(SELECT_REGISTRO)
    .eq("usuario_id", usuarioId)
    .eq("origen", "temporizador")
    .is("fin", null)
    .maybeSingle();
  if (error) throw error;
  return data ? aRegistro(data as unknown as Crudo) : null;
}

/** Registros de una tarea, de todas las personas que el RLS deja ver. Los más nuevos primero. */
export async function listarRegistrosDeTarea(db: ClienteSupabase, tareaId: string): Promise<RegistroFila[]> {
  const { data, error } = await db
    .from("registros_tiempo")
    .select(SELECT_REGISTRO)
    .eq("tarea_id", tareaId)
    .order("fecha", { ascending: false })
    .order("creado_en", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data as unknown as Crudo[]).map(aRegistro);
}

/** Registros de una persona de lunes a domingo. Incluye el temporizador corriendo, que no suma. */
export async function listarRegistrosDeSemana(
  db: ClienteSupabase,
  { usuarioId, lunes }: { usuarioId: string; lunes: string },
): Promise<RegistroFila[]> {
  const { data, error } = await db
    .from("registros_tiempo")
    .select(SELECT_REGISTRO)
    .eq("usuario_id", usuarioId)
    .gte("fecha", lunes)
    .lte("fecha", sumarDias(lunes, 6))
    .order("fecha")
    .order("creado_en")
    .limit(1000);
  if (error) throw error;
  return (data as unknown as Crudo[]).map(aRegistro);
}

/** Tareas donde puede cargar horas: abiertas o recién cerradas, de proyectos vivos. Para el combo de carga manual. */
export async function buscarTareasParaHoras(db: ClienteSupabase, texto: string, limite = 10) {
  const patron = `%${texto.replace(/[\\%_]/g, "\\$&")}%`;
  const { data, error } = await db
    .from("tareas")
    .select("id, titulo, proyecto:proyectos!tareas_organizacion_id_proyecto_id_fkey!inner(nombre, eliminado_en)")
    .ilike("titulo", patron)
    .is("eliminado_en", null)
    .is("proyecto.eliminado_en", null)
    .neq("estado", "cancelada")
    .order("actualizado_en", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data as unknown as { id: string; titulo: string; proyecto: { nombre: string } }[]).map((t) => ({
    id: t.id,
    nombre: `${t.titulo} · ${t.proyecto.nombre}`,
  }));
}
