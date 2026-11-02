import { z } from "zod";
import { contraste } from "@/lib/color";

export const esquemaPerfil = z.object({
  nombre_completo: z.string().trim().min(2, "Escribí tu nombre.").max(120, "Tiene que tener 120 caracteres o menos."),
});
export type EntradaPerfil = z.input<typeof esquemaPerfil>;

function zonaValida(zona: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}

/** El acento también se usa como color de links chicos sobre fondo claro: tiene que llegar a AA contra el blanco. */
export const CONTRASTE_MINIMO_ACENTO = 4.5;

export const esquemaOrganizacion = z.object({
  nombre: z.string().trim().min(2, "Escribí un nombre de 2 caracteres o más.").max(120, "Tiene que tener 120 caracteres o menos."),
  zona_horaria: z.string().refine(zonaValida, "Elegí una zona horaria de la lista."),
  color_acento: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Escribí un color como #0062CC.")
    .refine((c) => contraste(c, "#ffffff") >= CONTRASTE_MINIMO_ACENTO, "Es muy claro: el texto no se llegaría a leer. Elegí uno más oscuro.")
    .nullable(),
});
export type EntradaOrganizacion = z.input<typeof esquemaOrganizacion>;

export const TIPOS_DE_IMAGEN = ["image/png", "image/jpeg", "image/webp"] as const;
export const TAMANO_MAXIMO_IMAGEN = 2 * 1024 * 1024;
