import type { ClienteSupabase, PersonaRef, Ref } from "@/lib/data/comun";
import { listarMiembros } from "@/lib/data/miembros/consultas";
import type { EstadoTarea } from "@/lib/validaciones/tareas";
import { semanasDelPeriodo, type FilaHoras, type Periodo } from "./reglas";

// Lecturas de Analítica. Todo lo calculan las funciones de `analitica` en la base, con el RLS
// de quien pide: un colaborador recibe solo lo suyo aunque pida a otra persona.

export type FiltrosAnalitica = {
  organizacionId: string;
  periodo: Periodo;
  proyectoId?: string | null;
  personaId?: string | null;
};

/** Cada tarjeta carga por su cuenta: si una función falla, las demás se muestran igual. */
export type Parte<T> = { ok: true; datos: T } | { ok: false };

export type Cuello = { estado: EstadoTarea; tareasAhora: number; trabadas: number; medianaHoras: number | null; n: number };
export type Trabada = {
  tareaId: string;
  titulo: string;
  proyecto: string;
  asignado: PersonaRef | null;
  estado: EstadoTarea;
  horasEnEstado: number;
  umbralHoras: number;
};
export type Utilizacion = { persona: PersonaRef; horas: number; capacidad: number; porcentaje: number | null };
export type Rendimiento = { semana: string; tareasHechas: number };
export type Presupuesto = {
  proyecto: Ref;
  horas: number;
  presupuestadas: number;
  porcentaje: number | null;
  avance: number | null;
  n: number;
};

export type Analitica = {
  horas: Parte<{ actual: number; anterior: number; n: number; filas: FilaHoras[] }>;
  hechas: Parte<{ actual: number; anterior: number; semanas: Rendimiento[] }>;
  plazos: Parte<{ aTiempo: number; tarde: number; porcentaje: number | null; n: number }>;
  precision: Parte<{ mediana: number | null; n: number }>;
  cuellos: Parte<Cuello[]>;
  trabadas: Parte<Trabada[]>;
  utilizacion: Parte<Utilizacion[]>;
  presupuesto: Parte<Presupuesto[]>;
  /** Lunes de cada semana del período. */
  semanas: string[];
  /** Nombres de los proyectos visibles, para el gráfico de horas. */
  proyectos: Map<string, string>;
};

type Args = { p_desde: string; p_hasta: string; p_proyectos?: string[]; p_usuarios?: string[] };

function argumentos(f: FiltrosAnalitica, anterior = false): Args {
  return {
    p_desde: anterior ? f.periodo.anteriorDesde : f.periodo.desde,
    p_hasta: anterior ? f.periodo.anteriorHasta : f.periodo.hasta,
    ...(f.proyectoId ? { p_proyectos: [f.proyectoId] } : {}),
    ...(f.personaId ? { p_usuarios: [f.personaId] } : {}),
  };
}

async function parte<T>(promesa: Promise<T>, etiqueta: string): Promise<Parte<T>> {
  try {
    return { ok: true, datos: await promesa };
  } catch (error) {
    console.error(`analitica ${etiqueta}:`, (error as { code?: string }).code ?? "sin código");
    return { ok: false };
  }
}

function datos<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

const num = (v: number | string | null | undefined) => (v === null || v === undefined ? null : Number(v));
const sumar = (filas: readonly { horas: number | string }[]) => Math.round(filas.reduce((s, f) => s + Number(f.horas), 0) * 100) / 100;

