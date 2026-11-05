"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ErrorDeCarga } from "@/components/estado/error-de-carga";
import { EstadoVacio } from "@/components/estado/estado-vacio";
import { Button } from "@/components/ui/button";
import { ConfirmarAccion, type ConfirmacionPendiente } from "@/components/ui/confirmar-accion";
import { HojaAdaptable } from "@/components/ui/hoja-adaptable";
import { Skeleton } from "@/components/ui/skeleton";
import { puedeGestionarProyecto, puedeMoverTarea } from "@/lib/auth/permisos";
import type { Rol } from "@/lib/auth/tipos";
import { listarPersonasDeProyecto } from "@/lib/data/proyectos/consultas";
import { editarTarea, eliminarTarea } from "@/lib/data/tareas/acciones";
import { obtenerTarea, type TareaFila } from "@/lib/data/tareas/consultas";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { navegarSinRecargar, useUrlCon } from "./enlace-tarea";
import { FechaLimite } from "./etiquetas";
import { FormularioTarea } from "./formulario-tarea";
import { SeccionDependencias } from "./seccion-dependencias";
import { SeccionTiempo } from "./secciones-reservadas";
import { SeccionComentarios } from "@/components/comentarios/seccion";
import type { PersonaRef } from "@/lib/data/comun";

/**
 * Detalle de tarea en `?tarea=<id>`, sobre cualquier pantalla: panel lateral en escritorio y hoja
 * desde abajo en el celular. Lee desde el navegador, con el mismo RLS: quien no puede ver la
 * tarea recibe "no encontrada".
 */
export function PanelTarea({ yo, organizacionId, rol, hoy }: { yo: PersonaRef; organizacionId: string; rol: Rol; hoy: string }) {
  const id = useSearchParams().get("tarea");
  const urlCon = useUrlCon();
  const db = crearClienteNavegador();

  const consulta = useQuery({
    queryKey: ["tarea", id],
    queryFn: () => obtenerTarea(db, id!),
    enabled: !!id,
    staleTime: 0,
  });
  const tarea = consulta.data ?? null;

  const personas = useQuery({
    queryKey: ["personas-proyecto", tarea?.proyecto_id],
    queryFn: () => listarPersonasDeProyecto(db, tarea!.proyecto_id),
    enabled: !!tarea,
  });

  function cerrar() {
    navegarSinRecargar(urlCon({ tarea: null }));
  }

  const listo = !!id && !!tarea && personas.isSuccess;

  return (
    <HojaAdaptable
      abierta={!!id}
      onCambiar={(abierta) => !abierta && cerrar()}
      titulo={tarea?.titulo ?? "Tarea"}
      descripcion={tarea?.proyecto.nombre}
    >
      {id && (consulta.isPending || (tarea && personas.isPending)) && (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando tarea">
          <Skeleton className="h-11" />
          <Skeleton className="h-24" />
          <Skeleton className="h-11" />
        </div>
      )}
      {(consulta.isError || personas.isError) && (
        <ErrorDeCarga
          titulo="No pudimos cargar la tarea"
          error={consulta.error ?? personas.error}
          onReintentar={() => {
            void consulta.refetch();
            void personas.refetch();
          }}
        />
      )}
      {consulta.isSuccess && !tarea && (
        <EstadoVacio titulo="No encontramos esta tarea" texto="Puede que se haya borrado, o que no tengas acceso a ese proyecto." />
      )}
      {listo && (
        <DetalleTarea
          // Otra tarea o datos nuevos: el formulario arranca de cero.
          key={`${tarea.id}-${consulta.dataUpdatedAt}`}
          tarea={tarea}
          personas={personas.data}
          yo={yo}
          organizacionId={organizacionId}
          rol={rol}
          hoy={hoy}
          alCerrar={cerrar}
        />
      )}
    </HojaAdaptable>
  );
}

function DetalleTarea({
  tarea,
  personas,
  yo,
  organizacionId,
  rol,
  hoy,
  alCerrar,
}: {
  tarea: TareaFila;
  personas: { id: string; nombre: string; avatarUrl: string | null }[];
  yo: PersonaRef;
  organizacionId: string;
  rol: Rol;
  hoy: string;
  alCerrar: () => void;
}) {
  const clienteConsultas = useQueryClient();
  const usuarioId = yo.id;
  const [enviando, setEnviando] = useState(false);
  const [confirmacion, setConfirmacion] = useState<ConfirmacionPendiente | null>(null);

  const gestiona = puedeGestionarProyecto(rol, personas.some((p) => p.id === usuarioId));
  const puedeEditar = puedeMoverTarea(gestiona, tarea.asignado?.id ?? null, usuarioId);
  const idFormulario = `tarea-${tarea.id}`;

  function pedirBorrado() {
    setConfirmacion({
      titulo: "¿Borrar esta tarea?",
      descripcion: `«${tarea.titulo}» deja de verse en el tablero y en las listas.`,
      etiqueta: "Borrar tarea",
      accion: async () => {
        const resultado = await eliminarTarea(tarea.id);
        if (!resultado.ok) {
          toast.error(resultado.error);
          return;
        }
        toast.success("Tarea borrada.");
        alCerrar();
      },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <FechaLimite tarea={tarea} hoy={hoy} />
      {!puedeEditar && <p className="text-sm text-muted-foreground">Solo lectura: esta tarea no está a tu nombre.</p>}

      <FormularioTarea
        id={idFormulario}
        personas={personas}
        permisos={{ todo: gestiona, estadoYDescripcion: puedeEditar }}
        valores={{
          titulo: tarea.titulo,
          descripcion: tarea.descripcion ?? "",
          estado: tarea.estado,
          prioridad: tarea.prioridad,
          asignado_id: tarea.asignado?.id ?? null,
          fecha_inicio: tarea.fecha_inicio ?? "",
          fecha_limite: tarea.fecha_limite ?? "",
          horas_estimadas: tarea.horas_estimadas === null ? "" : String(tarea.horas_estimadas),
        }}
        enviar={(datos) => editarTarea(tarea.id, datos)}
        alEnviando={setEnviando}
        alGuardar={() => {
          toast.success("Cambios guardados.");
          void clienteConsultas.invalidateQueries({ queryKey: ["tarea", tarea.id] });
          // Si cambió una fecha, el calendario la tiene que mover.
          void clienteConsultas.invalidateQueries({ queryKey: ["calendario"] });
        }}
      />

      {puedeEditar && (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          {gestiona ? (
            <Button type="button" variant="destructive" onClick={pedirBorrado}>
              <Trash2 aria-hidden /> Borrar
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" form={idFormulario} disabled={enviando}>
            {enviando ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      )}

      {gestiona && <SeccionDependencias tareaId={tarea.id} proyectoId={tarea.proyecto_id} />}
      <SeccionComentarios tareaId={tarea.id} organizacionId={organizacionId} yo={yo} puedeBorrarAjenos={gestiona} />
      <SeccionTiempo tareaId={tarea.id} />

      <ConfirmarAccion pendiente={confirmacion} onCerrar={() => setConfirmacion(null)} />
    </div>
  );
}
