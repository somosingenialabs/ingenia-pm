"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessagesSquare, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { ErrorDeCarga } from "@/components/estado/error-de-carga";
import { mensajeDeError } from "@/components/estado/mensaje-de-error";
import { ConfirmarAccion, type ConfirmacionPendiente } from "@/components/ui/confirmar-accion";
import { Skeleton } from "@/components/ui/skeleton";
import { useCanalRealtime } from "@/hooks/use-canal-realtime";
import type { PersonaRef } from "@/lib/data/comun";
import { crearComentario, editarComentario, eliminarComentario } from "@/lib/data/comentarios/acciones";
import { listarComentarios, type ComentarioFila } from "@/lib/data/comentarios/consultas";
import { aplicarEvento, aplicarFila, pendientesVisibles, type Pendiente } from "@/lib/data/comentarios/reglas";
import { listarMiembros } from "@/lib/data/miembros/consultas";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { CajaComentario } from "./caja";
import { ListaComentarios } from "./lista";

/**
 * Comentarios de una tarea, en vivo. La consulta es la única fuente: los eventos de Realtime y
 * las respuestas de las acciones se aplican sobre su caché, siempre por id, así nada se duplica.
 * Un solo canal por tarea abierta; se cierra al cerrar el detalle.
 */
export function SeccionComentarios({
  tareaId,
  organizacionId,
  yo,
  puedeBorrarAjenos,
}: {
  tareaId: string;
  organizacionId: string;
  yo: PersonaRef;
  puedeBorrarAjenos: boolean;
}) {
  const db = crearClienteNavegador();
  const clienteConsultas = useQueryClient();
  const clave = useMemo(() => ["comentarios", tareaId] as const, [tareaId]);
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [confirmacion, setConfirmacion] = useState<ConfirmacionPendiente | null>(null);

  const consulta = useQuery({ queryKey: clave, queryFn: () => listarComentarios(db, tareaId), staleTime: 0 });
  // El payload de Realtime no trae al autor: sale de los miembros en caché.
  const miembros = useQuery({ queryKey: ["miembros", organizacionId], queryFn: () => listarMiembros(db, organizacionId), staleTime: 5 * 60_000 });
  const autores = useMemo(() => new Map([...(miembros.data ?? []).map((m) => [m.id, m] as const), [yo.id, yo]]), [miembros.data, yo]);

  function aplicar(cambio: (lista: ComentarioFila[]) => ComentarioFila[]) {
    clienteConsultas.setQueryData<ComentarioFila[]>(clave, (lista) => cambio(lista ?? []));
  }

  const estadoCanal = useCanalRealtime<ComentarioFila>({
    canal: `comentarios:tarea:${tareaId}`,
    tabla: "comentarios",
    filtro: `tarea_id=eq.${tareaId}`,
    alCambiar: (evento) => {
      aplicar((lista) => aplicarEvento(lista, evento));
      const autor = (evento.new as Partial<ComentarioFila>).autor_id;
      if (autor && !autores.has(autor)) void clienteConsultas.invalidateQueries({ queryKey: ["miembros", organizacionId] });
    },
    // Al suscribirse (también al reconectar) y al volver a la pestaña: trae lo que se perdió.
    alSincronizar: () => void clienteConsultas.invalidateQueries({ queryKey: clave }),
  });

  async function mandar(pendiente: Pendiente) {
    setPendientes((ps) => [...ps.filter((p) => p.id !== pendiente.id), { ...pendiente, estado: "enviando", error: undefined }]);
    try {
      const resultado = await crearComentario({ id: pendiente.id, tarea_id: tareaId, cuerpo: pendiente.cuerpo });
      if (!resultado.ok) throw new Error(resultado.error);
      aplicar((lista) => aplicarFila(lista, resultado.datos));
      setPendientes((ps) => ps.filter((p) => p.id !== pendiente.id));
    } catch (e) {
      const mensaje = e instanceof Error && !/fetch|network/i.test(e.message) ? e.message : mensajeDeError(e);
      setPendientes((ps) => ps.map((p) => (p.id === pendiente.id ? { ...p, estado: "error", error: mensaje } : p)));
    }
  }

  function enviar(cuerpo: string) {
    // El id lo pone el navegador: el evento que llega con este id reemplaza al provisorio.
    void mandar({ id: crypto.randomUUID(), cuerpo, creado_en: new Date().toISOString(), estado: "enviando" });
  }

  async function editar(id: string, cuerpo: string): Promise<string | null> {
    const resultado = await editarComentario({ id, cuerpo });
    if (!resultado.ok) return resultado.error;
    aplicar((lista) => aplicarFila(lista, resultado.datos));
    return null;
  }

  function pedirBorrado(comentario: ComentarioFila) {
    const propio = comentario.autor_id === yo.id;
    setConfirmacion({
      titulo: "¿Borrar este comentario?",
      descripcion: propio ? "En el hilo va a quedar «Comentario eliminado»." : `Es de ${autores.get(comentario.autor_id)?.nombre ?? "otra persona"}. En el hilo va a quedar «Comentario eliminado».`,
      etiqueta: "Borrar comentario",
      accion: async () => {
        const resultado = await eliminarComentario(comentario.id);
        if (!resultado.ok) {
          toast.error(resultado.error);
          return;
        }
        aplicar((lista) => lista.map((c) => (c.id === comentario.id ? { ...c, eliminado_en: new Date().toISOString() } : c)));
      },
    });
  }

  const visibles = pendientesVisibles(consulta.data ?? [], pendientes);
  const cantidad = (consulta.data ?? []).filter((c) => !c.eliminado_en).length;

  return (
    <section aria-labelledby={`comentarios-${tareaId}`} className="flex flex-col gap-3 border-t pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 id={`comentarios-${tareaId}`} className="flex items-center gap-2 texto-titulo-3">
          <MessagesSquare className="size-5 text-muted-foreground" aria-hidden />
          Comentarios
          {consulta.isSuccess && <span className="text-sm font-normal text-muted-foreground tabular-nums">{cantidad}</span>}
        </h3>
        {estadoCanal === "reconectando" && (
          <span role="status" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <WifiOff className="size-3.5" aria-hidden /> Reconectando…
          </span>
        )}
      </div>

      {consulta.isPending && <Skeleton className="h-24" />}
      {consulta.isError && <ErrorDeCarga titulo="No pudimos cargar los comentarios" error={consulta.error} onReintentar={() => void consulta.refetch()} />}
      {consulta.isSuccess && (
        <ListaComentarios
          comentarios={consulta.data}
          pendientes={visibles}
          autores={autores}
          yo={yo}
          puedeBorrarAjenos={puedeBorrarAjenos}
          alEditar={editar}
          alBorrar={pedirBorrado}
          alReintentar={(id) => {
            const p = pendientes.find((x) => x.id === id);
            if (p) void mandar(p);
          }}
          alDescartar={(id) => setPendientes((ps) => ps.filter((p) => p.id !== id))}
        />
      )}
      <CajaComentario alEnviar={enviar} />
      <ConfirmarAccion pendiente={confirmacion} onCerrar={() => setConfirmacion(null)} />
    </section>
  );
}
