import { differenceInCalendarDays } from "date-fns";
import { fechaDesdeBase } from "@/lib/fechas";
import { estaVencida } from "@/lib/data/tareas/reglas";

/** Umbrales de "En riesgo": a menos de estos días del objetivo, con menos de este avance. */
export const UMBRALES_SALUD = { diasAlObjetivo: 7, avanceMinimo: 0.8 } as const;

export type Salud = "al_dia" | "en_riesgo" | "atrasado";

export const NOMBRE_SALUD: Record<Salud, string> = {
  al_dia: "Al día",
  en_riesgo: "En riesgo",
  atrasado: "Atrasado",
};

export type TareaParaSalud = { estado: string; prioridad: string; fecha_limite: string | null };
export type ProyectoParaSalud = { estado: string; fecha_fin_objetivo: string | null };

export function proyectoAbierto(estado: string): boolean {
  return estado !== "terminado" && estado !== "cancelado";
}

/** Tareas `hecha` / tareas no canceladas, de 0 a 1. Sin tareas, null: se muestra "Sin tareas", no 0 %. */
export function calcularAvance(tareas: readonly { estado: string }[]): number | null {
  const vigentes = tareas.filter((t) => t.estado !== "cancelada");
  if (vigentes.length === 0) return null;
  return vigentes.filter((t) => t.estado === "hecha").length / vigentes.length;
}

export function textoAvance(avance: number | null): string {
  return avance === null ? "Sin tareas" : `${Math.round(avance * 100)} %`;
}

/**
 * Atrasado: objetivo pasado con el proyecto abierto, o tarea urgente vencida.
 * En riesgo: alguna tarea vencida, o menos de 7 días al objetivo con avance menor a 80 %.
 * Al día: el resto. Sin tareas no hay avance, y cerca del objetivo eso también es riesgo.
 * Un proyecto terminado o cancelado ya no se atrasa.
 */
export function calcularSalud(proyecto: ProyectoParaSalud, tareas: readonly TareaParaSalud[], hoy: string): Salud {
  if (!proyectoAbierto(proyecto.estado)) return "al_dia";

  const objetivo = proyecto.fecha_fin_objetivo;
  const vencidas = tareas.filter((t) => estaVencida(t, hoy));
  if ((objetivo && objetivo < hoy) || vencidas.some((t) => t.prioridad === "urgente")) return "atrasado";
  if (vencidas.length > 0) return "en_riesgo";

  if (objetivo) {
    const dias = differenceInCalendarDays(fechaDesdeBase(objetivo), fechaDesdeBase(hoy));
    if (dias < UMBRALES_SALUD.diasAlObjetivo && (calcularAvance(tareas) ?? 0) < UMBRALES_SALUD.avanceMinimo) {
      return "en_riesgo";
    }
  }
  return "al_dia";
}
