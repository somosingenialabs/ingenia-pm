import { addDays, differenceInCalendarDays, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { estaVencida } from "@/lib/data/tareas/reglas";
import { fechaDesdeBase, fechaParaBase, sumarDias } from "@/lib/fechas";
import type { EstadoTarea, Prioridad } from "@/lib/validaciones/tareas";

// Reglas puras del calendario: sin base ni React. Todas las fechas de la base pasan por
// fechaDesdeBase y fechaParaBase, así nunca se corren de día por la zona horaria.

export type ModoCalendario = "plazos" | "duracion";
export type VistaCalendario = "month" | "week" | "agenda";

/** La semana arranca el lunes, como en la carga y en la base. */
export const SEMANA = { weekStartsOn: 1 } as const;

/** Días que muestra la Agenda. */
export const DIAS_AGENDA = 30;

export type TareaCalendario = {
  id: string;
  titulo: string;
  proyectoId: string;
  proyectoNombre: string;
  estado: EstadoTarea;
  prioridad: Prioridad;
  asignadoNombre: string | null;
  fechaInicio: string | null;
  fechaLimite: string;
};

export type ObjetivoCalendario = { proyectoId: string; nombre: string; fecha: string };
export type Dependencia = { tareaId: string; dependeDeId: string; desfaseDias: number };
export type Conflicto = { tareaId: string; dependeDeId: string; debeArrancarDesde: string; arrancaEl: string };

export type DatosCalendario = {
  tareas: TareaCalendario[];
  objetivos: ObjetivoCalendario[];
  /** Solo las que tocan alguna tarea cargada. */
  dependencias: Dependencia[];
  conflictos: Conflicto[];
  /** Título de cada tarea nombrada en una dependencia, aunque no esté en el período. */
  titulos: Record<string, string>;
};

export type EventoCalendario = {
  id: string;
  tipo: "tarea" | "objetivo";
  titulo: string;
  start: Date;
  end: Date;
  allDay: true;
  proyectoId: string;
  proyectoNombre: string;
  /** Solo en tareas. */
  tarea?: TareaCalendario;
  vencida: boolean;
  /** Títulos de las predecesoras abiertas que terminan después de que esta arranca. */
  conflictos: string[];
  /** Quien mira puede arrastrarla. */
  movible: boolean;
};

/**
 * Evento de día completo de `inicio` a `limite`. react-big-calendar toma el fin como exclusivo:
 * termina a las 00:00 del día siguiente al límite. Con el límite tal cual, la barra queda un día corta.
 */
export function rangoDiaCompleto(inicio: string, limite: string): { start: Date; end: Date } {
  return { start: fechaDesdeBase(inicio), end: fechaDesdeBase(sumarDias(limite, 1)) };
}

/** Lo inverso: del fin exclusivo vuelve al último día. Nunca deja el límite antes del inicio. */
export function fechasDesdeRango(start: Date, end: Date): { inicio: string; limite: string } {
  const inicio = fechaParaBase(start);
  const esMedianoche = end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0;
  const limite = esMedianoche ? fechaParaBase(addDays(end, -1)) : fechaParaBase(end);
  return { inicio, limite: limite < inicio ? inicio : limite };
}

export type CambioFechas = { fecha_inicio?: string | null; fecha_limite: string };

/**
 * Qué fechas guardar tras soltar o estirar un evento. Null si no cambió nada.
 * - Plazos: el evento es el día del límite. Mover cambia solo el límite; si el inicio queda
 *   después, el inicio se corre los mismos días, para no romper la regla inicio <= límite.
 * - Duración: mover desplaza las dos fechas; estirar cambia la que se estiró. Una tarea sin
 *   inicio se dibuja desde el límite: al moverla sigue sin inicio, al estirarla gana uno.
 */
export function fechasTrasArrastre(
  tarea: { fechaInicio: string | null; fechaLimite: string },
  modo: ModoCalendario,
  accion: "move" | "resize",
  start: Date,
  end: Date,
): CambioFechas | null {
  if (modo === "plazos") {
    const limite = fechaParaBase(start);
    if (limite === tarea.fechaLimite) return null;
    const delta = differenceInCalendarDays(fechaDesdeBase(limite), fechaDesdeBase(tarea.fechaLimite));
    if (tarea.fechaInicio && tarea.fechaInicio > limite) {
      return { fecha_inicio: sumarDias(tarea.fechaInicio, delta), fecha_limite: limite };
    }
    return { fecha_limite: limite };
  }

  const { inicio, limite } = fechasDesdeRango(start, end);
  if (!tarea.fechaInicio && accion === "move") {
    return limite === tarea.fechaLimite ? null : { fecha_limite: limite };
  }
  if (inicio === tarea.fechaInicio && limite === tarea.fechaLimite) return null;
  return { fecha_inicio: inicio, fecha_limite: limite };
}

/** Período que se ve, para pedir solo eso. Mes: semanas completas, como las dibuja la grilla. */
export function rangoVisible(vista: VistaCalendario, fecha: Date): { desde: string; hasta: string } {
  if (vista === "month") {
    return {
      desde: fechaParaBase(startOfWeek(startOfMonth(fecha), SEMANA)),
      hasta: fechaParaBase(endOfWeek(endOfMonth(fecha), SEMANA)),
    };
  }
  if (vista === "week") {
    return { desde: fechaParaBase(startOfWeek(fecha, SEMANA)), hasta: fechaParaBase(endOfWeek(fecha, SEMANA)) };
  }
  return { desde: fechaParaBase(fecha), hasta: fechaParaBase(addDays(fecha, DIAS_AGENDA - 1)) };
}

export function armarEventos(
  datos: DatosCalendario,
  { modo, hoy, gestionados }: { modo: ModoCalendario; hoy: string; gestionados: ReadonlySet<string> },
): EventoCalendario[] {
  const conflictosPorTarea = new Map<string, string[]>();
  for (const c of datos.conflictos) {
    const lista = conflictosPorTarea.get(c.tareaId) ?? [];
    lista.push(datos.titulos[c.dependeDeId] ?? "otra tarea");
    conflictosPorTarea.set(c.tareaId, lista);
  }

  const tareas: EventoCalendario[] = datos.tareas.map((t) => {
    const inicio = modo === "duracion" ? (t.fechaInicio ?? t.fechaLimite) : t.fechaLimite;
    return {
      id: t.id,
      tipo: "tarea",
      titulo: t.titulo,
      ...rangoDiaCompleto(inicio, t.fechaLimite),
      allDay: true,
      proyectoId: t.proyectoId,
      proyectoNombre: t.proyectoNombre,
      tarea: t,
      vencida: estaVencida({ estado: t.estado, fecha_limite: t.fechaLimite }, hoy),
      conflictos: conflictosPorTarea.get(t.id) ?? [],
      movible: gestionados.has(t.proyectoId),
    };
  });

  const objetivos: EventoCalendario[] = datos.objetivos.map((o) => ({
    id: `objetivo:${o.proyectoId}`,
    tipo: "objetivo",
    titulo: o.nombre,
    ...rangoDiaCompleto(o.fecha, o.fecha),
    allDay: true,
    proyectoId: o.proyectoId,
    proyectoNombre: o.nombre,
    vencida: false,
    conflictos: [],
    movible: false,
  }));

  return [...objetivos, ...tareas];
}

/** Predecesoras y sucesoras directas de una tarea, para resaltarlas al seleccionarla. */
export function relacionadas(dependencias: readonly Dependencia[], id: string): { predecesoras: string[]; sucesoras: string[] } {
  return {
    predecesoras: dependencias.filter((d) => d.tareaId === id).map((d) => d.dependeDeId),
    sucesoras: dependencias.filter((d) => d.dependeDeId === id).map((d) => d.tareaId),
  };
}

/** Aviso al guardar un movimiento que deja una dependencia en conflicto. */
export function textoConflicto(movida: string, c: { tareaId: string; dependeDeId: string }, titulos: Record<string, string>): string {
  return c.tareaId === movida
    ? `Esta tarea arranca antes de que termine «${titulos[c.dependeDeId] ?? "otra tarea"}».`
    : `«${titulos[c.tareaId] ?? "Otra tarea"}» arranca antes de que termine esta tarea.`;
}

/** Colores de proyecto: los de gráficos de la sección 4, validados en claro y oscuro. */
export const COLORES_PROYECTO = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"] as const;

/** Por orden en la lista de proyectos: con pocos proyectos, cada uno tiene el suyo. */
export function colorDeProyecto(proyectoId: string, orden: readonly string[]): string {
  const i = orden.indexOf(proyectoId);
  return COLORES_PROYECTO[(i === -1 ? 0 : i) % COLORES_PROYECTO.length]!;
}
