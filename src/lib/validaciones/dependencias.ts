import { z } from "zod";
import { idValido } from "./comun";

/** `tarea_id` no arranca hasta que termina `depende_de_id`, más el desfase. */
export const esquemaDependencia = z
  .object({
    tarea_id: idValido,
    depende_de_id: idValido,
    desfase_dias: z.preprocess(
      (v) => (v === "" || v === undefined || v === null ? 0 : Number(v)),
      z.number("Escribí un número de días.").int("Escribí días enteros.").min(0, "No puede ser negativo.").max(365, "Tiene que ser 365 o menos."),
    ),
  })
  .refine((d) => d.tarea_id !== d.depende_de_id, { path: ["depende_de_id"], message: "Una tarea no puede depender de sí misma." });
export type EntradaDependencia = z.input<typeof esquemaDependencia>;

export const esquemaQuitarDependencia = z.object({ tarea_id: idValido, depende_de_id: idValido });
