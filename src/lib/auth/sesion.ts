import "server-only";
import { cache } from "react";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Usuario del pedido, verificado contra Auth con getUser() (getSession() solo confía en la
 * cookie). Con cache() el marco y la pantalla comparten una sola consulta por pedido.
 */
export const obtenerUsuario = cache(async () => {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
