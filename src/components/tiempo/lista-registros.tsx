"use client";

import { useState } from "react";
import { PenLine, Pencil, Timer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { mensajeDeError } from "@/components/estado/mensaje-de-error";
import { Button } from "@/components/ui/button";
import { ConfirmarAccion, type ConfirmacionPendiente } from "@/components/ui/confirmar-accion";
import { eliminarRegistro } from "@/lib/data/tiempo/acciones";
import type { RegistroFila } from "@/lib/data/tiempo/consultas";
import { textoDuracion } from "@/lib/data/tiempo/reglas";
import { formatearDia } from "@/lib/fechas";
import { DialogoRegistro, type PedidoRegistro } from "./dialogo-registro";
import { useTiempo } from "./proveedor-tiempo";
import { Cronometro } from "./temporizador-global";

/**
 * Registros con su duración, día, origen (ícono y palabra) y nota. Corrige y borra el dueño, o un
 * Admin (lo decide el RLS; acá solo se esconden los botones). El que corre no se edita: se detiene.
 */
export function ListaRegistros({
  registros,
  mostrarTarea = false,
  mostrarPersona = false,
  mostrarFecha = true,
}: {
  registros: readonly RegistroFila[];
  mostrarTarea?: boolean;
  mostrarPersona?: boolean;
  mostrarFecha?: boolean;
}) {
  const { usuarioId, esAdmin, refrescar } = useTiempo();
  const [pedido, setPedido] = useState<PedidoRegistro | null>(null);
  const [confirmacion, setConfirmacion] = useState<ConfirmacionPendiente | null>(null);

  function pedirBorrado(r: RegistroFila) {
    setConfirmacion({
      titulo: "¿Borrar este registro?",
      descripcion: `${textoDuracion(r.minutos ?? 0)} del ${formatearDia(r.fecha)} en «${r.tareaTitulo}». No se puede deshacer.`,
      etiqueta: "Borrar registro",
      accion: async () => {
        try {
          const resultado = await eliminarRegistro(r.id);
          if (!resultado.ok) return void toast.error(resultado.error);
          toast.success("Registro borrado.");
          await refrescar();
        } catch (e) {
          toast.error(mensajeDeError(e));
        }
      },
    });
  }

  return (
    <>
      <ul className="divide-y rounded-[14px] border bg-card">
        {registros.map((r) => {
          const editable = r.minutos !== null && (r.usuarioId === usuarioId || esAdmin);
          const origen = r.origen === "manual" ? { Icono: PenLine, texto: "Manual" } : { Icono: Timer, texto: "Temporizador" };
          return (
            <li key={r.id} className="flex items-center gap-3 py-1 pr-1 pl-4">
              <div className="min-w-0 flex-1 py-1.5">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  {r.minutos === null && r.inicio ? (
                    <span className="font-semibold">
                      Midiendo <Cronometro inicio={r.inicio} />
                    </span>
                  ) : (
                    <span className="font-semibold tabular-nums">{textoDuracion(r.minutos ?? 0)}</span>
                  )}
                  {mostrarTarea && <span className="min-w-0 truncate">{r.tareaTitulo}</span>}
                </p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {mostrarFecha && <span>{formatearDia(r.fecha)}</span>}
                  {mostrarTarea && r.proyectoNombre && <span className="truncate">{r.proyectoNombre}</span>}
                  {mostrarPersona && <span className="truncate">{r.persona?.nombre ?? "Persona sin nombre"}</span>}
                  <span className="inline-flex items-center gap-1">
                    <origen.Icono aria-hidden className="size-3.5" />
                    {origen.texto}
                  </span>
                </p>
                {r.nota && <p className="mt-0.5 text-xs whitespace-pre-line">{r.nota}</p>}
              </div>
              {editable && (
                <div className="flex shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Corregir ${textoDuracion(r.minutos ?? 0)} del ${formatearDia(r.fecha)}`}
                    onClick={() => setPedido({ modo: "editar", registro: r })}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Borrar ${textoDuracion(r.minutos ?? 0)} del ${formatearDia(r.fecha)}`}
                    onClick={() => pedirBorrado(r)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <DialogoRegistro pedido={pedido} onCerrar={() => setPedido(null)} />
      <ConfirmarAccion pendiente={confirmacion} onCerrar={() => setConfirmacion(null)} />
    </>
  );
}
