import { differenceInCalendarDays } from "date-fns";
import { lunesDe } from "@/lib/data/carga/reglas";
import { esFechaDeBase, fechaDesdeBase, formatearFecha, sumarDias } from "@/lib/fechas";

// Reglas de la pantalla de Analítica: período, comparación y cuándo un número se puede mostrar.
// Los cálculos los hacen las funciones de `analitica` en la base; acá solo se presentan.

/** Debajo de esto no se muestra una mediana ni un porcentaje: dos casos llevan a conclusiones falsas. */
export const MINIMO_N = 5;

/** Mismo límite que las funciones de la base (370 días). */
export const MAXIMO_DIAS = 370;

export const PERIODOS = ["4", "12", "26", "medida"] as const;
export type ClavePeriodo = (typeof PERIODOS)[number];
export const PERIODO_POR_DEFECTO: ClavePeriodo = "12";

export const NOMBRE_PERIODO: Record<ClavePeriodo, string> = {
  "4": "4 semanas",
  "12": "12 semanas",
  "26": "26 semanas",
  medida: "A medida",
};

export type Periodo = {
  clave: ClavePeriodo;
  desde: string;
  hasta: string;
  /** El mismo largo, justo antes: para la variación de las tarjetas chicas. */
  anteriorDesde: string;
  anteriorHasta: string;
  dias: number;
};

/**
 * Período pedido en la URL. 4, 12 o 26 semanas terminan hoy y arrancan un lunes, para que las
 * barras semanales no queden cortadas al principio. "A medida" necesita `desde` y `hasta`
 * válidos, en orden, sin pasar de hoy ni de 370 días; si no, vuelve al período por defecto.
 */
export function resolverPeriodo(
  { periodo, desde, hasta }: { periodo?: string | null; desde?: string | null; hasta?: string | null },
  hoy: string,
): Periodo {
  let clave: ClavePeriodo = PERIODOS.includes(periodo as ClavePeriodo) ? (periodo as ClavePeriodo) : PERIODO_POR_DEFECTO;
  let inicio: string;
  let fin = hoy;

  if (clave === "medida") {
    const valido =
      !!desde && !!hasta && esFechaDeBase(desde) && esFechaDeBase(hasta) && desde <= hasta && hasta <= hoy && diasEntre(desde, hasta) <= MAXIMO_DIAS;
    if (valido) {
      inicio = desde;
      fin = hasta;
    } else {
      clave = PERIODO_POR_DEFECTO;
      inicio = inicioDeSemanas(Number(clave), hoy);
    }
  } else {
    inicio = inicioDeSemanas(Number(clave), hoy);
  }

  const dias = diasEntre(inicio, fin);
  return { clave, desde: inicio, hasta: fin, anteriorDesde: sumarDias(inicio, -dias), anteriorHasta: sumarDias(inicio, -1), dias };
}

function inicioDeSemanas(semanas: number, hoy: string): string {
  return sumarDias(lunesDe(hoy), -7 * (semanas - 1));
}

/** Días de `desde` a `hasta`, los dos incluidos. */
export function diasEntre(desde: string, hasta: string): number {
  return differenceInCalendarDays(fechaDesdeBase(hasta), fechaDesdeBase(desde)) + 1;
}

/** "11 ago al 6 nov 2026". */
export function textoPeriodo(p: Pick<Periodo, "desde" | "hasta">): string {
  return `${formatearFecha(p.desde)} al ${formatearFecha(p.hasta, { anio: true })}`;
}

/** Cambio relativo contra el período anterior. Sin base (anterior en cero) no hay variación. */
export function variacion(actual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return (actual - anterior) / anterior;
}

export function hayDatosSuficientes(n: number): boolean {
  return n >= MINIMO_N;
}

/** "Todavía no hay datos suficientes (3 de 5)." */
export function textoInsuficiente(n: number): string {
  return `Todavía no hay datos suficientes (${n} de ${MINIMO_N}).`;
}

const formatoRatio = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Mediana de horas reales sobre estimadas, en palabras: "Tardamos 1,3 veces lo estimado". */
export function textoPrecision(ratio: number): string {
  const redondeado = Math.round(ratio * 10) / 10;
  if (redondeado === 1) return "Tardamos lo estimado";
  return `Tardamos ${formatoRatio.format(redondeado)} veces lo estimado`;
}

