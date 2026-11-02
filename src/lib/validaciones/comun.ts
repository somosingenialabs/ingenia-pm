import { z } from "zod";
import { esFechaDeBase } from "@/lib/fechas";

// Todos dejan pasar `undefined` tal cual: en una edición parcial, un campo que no vino no se
// toca. Convertirlo en null borraría el dato.

/** Texto opcional: vacío se guarda como null. */
export function textoOpcional(maximo: number, mensaje: string) {
  return z
    .string()
    .trim()
    .max(maximo, mensaje)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v || null));
}

/** Fecha opcional de un campo `date`: vacía se guarda como null. */
export const fechaOpcional = z
  .string()
  .refine((v) => v === "" || esFechaDeBase(v), "Escribí una fecha válida.")
  .nullable()
  .optional()
  .transform((v) => (v === undefined ? undefined : v || null));

/** Número opcional que llega como texto de un formulario: vacío se guarda como null. */
export function numeroOpcional(maximo: number) {
  return z.preprocess(
    (v) => (v === undefined ? undefined : v === "" || v === null ? null : Number(v)),
    z
      .number("Escribí un número.")
      .min(0, "No puede ser negativo.")
      .max(maximo, `Tiene que ser ${maximo} o menos.`)
      .nullable()
      .optional(),
  );
}

export const idValido = z.uuid("Elegí una opción de la lista.");

/** Primer mensaje de cada campo, para `Resultado.campos`. */
export function erroresPorCampo(error: z.ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const problema of error.issues) {
    const clave = problema.path.join(".");
    campos[clave] ??= problema.message;
  }
  return campos;
}
