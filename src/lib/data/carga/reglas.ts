import { addDays, startOfWeek } from "date-fns";
import type { PersonaRef } from "@/lib/data/comun";
import { fechaDesdeBase, fechaParaBase, formatearFecha, sumarDias } from "@/lib/fechas";

// Reglas puras de la carga por persona: sin base ni React.

/** Semanas que muestra la grilla. */
export const SEMANAS_CARGA = 8;

/**
 * Umbrales sobre horas asignadas / capacidad. Libre: menos del 70 %. Normal: del 70 % al 100 %,
 * inclusive. Sobrecargada: más del 100 %.
 */
export const UMBRALES_CARGA = { normalDesde: 0.7, sobrecargaDesde: 1 } as const;

export type NivelCarga = "libre" | "normal" | "sobrecargada";

export const NOMBRE_NIVEL: Record<NivelCarga, string> = {
  libre: "Libre",
  normal: "Normal",
  sobrecargada: "Sobrecargada",
};

/** Proporción asignada / capacidad. Null si la capacidad es 0: no hay porcentaje que dar. */
export function proporcion(horas: number, capacidad: number): number | null {
  return capacidad > 0 ? horas / capacidad : null;
}

export function nivelDeCarga(horas: number, capacidad: number): NivelCarga {
  const p = proporcion(horas, capacidad);
  // Sin capacidad, cualquier hora asignada ya es de más.
  if (p === null) return horas > 0 ? "sobrecargada" : "libre";
  if (p > UMBRALES_CARGA.sobrecargaDesde) return "sobrecargada";
  if (p >= UMBRALES_CARGA.normalDesde) return "normal";
  return "libre";
}

/** Lunes de la semana de `fecha`. Las fechas son de la zona de la empresa (ver hoyEnZona). */
export function lunesDe(fecha: string): string {
  return fechaParaBase(startOfWeek(fechaDesdeBase(fecha), { weekStartsOn: 1 }));
}

export function semanasDesde(lunes: string, cantidad = SEMANAS_CARGA): string[] {
  return Array.from({ length: cantidad }, (_, i) => sumarDias(lunes, i * 7));
}

/** "3 nov al 9 nov". */
export function textoSemana(lunes: string): string {
  return `${formatearFecha(lunes)} al ${formatearFecha(fechaParaBase(addDays(fechaDesdeBase(lunes), 6)))}`;
}

/** Para encabezados angostos: "2 al 8 nov", o "30 nov al 6 dic" si cruza de mes. */
export function textoSemanaCorto(lunes: string): string {
  const domingo = fechaParaBase(addDays(fechaDesdeBase(lunes), 6));
  return lunes.slice(0, 7) === domingo.slice(0, 7)
    ? `${Number(lunes.slice(8))} al ${formatearFecha(domingo)}`
    : textoSemana(lunes);
}

const formatoHoras = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

/** "13,5 h". */
export function textoHoras(horas: number): string {
  return `${formatoHoras.format(horas)} h`;
}

/** "5,8 / 40 h". */
export function textoHorasSobreCapacidad(horas: number, capacidad: number): string {
  return `${formatoHoras.format(horas)} / ${textoHoras(capacidad)}`;
}

export type FilaCarga = {
  usuario_id: string;
  semana: string;
  horas_asignadas: number;
  /** Parte de horas_asignadas que es de tareas vencidas: cae toda en hoy. */
  horas_atrasadas: number;
  capacidad: number;
  tareas_sin_estimar: number;
  tareas_sin_fecha: number;
};

export type CeldaCarga = { semana: string; horas: number; atrasadas: number; capacidad: number; nivel: NivelCarga; proporcion: number | null };
export type PersonaCarga = { persona: PersonaRef; sinEstimar: number; sinFecha: number; semanas: CeldaCarga[] };

/**
 * De las filas de `analitica.carga_por_persona` a la grilla: una persona por fila, en el orden
 * de `semanas`. Una persona sin nombre conocido (no debería pasar) se muestra igual, sin perderla.
 */
export function armarGrilla(filas: readonly FilaCarga[], personas: readonly PersonaRef[], semanas: readonly string[]): PersonaCarga[] {
  const porId = new Map(personas.map((p) => [p.id, p]));
  const agrupadas = new Map<string, FilaCarga[]>();
  for (const f of filas) agrupadas.set(f.usuario_id, [...(agrupadas.get(f.usuario_id) ?? []), f]);

  return [...agrupadas.entries()]
    .map(([id, propias]) => {
      const capacidad = Number(propias[0]?.capacidad ?? 0);
      return {
        persona: porId.get(id) ?? { id, nombre: "Persona sin nombre", avatarUrl: null },
        sinEstimar: propias[0]?.tareas_sin_estimar ?? 0,
        sinFecha: propias[0]?.tareas_sin_fecha ?? 0,
        semanas: semanas.map((semana) => {
          const fila = propias.find((f) => f.semana === semana);
          const horas = Number(fila?.horas_asignadas ?? 0);
          const cap = Number(fila?.capacidad ?? capacidad);
          const atrasadas = Number(fila?.horas_atrasadas ?? 0);
          return { semana, horas, atrasadas, capacidad: cap, nivel: nivelDeCarga(horas, cap), proporcion: proporcion(horas, cap) };
        }),
      };
    })
    .sort((a, b) => a.persona.nombre.localeCompare(b.persona.nombre));
}
