import { sumarDias } from "@/lib/fechas";

// Reglas puras de horas: sin base ni React.

/** Lo máximo que acepta un registro (la base tiene el mismo límite). */
export const MAX_MINUTOS = 1440;
/** Desde acá, al detener se pregunta "¿Lo dejaste prendido?". */
export const AVISO_PRENDIDO_MINUTOS = 10 * 60;
/** Un día con más que esto avisa, sin impedirlo. */
export const AVISO_DIA_MINUTOS = 12 * 60;

export const AYUDA_DURACION = "Como 1:30, 1.5 o 90m.";

/**
 * De lo que escribe la persona a minutos. Acepta "1:30", "1.5", "1,5", "2", "2h", "90m",
 * "90 min" y "1h30" o "1h 30m". Un número solo son horas. Devuelve null si no se entiende o si
 * queda fuera de 1 minuto a 24 h.
 */
export function parsearDuracion(texto: string): number | null {
  const t = texto.trim().toLowerCase().replace(/\s+/g, "");
  if (!t) return null;

  let minutos: number | null = null;
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d{1,2}):([0-5]\d)$/))) {
    minutos = Number(m[1]) * 60 + Number(m[2]);
  } else if ((m = t.match(/^(\d{1,4})(?:m|min|mins|minutos?)$/))) {
    minutos = Number(m[1]);
  } else if ((m = t.match(/^(\d{1,2})h(?:s|oras?)?(\d{1,2})(?:m|min|mins|minutos?)?$/))) {
    if (Number(m[2]) > 59) return null;
    minutos = Number(m[1]) * 60 + Number(m[2]);
  } else if ((m = t.match(/^(\d{1,2}(?:[.,]\d{1,2})?)(?:h|hs|horas?)?$/))) {
    minutos = Math.round(Number(m[1]!.replace(",", ".")) * 60);
  }
  if (minutos === null || minutos < 1 || minutos > MAX_MINUTOS) return null;
  return minutos;
}

/** "1 h 30 min", "45 min", "2 h". */
export function textoDuracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "1:30", para precargar el campo de duración. */
export function duracionParaCampo(minutos: number): string {
  return `${Math.floor(minutos / 60)}:${String(minutos % 60).padStart(2, "0")}`;
}

/** Totales de la grilla: "7:45". Sin horas, "0:00". */
export const textoTotal = duracionParaCampo;

/** Cronómetro: "0:05:09", "12:00:00". */
export function textoCronometro(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${h}:${mm}:${ss}`;
}

/** Segundos desde `inicio` (de la base) hasta `ahora`. Nunca negativos, por si el reloj del navegador atrasa. */
export function segundosCorridos(inicio: string, ahora: number): number {
  return Math.max(0, (ahora - Date.parse(inicio)) / 1000);
}

/** Minutos que se guardarían al detener: los mismos que calcula la base. */
export function minutosAlDetener(inicio: string, ahora: number): number {
  return Math.max(1, Math.round(segundosCorridos(inicio, ahora) / 60));
}

export type RegistroSemana = {
  tareaId: string;
  tareaTitulo: string;
  proyectoNombre: string;
  fecha: string;
  minutos: number | null;
};

export type FilaSemana = { tareaId: string; tareaTitulo: string; proyectoNombre: string; dias: number[]; total: number };
export type Semana = { dias: string[]; filas: FilaSemana[]; totalesPorDia: number[]; total: number; diasLargos: string[] };

/**
 * Grilla de una semana: una fila por tarea, una columna por día de lunes a domingo, con totales.
 * Un temporizador corriendo (minutos nulos) todavía no suma. Filas por proyecto y tarea.
 */
export function armarSemana(registros: readonly RegistroSemana[], lunes: string): Semana {
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const porTarea = new Map<string, FilaSemana>();
  const totalesPorDia = dias.map(() => 0);

  for (const r of registros) {
    const i = dias.indexOf(r.fecha);
    if (i === -1 || r.minutos === null) continue;
    let fila = porTarea.get(r.tareaId);
    if (!fila) {
      fila = { tareaId: r.tareaId, tareaTitulo: r.tareaTitulo, proyectoNombre: r.proyectoNombre, dias: dias.map(() => 0), total: 0 };
      porTarea.set(r.tareaId, fila);
    }
    fila.dias[i]! += r.minutos;
    fila.total += r.minutos;
    totalesPorDia[i]! += r.minutos;
  }

  const filas = [...porTarea.values()].sort(
    (a, b) => a.proyectoNombre.localeCompare(b.proyectoNombre) || a.tareaTitulo.localeCompare(b.tareaTitulo),
  );
  return {
    dias,
    filas,
    totalesPorDia,
    total: totalesPorDia.reduce((a, b) => a + b, 0),
    diasLargos: dias.filter((_, i) => totalesPorDia[i]! > AVISO_DIA_MINUTOS),
  };
}
