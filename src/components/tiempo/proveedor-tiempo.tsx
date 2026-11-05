"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { mensajeDeError } from "@/components/estado/mensaje-de-error";
import type { Resultado } from "@/lib/data/comun";
import { descartarTemporizador, detenerTemporizador, iniciarTemporizador } from "@/lib/data/tiempo/acciones";
import { obtenerTemporizador, type RegistroFila } from "@/lib/data/tiempo/consultas";
import { AVISO_PRENDIDO_MINUTOS, minutosAlDetener, textoDuracion } from "@/lib/data/tiempo/reglas";
import { hoyEnZona } from "@/lib/fechas";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { DialogoDetener } from "./dialogo-detener";

type ValorTiempo = {
  usuarioId: string;
  esAdmin: boolean;
  /** Hoy en la zona de la empresa. */
  hoy: string;
  /** El que corre a nombre propio, o null. */
  temporizador: RegistroFila | null;
  ocupado: boolean;
  iniciar: (tareaId: string) => Promise<void>;
  /** Detiene; desde las 10 h, antes pregunta "¿Lo dejaste prendido?". */
  pedirDetener: () => void;
  /** Borra el que corre sin guardar nada. Pasalo por ConfirmarAccion. */
  descartar: () => Promise<void>;
  /** Para después de cargar, editar o borrar un registro. */
  refrescar: () => Promise<void>;
};

const Contexto = createContext<ValorTiempo | null>(null);

export function useTiempo(): ValorTiempo {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("useTiempo necesita a ProveedorTiempo (está en AppShell).");
  return valor;
}

/** Hora del navegador, que avanza cada segundo mientras `activo`. Solo para mostrar `ahora - inicio`. */
export function useAhora(activo: boolean): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!activo) return;
    const intervalo = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(intervalo);
  }, [activo]);
  return ahora;
}

/**
 * Estado del temporizador para toda la app. Sale de la base (el `inicio` del registro abierto), así
 * sobrevive a recargar y a cambiar de dispositivo. Se vuelve a pedir al volver a la pestaña y al
 * volver la red: si se detuvo en el celular, la computadora se entera.
 */
export function ProveedorTiempo({
  usuarioId,
  esAdmin,
  zonaHoraria,
  children,
}: {
  usuarioId: string;
  esAdmin: boolean;
  zonaHoraria: string;
  children: ReactNode;
}) {
  const db = crearClienteNavegador();
  const clienteConsultas = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const [preguntar, setPreguntar] = useState<RegistroFila | null>(null);

  const consulta = useQuery({
    queryKey: ["temporizador", usuarioId],
    queryFn: () => obtenerTemporizador(db, usuarioId),
    staleTime: 0,
    refetchOnWindowFocus: "always",
  });
  const temporizador = consulta.data ?? null;

  async function refrescar() {
    await Promise.all([
      clienteConsultas.invalidateQueries({ queryKey: ["temporizador"] }),
      clienteConsultas.invalidateQueries({ queryKey: ["registros"] }),
    ]);
  }

  async function correr<T>(accion: () => Promise<Resultado<T>>): Promise<Resultado<T> | null> {
    setOcupado(true);
    try {
      const resultado = await accion();
      if (!resultado.ok) toast.error(resultado.error);
      return resultado;
    } catch (e) {
      toast.error(mensajeDeError(e));
      return null;
    } finally {
      setOcupado(false);
      await refrescar();
    }
  }

  async function iniciar(tareaId: string) {
    const previo = temporizador;
    const resultado = await correr(() => iniciarTemporizador(tareaId));
    if (resultado?.ok) toast.success(previo ? `Temporizador cambiado. Se guardó lo de «${previo.tareaTitulo}».` : "Temporizador en marcha.");
  }

  async function detener(datos: { minutos?: number; nota?: string } = {}) {
    const actual = temporizador;
    const resultado = await correr(() => detenerTemporizador(datos));
    if (resultado?.ok) {
      setPreguntar(null);
      toast.success(`Guardaste ${textoDuracion(resultado.datos.minutos)}${actual ? ` en «${actual.tareaTitulo}»` : ""}.`);
    }
    return resultado?.ok ?? false;
  }

  async function descartar() {
    const resultado = await correr(() => descartarTemporizador());
    if (resultado?.ok) {
      setPreguntar(null);
      toast.success("Temporizador descartado. No se guardó nada.");
    }
  }

  function pedirDetener() {
    if (!temporizador?.inicio) return;
    if (minutosAlDetener(temporizador.inicio, Date.now()) >= AVISO_PRENDIDO_MINUTOS) setPreguntar(temporizador);
    else void detener();
  }

  return (
    <Contexto.Provider
      value={{ usuarioId, esAdmin, hoy: hoyEnZona(zonaHoraria), temporizador, ocupado, iniciar, pedirDetener, descartar, refrescar }}
    >
      {children}
      <DialogoDetener
        temporizador={preguntar}
        ocupado={ocupado}
        onCerrar={() => setPreguntar(null)}
        onGuardar={(minutos) => detener({ minutos })}
      />
    </Contexto.Provider>
  );
}
