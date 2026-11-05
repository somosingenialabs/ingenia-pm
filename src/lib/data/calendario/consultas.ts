import type { Rol } from "@/lib/auth/tipos";
import type { ClienteSupabase, PersonaRef, Ref } from "@/lib/data/comun";
import { listarMiembros } from "@/lib/data/miembros/consultas";
import { aPersona, SELECT_PERSONA, type PerfilCrudo } from "@/lib/data/proyectos/consultas";
import type { EstadoTarea, Prioridad } from "@/lib/validaciones/tareas";
import type { DatosCalendario, TareaCalendario } from "./reglas";

export type FiltrosCalendario = {
  /** Primer y último día que se ven, inclusive. */
  desde: string;
  hasta: string;
  proyectoId?: string | null;
  personaId?: string | null;
};

/** Tope de tareas por período: un mes de una empresa grande entra holgado. */
const LIMITE_TAREAS = 1000;

const SELECT_TAREA_CALENDARIO = `id, titulo, estado, prioridad, fecha_inicio, fecha_limite, proyecto_id,
  asignado:miembros!tareas_organizacion_id_asignado_id_fkey(${SELECT_PERSONA}),
  proyecto:proyectos!tareas_organizacion_id_proyecto_id_fkey!inner(nombre, eliminado_en)`;

type TareaCruda = {
  id: string;
  titulo: string;
  estado: EstadoTarea;
  prioridad: Prioridad;
  fecha_inicio: string | null;
  fecha_limite: string;
  proyecto_id: string;
  asignado: { perfil: PerfilCrudo | null } | null;
  proyecto: { nombre: string };
};

/**
 * Lo que dibuja el calendario en un período: tareas no canceladas que lo tocan (de inicio a
 * límite), objetivos de proyecto, dependencias y conflictos. Todo pasa por el RLS de quien mira.
 */
export async function listarCalendario(db: ClienteSupabase, filtros: FiltrosCalendario): Promise<DatosCalendario> {
  const { desde, hasta, proyectoId, personaId } = filtros;

  let consultaTareas = db
    .from("tareas")
    .select(SELECT_TAREA_CALENDARIO)
    .is("eliminado_en", null)
    .is("proyecto.eliminado_en", null)
    .neq("estado", "cancelada")
    .not("fecha_limite", "is", null)
    .gte("fecha_limite", desde)
    // Arranca antes del fin del período. Sin inicio, arranca el día del límite.
    .or(`fecha_inicio.lte.${hasta},and(fecha_inicio.is.null,fecha_limite.lte.${hasta})`)
    .order("fecha_limite")
    .order("id")
    .limit(LIMITE_TAREAS);
  if (proyectoId) consultaTareas = consultaTareas.eq("proyecto_id", proyectoId);
  if (personaId) consultaTareas = consultaTareas.eq("asignado_id", personaId);

  let consultaObjetivos = db
    .from("proyectos")
    .select("id, nombre, fecha_fin_objetivo")
    .is("eliminado_en", null)
    .gte("fecha_fin_objetivo", desde)
    .lte("fecha_fin_objetivo", hasta)
    .order("fecha_fin_objetivo");
  if (proyectoId) consultaObjetivos = consultaObjetivos.eq("id", proyectoId);

  const [tareas, objetivos, dependencias, conflictos] = await Promise.all([
    consultaTareas,
    consultaObjetivos,
    db.from("tarea_dependencias").select("tarea_id, depende_de_id, desfase_dias"),
    db.rpc("conflictos_dependencias", proyectoId ? { p_proyecto: proyectoId } : {}),
  ]);
  for (const r of [tareas, objetivos, dependencias, conflictos]) if (r.error) throw r.error;

  const filas: TareaCalendario[] = (tareas.data as unknown as TareaCruda[]).map((t) => ({
    id: t.id,
    titulo: t.titulo,
    proyectoId: t.proyecto_id,
    proyectoNombre: t.proyecto.nombre,
    estado: t.estado,
    prioridad: t.prioridad,
    asignadoNombre: aPersona(t.asignado?.perfil)?.nombre ?? null,
    fechaInicio: t.fecha_inicio,
    fechaLimite: t.fecha_limite,
  }));

  const cargadas = new Set(filas.map((t) => t.id));
  const deps = (dependencias.data ?? [])
    .filter((d) => cargadas.has(d.tarea_id) || cargadas.has(d.depende_de_id))
    .map((d) => ({ tareaId: d.tarea_id, dependeDeId: d.depende_de_id, desfaseDias: d.desfase_dias }));
  const confl = (conflictos.data ?? [])
    .filter((c) => cargadas.has(c.tarea_id))
    .map((c) => ({ tareaId: c.tarea_id, dependeDeId: c.depende_de_id, debeArrancarDesde: c.debe_arrancar_desde, arrancaEl: c.arranca_el }));

  // Las tareas del otro lado de una dependencia pueden caer fuera del período: se pide su título.
  const titulos: Record<string, string> = Object.fromEntries(filas.map((t) => [t.id, t.titulo]));
  const faltantes = [...new Set([...deps, ...confl].flatMap((d) => [d.tareaId, d.dependeDeId]))].filter((id) => !titulos[id]);
  if (faltantes.length > 0) {
    const { data, error } = await db.from("tareas").select("id, titulo").in("id", faltantes.slice(0, 200));
    if (error) throw error;
    for (const t of data) titulos[t.id] = t.titulo;
  }

  return {
    tareas: filas,
    objetivos: (objetivos.data ?? []).map((o) => ({ proyectoId: o.id, nombre: o.nombre, fecha: o.fecha_fin_objetivo! })),
    dependencias: deps,
    conflictos: confl,
    titulos,
  };
}

export type OpcionesCalendario = {
  proyectos: Ref[];
  personas: PersonaRef[];
  /** Proyectos donde quien mira es gestor: ahí puede arrastrar. */
  gestionados: string[];
};

/** Filtros del calendario y dónde puede mover quien mira. Espejo de app.proyectos_gestionados(). */
export async function listarOpcionesCalendario(
  db: ClienteSupabase,
  { organizacionId, usuarioId, rol }: { organizacionId: string; usuarioId: string; rol: Rol },
): Promise<OpcionesCalendario> {
  const [proyectos, miembros, propios] = await Promise.all([
    db.from("proyectos").select("id, nombre").is("eliminado_en", null).order("nombre"),
    listarMiembros(db, organizacionId),
    rol === "pm"
      ? db.from("proyecto_miembros").select("proyecto_id").eq("usuario_id", usuarioId)
      : Promise.resolve({ data: [] as { proyecto_id: string }[], error: null }),
  ]);
  if (proyectos.error) throw proyectos.error;
  if (propios.error) throw propios.error;

  const lista = proyectos.data.map((p) => ({ id: p.id, nombre: p.nombre }));
  const gestionados =
    rol === "admin" ? lista.map((p) => p.id) : rol === "pm" ? propios.data.map((m) => m.proyecto_id) : [];
  return {
    proyectos: lista,
    personas: miembros.filter((m) => m.activo).map(({ id, nombre, avatarUrl }) => ({ id, nombre, avatarUrl })),
    gestionados,
  };
}