/** Todo lo de la pantalla de Analítica, en paralelo. */
export async function obtenerAnalitica(db: ClienteSupabase, f: FiltrosAnalitica): Promise<Analitica> {
  const a = db.schema("analitica");
  const actual = argumentos(f);
  const previo = argumentos(f, true);

  const [miembros, proyectosVisibles] = await Promise.all([
    listarMiembros(db, f.organizacionId).catch(() => []),
    db.from("proyectos").select("id, nombre").is("eliminado_en", null).order("nombre"),
  ]);
  const personas = new Map(miembros.map((m) => [m.id, { id: m.id, nombre: m.nombre, avatarUrl: m.avatarUrl }]));
  const proyectos = new Map((proyectosVisibles.data ?? []).map((p) => [p.id, p.nombre]));
  const persona = (id: string | null): PersonaRef | null => (id ? (personas.get(id) ?? { id, nombre: "Persona sin acceso", avatarUrl: null }) : null);
  const proyecto = (id: string) => proyectos.get(id) ?? "Proyecto sin acceso";

  const [horas, hechas, plazos, precision, cuellos, trabadas, utilizacion, presupuesto] = await Promise.all([
    parte(
      (async () => {
        const [ahora, antes] = await Promise.all([a.rpc("horas_por_periodo", actual), a.rpc("horas_por_periodo", previo)]);
        const filas = datos(ahora).map((x) => ({ ...x, horas: Number(x.horas) }));
        return { actual: sumar(filas), anterior: sumar(datos(antes)), n: filas.reduce((s, x) => s + x.n, 0), filas };
      })(),
      "horas",
    ),
    parte(
      (async () => {
        const [ahora, antes] = await Promise.all([a.rpc("rendimiento", actual), a.rpc("rendimiento", previo)]);
        const semanas = datos(ahora).map((x) => ({ semana: x.semana, tareasHechas: x.tareas_hechas }));
        return {
          actual: semanas.reduce((s, x) => s + x.tareasHechas, 0),
          anterior: datos(antes).reduce((s, x) => s + x.tareas_hechas, 0),
          semanas,
        };
      })(),
      "rendimiento",
    ),
    parte(
      (async () => {
        const fila = datos(await a.rpc("cumplimiento_plazos", actual))[0];
        return { aTiempo: fila?.a_tiempo ?? 0, tarde: fila?.tarde ?? 0, porcentaje: num(fila?.porcentaje), n: fila?.n ?? 0 };
      })(),
      "plazos",
    ),
    parte(
      (async () => {
        const fila = datos(await a.rpc("precision_estimacion", { ...actual, p_por: "total" }))[0];
        return { mediana: num(fila?.mediana_ratio), n: fila?.n ?? 0 };
      })(),
      "precision",
    ),
    parte(
      (async () =>
        datos(await a.rpc("cuellos_de_botella", actual)).map((x) => ({
          estado: x.estado as EstadoTarea,
          tareasAhora: x.tareas_ahora,
          trabadas: x.trabadas,
          medianaHoras: num(x.mediana_horas),
          n: x.n,
        })))(),
      "cuellos",
    ),
    parte(
      (async () => {
        const filas = datos(await a.rpc("tareas_trabadas", actual));
        const ids = filas.map((x) => x.tarea_id);
        const titulos = new Map<string, string>();
        if (ids.length > 0) {
          for (const t of datos(await db.from("tareas").select("id, titulo").in("id", ids))) titulos.set(t.id, t.titulo);
        }
        return filas.map((x) => ({
          tareaId: x.tarea_id,
          titulo: titulos.get(x.tarea_id) ?? "Tarea sin acceso",
          proyecto: proyecto(x.proyecto_id),
          asignado: persona(x.asignado_id),
          estado: x.estado as EstadoTarea,
          horasEnEstado: Number(x.horas_en_estado),
          umbralHoras: Number(x.umbral_horas),
        }));
      })(),
      "trabadas",
    ),
    parte(
      (async () =>
        datos(await a.rpc("utilizacion", actual))
          .map((x) => ({ persona: persona(x.usuario_id)!, horas: Number(x.horas), capacidad: Number(x.capacidad), porcentaje: num(x.porcentaje) }))
          // Por nombre, nunca por rendimiento: no es una tabla de posiciones.
          .sort((x, y) => x.persona.nombre.localeCompare(y.persona.nombre)))(),
      "utilizacion",
    ),
    parte(
      (async () =>
        datos(await a.rpc("consumo_presupuesto", actual)).map((x) => ({
          proyecto: { id: x.proyecto_id, nombre: proyecto(x.proyecto_id) },
          horas: Number(x.horas),
          presupuestadas: Number(x.presupuestadas),
          porcentaje: num(x.porcentaje),
          avance: num(x.avance),
          n: x.n,
        })))(),
      "presupuesto",
    ),
  ]);

  return { horas, hechas, plazos, precision, cuellos, trabadas, utilizacion, presupuesto, semanas: semanasDelPeriodo(f.periodo), proyectos };
}

/** Horas registradas por una persona entre dos fechas (sin el temporizador corriendo). */
export async function horasDePersona(db: ClienteSupabase, { usuarioId, desde, hasta }: { usuarioId: string; desde: string; hasta: string }) {
  const filas = datos(await db.schema("analitica").rpc("horas_por_periodo", { p_desde: desde, p_hasta: hasta, p_usuarios: [usuarioId] }));
  return sumar(filas);
}

/** Tareas trabadas para el inicio, con el mismo criterio que Analítica (12 semanas). */
export async function listarTrabadas(db: ClienteSupabase, { desde, hasta, limite }: { desde: string; hasta: string; limite: number }) {
  const filas = datos(await db.schema("analitica").rpc("tareas_trabadas", { p_desde: desde, p_hasta: hasta }));
  const ids = filas.slice(0, limite).map((x) => x.tarea_id);
  if (ids.length === 0) return { total: filas.length, tareas: [] };
  const tareas = datos(
    await db.from("tareas").select("id, titulo, proyecto:proyectos!tareas_organizacion_id_proyecto_id_fkey(nombre)").in("id", ids),
  ) as unknown as { id: string; titulo: string; proyecto: { nombre: string } | null }[];
  const porId = new Map(tareas.map((t) => [t.id, t]));
  return {
    total: filas.length,
    tareas: filas.slice(0, limite).map((x) => ({
      tareaId: x.tarea_id,
      titulo: porId.get(x.tarea_id)?.titulo ?? "Tarea sin acceso",
      proyecto: porId.get(x.tarea_id)?.proyecto?.nombre ?? "",
      estado: x.estado as EstadoTarea,
      horasEnEstado: Number(x.horas_en_estado),
    })),
  };
}
