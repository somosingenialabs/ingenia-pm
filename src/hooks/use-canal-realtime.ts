"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { crearClienteNavegador } from "@/lib/supabase/client";

export type EstadoCanal = "conectando" | "conectado" | "reconectando";

type Fila = Record<string, unknown>;

/**
 * Cambios de una tabla en vivo, con el RLS de quien mira. Reglas que no se negocian:
 * - Solo el navegador se suscribe, con el cliente que trae la sesión: sin eso Realtime no sabe
 *   quién es y su RLS no deja pasar nada.
 * - Realtime no reenvía lo que se perdió. Por eso `alSincronizar` corre cada vez que el canal
 *   queda suscripto (también después de reconectar), al volver a la pestaña y al volver internet.
 * - Un canal por montaje, y `removeChannel` al desmontar.
 */
export function useCanalRealtime<T extends Fila>({
  canal,
  tabla,
  filtro,
  alCambiar,
  alSincronizar,
  activo = true,
}: {
  /** Nombre único, por ejemplo `comentarios:tarea:<id>`. */
  canal: string;
  tabla: string;
  /** Filtro de Realtime, por ejemplo `tarea_id=eq.<id>`. */
  filtro: string;
  alCambiar: (payload: RealtimePostgresChangesPayload<T>) => void;
  alSincronizar?: () => void;
  activo?: boolean;
}): EstadoCanal {
  const [estado, setEstado] = useState<EstadoCanal>("conectando");
  // Las funciones cambian en cada render; el canal no se tiene que rehacer por eso.
  const refCambiar = useRef(alCambiar);
  const refSincronizar = useRef(alSincronizar);
  useEffect(() => {
    refCambiar.current = alCambiar;
    refSincronizar.current = alSincronizar;
  });

  useEffect(() => {
    if (!activo) return;
    const db = crearClienteNavegador();
    let conectadoAlgunaVez = false;

    const suscripcion = db
      .channel(canal)
      .on<T>("postgres_changes", { event: "*", schema: "public", table: tabla, filter: filtro }, (payload) => refCambiar.current(payload))
      .subscribe((estadoCanal) => {
        if (estadoCanal === "SUBSCRIBED") {
          conectadoAlgunaVez = true;
          setEstado("conectado");
          refSincronizar.current?.();
        } else if (estadoCanal === "CHANNEL_ERROR" || estadoCanal === "TIMED_OUT" || (estadoCanal === "CLOSED" && conectadoAlgunaVez)) {
          setEstado("reconectando");
        }
      });

    const alVolver = () => {
      if (document.visibilityState === "visible") refSincronizar.current?.();
    };
    const alPerderRed = () => setEstado("reconectando");
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("online", alVolver);
    window.addEventListener("offline", alPerderRed);

    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("online", alVolver);
      window.removeEventListener("offline", alPerderRed);
      void db.removeChannel(suscripcion);
    };
  }, [canal, tabla, filtro, activo]);

  return estado;
}
