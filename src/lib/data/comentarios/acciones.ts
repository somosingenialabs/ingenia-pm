"use server";

import { obtenerContexto } from "@/lib/auth/contexto";
import type { Resultado } from "@/lib/data/comun";
import { errorDeBase, errorDeValidacion, SIN_FILAS } from "@/lib/data/errores";
import { crearClienteServidor } from "@/lib/supabase/server";
import { idValido } from "@/lib/validaciones/comun";
import { esquemaComentario, esquemaEdicionComentario } from "@/lib/validaciones/comentarios";
import { SELECT_COMENTARIO, type ComentarioFila } from "./consultas";

// Sin revalidatePath: los comentarios se leen desde el navegador y llegan por Realtime.

/**
 * Comenta a nombre de quien llama (el RLS no deja otra cosa). Si el mismo id ya está guardado,
 * es un reintento de un envío que sí llegó: devuelve ese comentario en vez de fallar.
 */
export async function crearComentario(datos: unknown): Promise<Resultado<ComentarioFila>> {
  const validado = esquemaComentario.safeParse(datos);
  if (!validado.success) return errorDeValidacion(validado.error);

  const { usuario, organizacion } = await obtenerContexto();
  const db = await crearClienteServidor();
  const { data, error } = await db
    .from("comentarios")
    .insert({ ...validado.data, organizacion_id: organizacion.id, autor_id: usuario.id })
    .select(SELECT_COMENTARIO)
    .single();
  if (error) {
    if (error.code === "23505") {
      const { data: previo } = await db.from("comentarios").select(SELECT_COMENTARIO).eq("id", validado.data.id).eq("autor_id", usuario.id).maybeSingle();
      if (previo) return { ok: true, datos: previo };
    }
    return errorDeBase(error, "crearComentario");
  }
  return { ok: true, datos: data };
}

/** Solo el autor (RLS). Un comentario borrado no se edita: lo frena la base. */
export async function editarComentario(datos: unknown): Promise<Resultado<ComentarioFila>> {
  const validado = esquemaEdicionComentario.safeParse(datos);
  if (!validado.success) return errorDeValidacion(validado.error);

  const db = await crearClienteServidor();
  const { data, error } = await db
    .from("comentarios")
    .update({ cuerpo: validado.data.cuerpo })
    .eq("id", validado.data.id)
    .select(SELECT_COMENTARIO);
  if (error) return errorDeBase(error, "editarComentario");
  if (data.length === 0) return SIN_FILAS;
  return { ok: true, datos: data[0]! };
}

/** Autor, Admin o gestor del proyecto: lo decide public.eliminar_comentario. */
export async function eliminarComentario(id: string): Promise<Resultado> {
  const idOk = idValido.safeParse(id);
  if (!idOk.success) return errorDeValidacion(idOk.error);

  const db = await crearClienteServidor();
  const { error } = await db.rpc("eliminar_comentario", { p_id: id });
  if (error) return errorDeBase(error, "eliminarComentario");
  return { ok: true, datos: undefined };
}
