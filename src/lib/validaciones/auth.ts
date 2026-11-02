import { z } from "zod";

const mail = z.email("Escribí un mail válido.");

export const esquemaIngreso = z.object({
  email: mail,
  clave: z.string().min(1, "Escribí tu contraseña."),
});
export type DatosIngreso = z.infer<typeof esquemaIngreso>;

export const esquemaRecuperar = z.object({ email: mail });
export type DatosRecuperar = z.infer<typeof esquemaRecuperar>;

export const LARGO_MINIMO_CLAVE = 10;

export const esquemaNuevaClave = z
  .object({
    clave: z.string().min(LARGO_MINIMO_CLAVE, `Tiene que tener ${LARGO_MINIMO_CLAVE} caracteres o más.`),
    repetida: z.string(),
  })
  .refine((d) => d.clave === d.repetida, { path: ["repetida"], message: "Las dos contraseñas no coinciden." });
export type DatosNuevaClave = z.infer<typeof esquemaNuevaClave>;
