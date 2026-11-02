"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { obtenerContexto } from "@/lib/auth/contexto";
import { puedeConfigurar } from "@/lib/auth/permisos";
import type { Rol } from "@/lib/auth/tipos";
import type { Resultado } from "@/lib/data/comun";
import { errorDeBase, errorDeValidacion, SIN_FILAS } from "@/lib/data/errores";
import { crearClienteAdmin, crearClienteServidor } from "@/lib/supabase/server";
import { idValido } from "@/lib/validaciones/comun";
import { esquemaCambioRol, esquemaCuentaNueva, esquemaHoras, esquemaInvitar, esquemaToken } from "@/lib/validaciones/miembros";
import { estadoDeInvitacion, generarToken, hashDeToken, MENSAJE_INVITACION } from "./invitacion";

const SIN_PERMISO = { ok: false as const, error: "Solo un Admin puede administrar miembros." };
const RUTA_MIEMBROS = "/configuracion/miembros";

/** Genera el enlace de invitación. En la base queda solo el hash: el enlace no se puede volver a ver. */
export async function invitar(datos: unknown): Promise<Resultado<{ enlace: string; email: string; rol: Rol }>> {
  const validado = esquemaInvitar.safeParse(datos);
  if (!validado.success) return errorDeValidacion(validado.error);
  const { email, rol } = validado.data;

  const { organizacion, rol: miRol } = await obtenerContexto();
  if (!puedeConfigurar(miRol)) return SIN_PERMISO;
  const db = await crearClienteServidor();

  const { data: yaEsMiembro, error: errorMiembro } = await db
    .from("miembros")
    .select("usuario_id, perfil:perfiles!miembros_usuario_id_fkey!inner(email)")
    .eq("organizacion_id", organizacion.id)
    .eq("activo", true)
    .eq("perfil.email", email);
  if (errorMiembro) return errorDeBase(errorMiembro, "invitar");
  if (yaEsMiembro.length > 0) return { ok: false, error: "Esa persona ya es miembro de la empresa.", campos: { email: "Ya es miembro de la empresa." } };

  // El índice de "una sola pendiente" no sabe de vencimientos: la vencida no puede trabar una nueva.
  const { error: errorVencidas } = await db
    .from("invitaciones")
    .update({ revocada_en: new Date().toISOString() })
    .eq("organizacion_id", organizacion.id)
    .eq("email", email)
    .is("aceptada_en", null)
    .is("revocada_en", null)
    .lte("vence_en", new Date().toISOString());
  if (errorVencidas) return errorDeBase(errorVencidas, "invitar");

  const token = generarToken();
  const { error } = await db
    .from("invitaciones")
    .insert({ organizacion_id: organizacion.id, email, rol, token_hash: hashDeToken(token) });
  if (error?.code === "23505") {
    return { ok: false, error: "Ya hay una invitación pendiente para ese mail. Cancelala para generar otra.", campos: { email: "Ya tiene una invitación pendiente." } };
  }
  if (error) return errorDeBase(error, "invitar");

  revalidatePath(RUTA_MIEMBROS);
  const origen = (await headers()).get("origin") ?? "";
  return { ok: true, datos: { enlace: `${origen}/invitacion/${token}`, email, rol } };
}

export async function revocarInvitacion(id: string): Promise<Resultado> {
  const idOk = idValido.safeParse(id);
  if (!idOk.success) return errorDeValidacion(idOk.error);
  const { rol } = await obtenerContexto();
  if (!puedeConfigurar(rol)) return SIN_PERMISO;

  const db = await crearClienteServidor();
  const { data, error } = await db
    .from("invitaciones")
    .update({ revocada_en: new Date().toISOString() })
    .eq("id", id)
    .is("aceptada_en", null)
    .is("revocada_en", null)
    .select("id");
  if (error) return errorDeBase(error, "revocarInvitacion");
  if (data.length === 0) return SIN_FILAS;

  revalidatePath(RUTA_MIEMBROS);
  return { ok: true, datos: undefined };
}

/**
 * `/invitacion/[token]`. Todo se valida acá contra el hash: la pantalla no decide nada.
 * - Mail nuevo: crea el usuario, suma la membresía e inicia sesión.
 * - Mail existente: pide ingresar (o usa la sesión abierta, si es de ese mail) y suma la membresía.
 *
 * La clave secreta se usa recién después de encontrar una invitación vigente para ese hash.
 * La membresía la da `aceptar_invitacion`, que vuelve a validar todo en una transacción.
 */
