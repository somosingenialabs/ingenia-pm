import { z } from "zod";
import { ROLES } from "@/lib/auth/tipos";
import { LARGO_MINIMO_CLAVE } from "./auth";
import { idValido } from "./comun";

const rol = z.enum(ROLES, "Elegí un rol.");

export const esquemaInvitar = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Escribí un mail válido.")),
  rol,
});
export type EntradaInvitar = z.input<typeof esquemaInvitar>;

/** El token es lo que viene en el enlace: 32 bytes en base64url. */
export const esquemaToken = z.string().regex(/^[\w-]{43}$/, "El enlace no es válido.");

/** Persona nueva: nombre y contraseña. */
export const esquemaCuentaNueva = z
  .object({
    nombre: z.string().trim().min(2, "Escribí tu nombre.").max(120, "Tiene que tener 120 caracteres o menos."),
    clave: z.string().min(LARGO_MINIMO_CLAVE, `Tiene que tener ${LARGO_MINIMO_CLAVE} caracteres o más.`),
    repetida: z.string(),
  })
  .refine((d) => d.clave === d.repetida, { path: ["repetida"], message: "Las dos contraseñas no coinciden." });
export type EntradaCuentaNueva = z.input<typeof esquemaCuentaNueva>;

export const esquemaCambioRol = z.object({ usuarioId: idValido, rol });

export const esquemaHoras = z.object({
  usuarioId: idValido,
  horas: z.coerce.number("Escribí un número.").min(0, "No puede ser negativo.").max(80, "Tiene que ser 80 o menos."),
});
