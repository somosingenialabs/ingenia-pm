"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, Plus } from "lucide-react";
import { ErrorDeCarga } from "@/components/estado/error-de-carga";
import { Button } from "@/components/ui/button";
import { ConfirmarAccion, type ConfirmacionPendiente } from "@/components/ui/confirmar-accion";
import { Skeleton } from "@/components/ui/skeleton";
import { textoHoras } from "@/lib/data/carga/reglas";
import { listarRegistrosDeTarea } from "@/lib/data/tiempo/consultas";
import { textoDuracion } from "@/lib/data/tiempo/reglas";
import { crearClienteNavegador } from "@/lib/supabase/client";
import type { EstadoTarea } from "@/lib/validaciones/tareas";
import { BotonTemporizador } from "./boton-temporizador";
import { DialogoRegistro, type PedidoRegistro } from "./dialogo-registro";
import { ListaRegistros } from "./lista-registros";
import { useTiempo } from "./proveedor-tiempo";

const formatoPorcentaje = new Intl.NumberFormat("es-AR", { style: "percent", maximumFractionDigits: 0 });

/** Horas de una tarea, en su detalle: temporizador, carga manual, total contra estimado y registros. */
export function SeccionTiempo({
  tarea,
}: {
  tarea: { id: string; titulo: string; estado: EstadoTarea; horasEstimadas: number | null };
}) {
  const db = crearClienteNavegador();
  const { temporizador, descartar } = useTiempo();
  const [pedido, setPedido] = useState<PedidoRegistro | null>(null);
  const [confirmacion, setConfirmacion] = useState<ConfirmacionPendiente | null>(null);

  const consulta = useQuery({
    queryKey: ["registros", "tarea", tarea.id],
    queryFn: () => listarRegistrosDeTarea(db, tarea.id),
    staleTime: 0,
  });
  const minutos = (consulta.data ?? []).reduce((suma, r) => suma + (r.minutos ?? 0), 0);
  const estimadas = tarea.horasEstimadas;
  const corriendoAca = temporizador?.tareaId === tarea.id;

  return (
    <section aria-labelledby={`horas-${tarea.id}`} className="flex flex-col gap-3 border-t pt-4">
      <h3 id={`horas-${tarea.id}`} className="flex items-center gap-2 texto-titulo-3">
        <Clock className="size-5 text-muted-foreground" aria-hidden />
        Horas
      </h3>

      {consulta.isSuccess && (
        <p className="text-sm">
          <span className="font-semibold tabular-nums">{minutos > 0 ? textoDuracion(minutos) : "0 h"}</span> registradas
          {estimadas !== null && estimadas > 0 ? (
            <>
              {" "}
              de <span className="tabular-nums">{textoHoras(estimadas)}</span> estimadas ({formatoPorcentaje.format(minutos / 60 / estimadas)})
            </>
          ) : (
            <span className="text-muted-foreground">. Sin estimación.</span>
          )}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {(tarea.estado !== "cancelada" || corriendoAca) && <BotonTemporizador tareaId={tarea.id} titulo={tarea.titulo} conTexto />}
        <Button type="button" variant="outline" onClick={() => setPedido({ modo: "crear", tarea: { id: tarea.id, nombre: tarea.titulo }, fijarTarea: true })}>
          <Plus aria-hidden /> Cargar horas
        </Button>
        {corriendoAca && (
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              setConfirmacion({
                titulo: "¿Descartar el temporizador?",
                descripcion: "Se borra lo que lleva medido, sin guardar nada.",
                etiqueta: "Descartar",
                accion: () => void descartar(),
              })
            }
          >
            Descartar
          </Button>
        )}
      </div>

      {consulta.isPending && <Skeleton className="h-16" />}
      {consulta.isError && <ErrorDeCarga titulo="No pudimos cargar las horas" error={consulta.error} onReintentar={() => void consulta.refetch()} />}
      {consulta.isSuccess && consulta.data.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay horas en esta tarea.</p>}
      {consulta.isSuccess && consulta.data.length > 0 && <ListaRegistros registros={consulta.data} mostrarPersona />}

      <DialogoRegistro pedido={pedido} onCerrar={() => setPedido(null)} />
      <ConfirmarAccion pendiente={confirmacion} onCerrar={() => setConfirmacion(null)} />
    </section>
  );
}