export async function aceptarInvitacion(datos: {
  token: string;
  cuenta?: unknown;
  clave?: string;
}): Promise<Resultado> {
  const tokenOk = esquemaToken.safeParse(datos.token);
  if (!tokenOk.success) return { ok: false, error: MENSAJE_INVITACION.invalida };
  const hash = hashDeToken(tokenOk.data);

  const admin = crearClienteAdmin();
  const { data: filas, error: errorInvitacion } = await admin.rpc("invitacion_por_token", { p_token_hash: hash });
  if (errorInvitacion) return errorDeBase(errorInvitacion, "aceptarInvitacion");
  const invitacion = filas?.[0];
  if (!invitacion) return { ok: false, error: MENSAJE_INVITACION.invalida };
  const estado = estadoDeInvitacion(invitacion);
  if (estado !== "vigente") return { ok: false, error: MENSAJE_INVITACION[estado] };

  const db = await crearClienteServidor();

  if (!invitacion.usuario_existe) {
    const cuenta = esquemaCuentaNueva.safeParse(datos.cuenta);
    if (!cuenta.success) return errorDeValidacion(cuenta.error);

    const { data: creado, error: errorCrear } = await admin.auth.admin.createUser({
      email: invitacion.email,
      password: cuenta.data.clave,
      email_confirm: true,
      user_metadata: { nombre_completo: cuenta.data.nombre },
    });
    if (errorCrear || !creado.user) {
      console.error("aceptarInvitacion:", errorCrear?.code ?? errorCrear?.status);
      return { ok: false, error: "No pudimos crear tu cuenta. Probá de nuevo en unos minutos." };
    }

    const { error: errorAceptar } = await admin.rpc("aceptar_invitacion", { p_token_hash: hash, p_usuario: creado.user.id });
    if (errorAceptar) {
      // Otro pedido usó el token en el medio: no dejamos una cuenta suelta sin empresa.
      await admin.auth.admin.deleteUser(creado.user.id);
      return errorDeBase(errorAceptar, "aceptarInvitacion");
    }
    // Se inicia sesión después de aceptar: así el token ya sale con la empresa activa.
    const { error: errorIngreso } = await db.auth.signInWithPassword({ email: invitacion.email, password: cuenta.data.clave });
    if (errorIngreso) return { ok: false, error: "Tu cuenta quedó lista, pero no pudimos iniciar sesión. Ingresá con tu mail y contraseña." };
    return { ok: true, datos: undefined };
  }

  const {
    data: { user },
  } = await db.auth.getUser();
  let usuarioId = user?.email?.toLowerCase() === invitacion.email ? user.id : null;
  if (!usuarioId) {
    if (user) return { ok: false, error: `Esta invitación es para ${invitacion.email}. Salí de tu sesión y volvé a abrir el enlace.` };
    if (!datos.clave) return { ok: false, error: "Escribí tu contraseña.", campos: { clave: "Escribí tu contraseña." } };
    const { data: ingreso, error: errorIngreso } = await db.auth.signInWithPassword({ email: invitacion.email, password: datos.clave });
    if (errorIngreso || !ingreso.user) return { ok: false, error: "La contraseña no coincide.", campos: { clave: "La contraseña no coincide." } };
    usuarioId = ingreso.user.id;
  }

  const { error: errorAceptar } = await admin.rpc("aceptar_invitacion", { p_token_hash: hash, p_usuario: usuarioId });
  if (errorAceptar) return errorDeBase(errorAceptar, "aceptarInvitacion");

  // El hook pone org_id al emitir el token: sin renovarlo, el RLS devuelve vacío en la empresa nueva.
  const { error: errorRefresco } = await db.auth.refreshSession();
  if (errorRefresco) return { ok: false, error: "Ya sos parte de la empresa. Salí e ingresá de nuevo para verla." };
  return { ok: true, datos: undefined };
}

export async function cambiarRol(datos: unknown): Promise<Resultado> {
  const validado = esquemaCambioRol.safeParse(datos);
  if (!validado.success) return errorDeValidacion(validado.error);
  return actualizarMiembro(validado.data.usuarioId, { rol: validado.data.rol }, "cambiarRol");
}

export async function cambiarHorasSemanales(datos: unknown): Promise<Resultado> {
  const validado = esquemaHoras.safeParse(datos);
  if (!validado.success) return errorDeValidacion(validado.error);
  return actualizarMiembro(validado.data.usuarioId, { horas_semanales: validado.data.horas }, "cambiarHorasSemanales");
}

/** Las personas no se borran. Sus tareas quedan a su nombre. */
export async function desactivarMiembro(usuarioId: string): Promise<Resultado> {
  const idOk = idValido.safeParse(usuarioId);
  if (!idOk.success) return errorDeValidacion(idOk.error);
  return actualizarMiembro(usuarioId, { activo: false }, "desactivarMiembro");
}

async function actualizarMiembro(
  usuarioId: string,
  cambios: { rol?: Rol; horas_semanales?: number; activo?: boolean },
  donde: string,
): Promise<Resultado> {
  const { organizacion, rol } = await obtenerContexto();
  if (!puedeConfigurar(rol)) return SIN_PERMISO;

  const db = await crearClienteServidor();
  // Por la empresa, siempre: una persona puede ser miembro de más de una.
  const { data, error } = await db
    .from("miembros")
    .update(cambios)
    .eq("organizacion_id", organizacion.id)
    .eq("usuario_id", usuarioId)
    .select("id");
  if (error) return errorDeBase(error, donde);
  if (data.length === 0) return SIN_FILAS;

  revalidatePath(RUTA_MIEMBROS);
  return { ok: true, datos: undefined };
}
