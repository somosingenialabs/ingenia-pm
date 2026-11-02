"use client";

import { useOptimistic, useState, useTransition } from "react";
import { ListChecks, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { EstadoVacio } from "@/components/estado/estado-vacio";
import { mensajeDeError } from "@/components/estado/mensaje-de-error";
import { navegarSinRecargar, useUrlCon } from "@/components/tareas/enlace-tarea";
import { FormularioTarea } from "@/components/tareas/formulario-tarea";
import { Button } from "@/components/ui/button";
import { HojaAdaptable } from "@/components/ui/hoja-adaptable";
import { Segmentado } from "@/components/ui/segmented";
import type { PersonaRef } from "@/lib/data/comun";
import { crearTarea, moverTarea } from "@/lib/data/tareas/acciones";
import type { TareaFila } from "@/lib/data/tareas/consultas";
import type { EstadoTarea } from "@/lib/validaciones/tareas";
import { ListaTareas } from "./lista-tareas";
import { Tablero, type Movimiento } from "./tablero";

type Vista = "tablero" | "lista";
const OPCIONES_VISTA = [
  { valor: "tablero" as const, etiqueta: "Tablero" },
  { valor: "lista" as const, etiqueta: "Lista" },
];

/**
 * Pestañas del proyecto (`?vista=`). También tiene el estado optimista: la tarjeta se mueve
 * enseguida, y cuando vuelve la acción, si falló, React la devuelve sola a su lugar.
 */
export function VistasProyecto({
  proyectoId,
  tareas,
  personas,
  gestiona,
  usuarioId,
  hoy,
}: {
  proyectoId: string;
  tareas: TareaFila[];
  personas: PersonaRef[];
  gestiona: boolean;
  usuarioId: string;
  hoy: string;
}) {
  const parametros = useSearchParams();
  const urlCon = useUrlCon();
  const vista: Vista = parametros.get("vista") === "lista" ? "lista" : "tablero";
  const creando = gestiona && parametros.get("nueva-tarea") === "1";

  const [, iniciar] = useTransition();
  const [optimistas, aplicar] = useOptimistic(tareas, (actuales: TareaFila[], m: Movimiento) =>
    actuales.map((t) => (t.id === m.id ? { ...t, estado: m.estado, ...(m.posicion === undefined ? {} : { posicion: m.posicion }) } : t)),
  );

  function mover(movimiento: { id: string; estado: EstadoTarea; posicion?: number }) {
    iniciar(async () => {
      aplicar(movimiento);
      try {
        const resultado = await moverTarea(movimiento);
        if (!resultado.ok) toast.error(`No pudimos mover la tarea. ${resultado.error}`);
      } catch (e) {
        toast.error(`No pudimos mover la tarea. ${mensajeDeError(e)}`);
      }
    });
  }

  const botonNueva = gestiona && (
    <Button onClick={() => navegarSinRecargar(urlCon({ "nueva-tarea": "1" }))}>
      <Plus aria-hidden /> Nueva tarea
    </Button>
  );

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmentado
          etiquetaAria="Vista del proyecto"
          className="sm:w-64"
          opciones={OPCIONES_VISTA}
          valor={vista}
          onChange={(v) => navegarSinRecargar(urlCon({ vista: v === "tablero" ? null : v }))}
        />
        {botonNueva}
      </div>

      {tareas.length === 0 ? (
        <EstadoVacio
          icono={<ListChecks />}
          className="rounded-[14px] border bg-card"
          titulo="Este proyecto no tiene tareas"
          texto={gestiona ? "Creá la primera y asignásela a alguien del equipo." : "Cuando se carguen tareas, las vas a ver acá."}
        />
      ) : vista === "tablero" ? (
        <Tablero tareas={optimistas} gestiona={gestiona} usuarioId={usuarioId} hoy={hoy} onMover={mover} />
      ) : (
        <ListaTareas
          proyectoId={proyectoId}
          tareas={optimistas}
          personas={personas}
          gestiona={gestiona}
          hoy={hoy}
          asignadoInicial={parametros.get("asignado")}
        />
      )}

      {gestiona && (
        <HojaNuevaTarea
          abierta={creando}
          onCambiar={(abierta) => !abierta && navegarSinRecargar(urlCon({ "nueva-tarea": null }))}
          proyectoId={proyectoId}
          personas={personas}
        />
      )}
    </>
  );
}

function HojaNuevaTarea({
  abierta,
  onCambiar,
  proyectoId,
  personas,
}: {
  abierta: boolean;
  onCambiar: (abierta: boolean) => void;
  proyectoId: string;
  personas: PersonaRef[];
}) {
  const [enviando, setEnviando] = useState(false);
  return (
    <HojaAdaptable
      abierta={abierta}
      onCambiar={onCambiar}
      titulo="Nueva tarea"
      pie={
        <>
          <Button type="button" variant="outline" onClick={() => onCambiar(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="nueva-tarea" disabled={enviando}>
            {enviando ? "Creando…" : "Crear tarea"}
          </Button>
        </>
      }
    >
      <FormularioTarea
        id="nueva-tarea"
        personas={personas}
        permisos={{ todo: true, estadoYDescripcion: true }}
        valores={{
          titulo: "",
          descripcion: "",
          estado: "por_hacer",
          prioridad: "media",
          asignado_id: null,
          fecha_inicio: "",
          fecha_limite: "",
          horas_estimadas: "",
        }}
        enviar={(datos) => crearTarea({ ...datos, proyecto_id: proyectoId })}
        alEnviando={setEnviando}
        alGuardar={() => {
          toast.success("Tarea creada.");
          onCambiar(false);
        }}
      />
    </HojaAdaptable>
  );
}
