import { z } from "zod";
import { AYUDA_DURACION, MAX_MINUTOS, parsearDuracion } from "@/lib/data/tiempo/reglas";
import { esFechaDeBase } from "@/lib/fechas";
import { idValido, textoOpcional } from "./comun";

/** Texto del campo de duración a minutos: "1:30", "1.5" o "90m". */
const duracion = z
  .string("Escribí cuánto trabajaste.")
  .transform((texto, ctx) => {
    const minutos = parsearDuracion(texto);
    if (minutos === null) {
      ctx.addIssue({ code: "custom", message: `No entendimos la duración. ${AYUDA_DURACION} Hasta 24 h.` });
      return z.NEVER;
    }
    return minutos;
  });

const fecha = z.string().refine(esFechaDeBase, "Elegí una fecha válida.");
const nota = textoOpcional(500, "La nota tiene que tener 500 caracteres o menos.");

/** Carga manual. La fecha futura la rechaza la base, con la fecha de la empresa. */
export const esquemaRegistroManual = z.object({ tarea_id: idValido, fecha, duracion, nota });

export const esquemaEdicionRegistro = z.object({ id: idValido, tarea_id: idValido, fecha, duracion, nota });

/** Al detener: minutos corregidos (desde 10 h, o obligatorios desde 24 h) y una nota. */
export const esquemaDetener = z.object({
  minutos: z.int("Escribí minutos enteros.").min(1).max(MAX_MINUTOS).optional(),
  nota: textoOpcional(500, "La nota tiene que tener 500 caracteres o menos."),
});