const formatoPorcentaje = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/** "73 %". La base devuelve porcentajes de 0 a 100. */
export function textoPorcentaje(valor: number): string {
  return `${formatoPorcentaje.format(valor)} %`;
}

/** "3 d 4 h" o "18 h": para tiempos en estado, que van de horas a semanas. */
export function textoDuracionLarga(horas: number): string {
  if (horas < 48) return `${Math.round(horas)} h`;
  const dias = Math.floor(horas / 24);
  const resto = Math.round(horas - dias * 24);
  return resto === 0 ? `${dias} d` : `${dias} d ${resto} h`;
}

/** Más de esta diferencia entre presupuesto consumido y avance (en puntos) es para mirar. */
export const DESVIO_PRESUPUESTO = 20;

export function consumoSobreAvance(porcentaje: number | null, avance: number | null): boolean {
  if (porcentaje === null || avance === null) return false;
  return porcentaje - avance > DESVIO_PRESUPUESTO;
}

// ---------------------------------------------------------------------------------------------
// Horas por proyecto: hasta 6 proyectos con nombre y el resto en "Otros"
// ---------------------------------------------------------------------------------------------

export const MAXIMO_PROYECTOS_GRAFICO = 6;
export const CLAVE_OTROS = "otros";

export type FilaHoras = { periodo: string; proyecto_id: string; usuario_id: string; horas: number; n: number };
export type SerieProyecto = { clave: string; nombre: string; total: number };
export type SemanaHoras = { semana: string; total: number; valores: Record<string, number> };

/**
 * Las series son los 6 proyectos con más horas del período (empate: por nombre), y "Otros" si
 * sobra alguno. El color sigue al proyecto: la serie i siempre usa el color i de la paleta, y el
 * orden no cambia entre semanas. Cada semana del período aparece, aunque no tenga horas.
 */
export function agruparHorasPorProyecto(
  filas: readonly FilaHoras[],
  nombres: ReadonlyMap<string, string>,
  semanas: readonly string[],
): { series: SerieProyecto[]; semanas: SemanaHoras[] } {
  const totales = new Map<string, number>();
  for (const f of filas) totales.set(f.proyecto_id, (totales.get(f.proyecto_id) ?? 0) + Number(f.horas));

  const nombreDe = (id: string) => nombres.get(id) ?? "Proyecto sin acceso";
  const ordenados = [...totales.entries()].sort(([a, x], [b, y]) => y - x || nombreDe(a).localeCompare(nombreDe(b)));
  const conNombre = ordenados.slice(0, MAXIMO_PROYECTOS_GRAFICO);
  const resto = ordenados.slice(MAXIMO_PROYECTOS_GRAFICO);

  const series: SerieProyecto[] = conNombre.map(([id, total]) => ({ clave: id, nombre: nombreDe(id), total: redondear(total) }));
  if (resto.length > 0) {
    series.push({ clave: CLAVE_OTROS, nombre: `Otros (${resto.length})`, total: redondear(resto.reduce((s, [, t]) => s + t, 0)) });
  }
  const claveDe = new Map(conNombre.map(([id]) => [id, id]));

  const porSemana = new Map<string, Record<string, number>>(semanas.map((s) => [s, {}]));
  for (const f of filas) {
    const valores = porSemana.get(f.periodo) ?? {};
    porSemana.set(f.periodo, valores);
    const clave = claveDe.get(f.proyecto_id) ?? CLAVE_OTROS;
    valores[clave] = redondear((valores[clave] ?? 0) + Number(f.horas));
  }

  return {
    series,
    semanas: [...porSemana.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([semana, valores]) => ({ semana, valores, total: redondear(Object.values(valores).reduce((s, v) => s + v, 0)) })),
  };
}

/** Lunes de cada semana que toca el período. */
export function semanasDelPeriodo(p: Pick<Periodo, "desde" | "hasta">): string[] {
  const semanas: string[] = [];
  for (let lunes = lunesDe(p.desde); lunes <= p.hasta; lunes = sumarDias(lunes, 7)) semanas.push(lunes);
  return semanas;
}

function redondear(horas: number): number {
  return Math.round(horas * 100) / 100;
}
