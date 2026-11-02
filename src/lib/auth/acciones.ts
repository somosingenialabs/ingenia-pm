"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Resultado } from "@/lib/data/comun";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esquemaIngreso, esquemaNuevaClave, esquemaRecuperar } from "@/lib/validaciones/auth";

const ERROR_INGRESO = "El mail o la contraseña no coinciden.";
const ERROR_GENERAL = "No pudimos completar el pedido. Probá de nuevo en unos minutos.";

/** Mail y contraseña. Cualquier rechazo da el mismo error: no revela si el mail existe. */
export async function ingresar(datos: unknown): Promise<Resultado> {
  const validado = esquemaIngreso.safeParse(datos);
  if (!validado.success) return { ok: false, error: ERROR_INGRESO };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email: validado.data.email,
    password: validado.data.clave,
  });
  if (error) return { ok: false, error: ERROR_INGRESO };
  return { ok: true, datos: undefined };
}

/** Pide el mail de recuperación. Responde lo mismo exista o no el mail. */
export async function recuperar(datos: unknown): Promise<Resultado> {
  const validado = esquemaRecuperar.safeParse(datos);
  if (!validado.success) return { ok: false, error: "Escribí un mail válido." };

  // El origen lo controla Next en las Server Actions, y Auth solo acepta las URLs de su lista.
  const origen = (await headers()).get("origin") ?? "";
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.resetPasswordForEmail(validado.data.email, {
    redirectTo: `${origen}/auth/callback?next=/nueva-clave`,
  });
  // Solo el código: el mensaje podría traer datos de la persona.
  if (error) console.error("recuperar:", error.code ?? error.status);
  return { ok: true, datos: undefined };
}

/** Define la contraseña nueva de quien tiene sesión (la que abrió el enlace del mail). */
export async function definirClave(datos: unknown): Promise<Resultado> {
  const validado = esquemaNuevaClave.safeParse(datos);
  if (!validado.success) {
    return { ok: false, error: validado.error.issues[0]?.message ?? ERROR_GENERAL };
  }

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "El enlace venció. Pedí uno nuevo." };

  const { error } = await supabase.auth.updateUser({ password: validado.data.clave });
  if (error) {
    return {
      ok: false,
      error: error.code === "same_password" ? "Elegí una contraseña distinta de la anterior." : ERROR_GENERAL,
    };
  }
  return { ok: true, datos: undefined };
}

/** Cierra la sesión de este dispositivo y vuelve a /ingresar. */
export async function salir(): Promise<void> {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/ingresar");
}
