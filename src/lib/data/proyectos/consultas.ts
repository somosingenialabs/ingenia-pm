import type { ClienteSupabase, PersonaRef } from "@/lib/data/comun";
import type { EstadoProyecto } from "@/lib/validaciones/proyectos";
import { calcularAvance, calcularSalud, type Salud } from "./salud";

export type ProyectoFila = {
  id: string;
  nombre: string;
  cliente: string | null;
  estado: EstadoProyecto;
  responsable: PersonaRef | null;
  fecha_fin_objetivo: string | null;
  avance: number | null;
  salud: Salud;
};

export type ProyectoDetalle = ProyectoFila & {
  descripcion: string | null;
  responsable_id: string;
  fecha_inicio: string | null;
  horas_presupuestadas: number | null;
  miembros: PersonaRef[];
};

/** El responsable es una FK compuesta a miembros, y de ahí al perfil. */
export const SELECT_PERSONA = "perfil:perfiles!miembros_usuario_id_fkey(id, nombre_completo, avatar_url)";

export type PerfilCrudo = { id: string; nombre_completo: string; avatar_url: string | null };

export function aPersona(perfil: PerfilCrudo | null | undefined): PersonaRef | null {
  return perfil ? { id: perfil.id, nombre: perfil.nombre_completo, avatarUrl: perfil.avatar_url } : null;
}

const SELECT_LISTA = `id, nombre, cliente, estado, fecha_fin_objetivo,
  responsable:miembros!proyectos_organizacion_id_responsable_id_fkey(${SELECT_PERSONA}),
  tareas(estado, prioridad, fecha_limite)`;

type FilaCruda = {
  id: string;
  nombre: string;
  cliente: string | null;
  estado: EstadoProyecto;
  fecha_fin_objetivo: string | null;
  responsable: { perfil: PerfilCrudo | null } | null;
  tareas: { estado: string; prioridad: string; fecha_limite: string | null }[];
};

function aFila(fila: FilaCruda, hoy: string): ProyectoFila {
  return {
    id: fila.id,
    nombre: fila.nombre,
    cliente: fila.cliente,
    estado: fila.estado,
    fecha_fin_objetivo: fila.fecha_fin_objetivo,
    responsable: aPersona(fila.responsable?.perfil),
    avance: calcularAvance(fila.tareas),
    salud: calcularSalud(fila, fila.tareas, hoy),
  };
}

export type FiltrosProyectos = {
  /** Hoy en la zona de la empresa: de ahí sale la salud. */
  hoy: string;
  estados?: EstadoProyecto[];
  responsableId?: string;
};

/** Proyectos visibles, con avance y salud. El RLS ya deja solo los que corresponden al rol. */
export async function listarProyectos(db: ClienteSupabase, filtros: FiltrosProyectos): Promise<ProyectoFila[]> {
  let consulta = db
    .from("proyectos")
    .select(SELECT_LISTA)
    .is("eliminado_en", null)
    .is("tareas.eliminado_en", null)
    .order("nombre");
  if (filtros.estados?.length) consulta = consulta.in("estado", filtros.estados);
  if (filtros.responsableId) consulta = consulta.eq("responsable_id", filtros.responsableId);

  const { data, error } = await consulta;
  if (error) throw error;
  return (data as unknown as FilaCruda[]).map((f) => aFila(f, filtros.hoy));
}

/** Null si no existe, está borrado o el RLS no lo deja ver: la pantalla responde "no encontrado". */
export async function obtenerProyecto(db: ClienteSupabase, id: string, hoy: string): Promise<ProyectoDetalle | null> {
  const { data, error } = await db
    .from("proyectos")
    .select(
      `${SELECT_LISTA}, descripcion, responsable_id, fecha_inicio, horas_presupuestadas,
       proyecto_miembros(miembro:miembros!proyecto_miembros_organizacion_id_usuario_id_fkey(activo, ${SELECT_PERSONA}))`,
    )
    .eq("id", id)
    .is("eliminado_en", null)
    .is("tareas.eliminado_en", null)
    .maybeSingle();
  if (error) {
    // Un id que no es un uuid no es un error: es un proyecto que no existe.
    if (error.code === "22P02") return null;
    throw error;
  }
  if (!data) return null;

  const fila = data as unknown as FilaCruda & {
    descripcion: string | null;
    responsable_id: string;
    fecha_inicio: string | null;
    horas_presupuestadas: number | null;
    proyecto_miembros: { miembro: { activo: boolean; perfil: PerfilCrudo | null } | null }[];
  };
  return {
    ...aFila(fila, hoy),
    descripcion: fila.descripcion,
    responsable_id: fila.responsable_id,
    fecha_inicio: fila.fecha_inicio,
    horas_presupuestadas: fila.horas_presupuestadas,
    miembros: fila.proyecto_miembros
      .filter((m) => m.miembro?.activo)
      .flatMap((m) => aPersona(m.miembro?.perfil) ?? [])
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
  };
}

/** Personas de un proyecto, para el panel de la tarea. */
export async function listarPersonasDeProyecto(db: ClienteSupabase, proyectoId: string): Promise<PersonaRef[]> {
  const { data, error } = await db
    .from("proyecto_miembros")
    .select(`miembro:miembros!proyecto_miembros_organizacion_id_usuario_id_fkey(activo, ${SELECT_PERSONA})`)
    .eq("proyecto_id", proyectoId);
  if (error) throw error;
  return (data as unknown as { miembro: { activo: boolean; perfil: PerfilCrudo | null } | null }[])
    .filter((m) => m.miembro?.activo)
    .flatMap((m) => aPersona(m.miembro?.perfil) ?? [])
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}
