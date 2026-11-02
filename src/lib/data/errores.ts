import type { z } from "zod";
import { mensajeDeError } from "@/components/estado/mensaje-de-error";
import { erroresPorCampo } from "@/lib/validaciones/comun";

// Armar un `Resultado` con error. Vale para todas las acciones.

export function errorDeValidacion(error: z.ZodError) {
  return {
    ok: false as const,
    error: error.issues[0]?.message ?? "Revisá los datos.",
    campos: erroresPorCampo(error),
  };
}

/** El detalle crudo queda en el log del servidor, sin los datos de la fila. */
export function errorDeBase(error: { message: string; code?: string }, donde: string) {
  console.error(`${donde}:`, error.code ?? "sin código");
  return { ok: false as const, error: mensajeDeError(error) };
}

/**
 * El RLS no da error en un update o delete que no alcanza ninguna fila: simplemente no hace nada.
 * Por eso las acciones piden la fila de vuelta, y si no vuelve, avisan.
 */
export const SIN_FILAS = { ok: false as const, error: "No tenés permiso para hacer esto, o ya no existe." };
