import type { EstadoTarea, Prioridad } from "@/lib/validaciones/tareas";

// Reglas puras de tareas: sin base ni React, para usarlas en el servidor y en el navegador.

export const NOMBRE_ESTADO: Record<EstadoTarea, string> = {
  por_hacer: "Por hacer",
  en_curso: "En curso",
  en_revision: "En revisión",
  hecha: "Hecha",
  cancelada: "Cancelada",
};

export const NOMBRE_PRIORIDAD: Record<Prioridad, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  urgente: "Urgente",
};

/** Las columnas del tablero. `cancelada` no se muestra ahí: se filtra en la lista. */
export const COLUMNAS_TABLERO: readonly EstadoTarea[] = ["por_hacer", "en_curso", "en_revision", "hecha"];

/** Separación entre tareas al ir al final de una columna. */
export const SALTO_POSICION = 1000;

export function estaCerrada(estado: string): boolean {
  return estado === "hecha" || estado === "cancelada";
}

export function estaVencida(tarea: { estado: string; fecha_limite: string | null }, hoy: string): boolean {
  return !!tarea.fecha_limite && tarea.fecha_limite < hoy && !estaCerrada(tarea.estado);
}

/**
 * Posición entre dos vecinas: punto medio; al final, última + 1000; al principio, primera - 1000.
 * `posicion` es numeric en la base, pero acá pasa por un número de JS: tras unas 50 inserciones
 * seguidas en el mismo hueco, dos tareas empatan. Un empate no rompe nada: se desempata por id.
 */
export function calcularPosicion(anterior: number | null, siguiente: number | null): number {
  if (anterior === null && siguiente === null) return SALTO_POSICION;
  if (siguiente === null) return anterior! + SALTO_POSICION;
  if (anterior === null) return siguiente - SALTO_POSICION;
  return (anterior + siguiente) / 2;
}

type ConPosicion = { id: string; posicion: number };

export function ordenarPorPosicion<T extends ConPosicion>(tareas: readonly T[]): T[] {
  return [...tareas].sort((a, b) => a.posicion - b.posicion || a.id.localeCompare(b.id));
}

/**
 * Posición de la tarea `id` al soltarla en una columna, antes de `sobreId` (o al final, si es
 * null). Dentro de la misma columna, bajar deja la tarea después de `sobreId`, como se ve al
 * arrastrar. Null si queda donde estaba.
 */
export function posicionAlSoltar(columna: readonly ConPosicion[], id: string, sobreId: string | null): number | null {
  const ordenada = ordenarPorPosicion(columna);
  const origen = ordenada.findIndex((t) => t.id === id);
  const resto = ordenada.filter((t) => t.id !== id);

  let indice = resto.length;
  if (sobreId !== null && sobreId !== id) {
    const destino = resto.findIndex((t) => t.id === sobreId);
    if (destino !== -1) {
      const bajando = origen !== -1 && origen <= destino;
      indice = bajando ? destino + 1 : destino;
    }
  } else if (sobreId === id) {
    return null;
  }

  if (origen === indice) return null;
  return calcularPosicion(resto[indice - 1]?.posicion ?? null, resto[indice]?.posicion ?? null);
}

/** El paso que sigue, para el cambio de estado en un toque. Null si ya está cerrada. */
export function estadoSiguiente(estado: EstadoTarea): { estado: EstadoTarea; accion: string } | null {
  switch (estado) {
    case "por_hacer":
      return { estado: "en_curso", accion: "Empezar" };
    case "en_curso":
      return { estado: "en_revision", accion: "A revisión" };
    case "en_revision":
      return { estado: "hecha", accion: "Terminar" };
    default:
      return null;
  }
}

export type GrupoMisTareas = "vencidas" | "hoy" | "proximas" | "sin_fecha";

export const NOMBRE_GRUPO: Record<GrupoMisTareas, string> = {
  vencidas: "Vencidas",
  hoy: "Hoy",
  proximas: "Próximas",
  sin_fecha: "Sin fecha",
};

export function grupoDeTarea(tarea: { estado: string; fecha_limite: string | null }, hoy: string): GrupoMisTareas {
  if (!tarea.fecha_limite) return "sin_fecha";
  if (estaVencida(tarea, hoy)) return "vencidas";
  return tarea.fecha_limite === hoy ? "hoy" : "proximas";
}
