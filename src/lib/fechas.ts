import { addDays, format, isValid, parse } from "date-fns";
import { es } from "date-fns/locale";

/**
 * La única puerta para columnas `date` de la base, que llegan como "2026-11-03".
 * Nunca `new Date("2026-11-03")`: se interpreta en UTC y en Argentina muestra el día anterior.
 */
export function fechaDesdeBase(fecha: string): Date {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Date(anio!, mes! - 1, dia!);
}

export function fechaParaBase(fecha: Date): string {
  return format(fecha, "yyyy-MM-dd");
}

/** ¿Es una fecha real con el formato de la base? "2026-02-31" no lo es. */
export function esFechaDeBase(texto: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  return isValid(parse(texto, "yyyy-MM-dd", new Date()));
}

/**
 * Hoy en la zona de la empresa. `current_date` y el reloj del servidor están en UTC: a la noche
 * en Argentina ya es mañana. Las fechas de la base se comparan como texto contra este valor.
 */
export function hoyEnZona(zonaHoraria: string, ahora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaHoraria,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ahora);
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}

export function sumarDias(fecha: string, dias: number): string {
  return fechaParaBase(addDays(fechaDesdeBase(fecha), dias));
}

/** "3 nov" o, con `anio`, "3 nov 2026". */
export function formatearFecha(fecha: string, { anio = false }: { anio?: boolean } = {}): string {
  return format(fechaDesdeBase(fecha), anio ? "d MMM yyyy" : "d MMM", { locale: es });
}

/** "lun 3". */
export function formatearDia(fecha: string): string {
  return format(fechaDesdeBase(fecha), "EEE d", { locale: es });
}

/** Lunes a viernes de la semana de `hoy`. Sábado y domingo ya miran la semana que viene. */
export function diasLaborales(hoy: string): string[] {
  const diaSemana = fechaDesdeBase(hoy).getDay(); // 0 domingo, 6 sábado
  const hastaLunes = diaSemana === 0 ? 1 : diaSemana === 6 ? 2 : 1 - diaSemana;
  const lunes = sumarDias(hoy, hastaLunes);
  return [0, 1, 2, 3, 4].map((i) => sumarDias(lunes, i));
}
