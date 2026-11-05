"use client";

import { useTransition } from "react";
import { CircleCheck } from "lucide-react";
import { toast } from "sonner";
import { EstadoVacio } from "@/components/estado/estado-vacio";
import { mensajeDeError } from "@/components/estado/mensaje-de-error";
import { Button } from "@/components/ui/button";
import { moverTarea } from "@/lib/data/tareas/acciones";
import type { TareaFila } from "@/lib/data/tareas/consultas";
import { estadoSiguiente, grupoDeTarea, NOMBRE_GRUPO, type GrupoMisTareas } from "@/lib/data/tareas/reglas";
import { BotonTemporizador } from "@/components/tiempo/boton-temporizador";
import { EnlaceTarea } from "./enlace-tarea";
import { EtiquetaEstado, EtiquetaPrioridad, FechaLimite } from "./etiquetas";

const GRUPOS: readonly GrupoMisTareas[] = ["vencidas", "hoy", "proximas", "sin_fecha"];

export function ListaMisTareas({ tareas, hoy }: { tareas: TareaFila[]; hoy: string }) {
  if (tareas.length === 0) {
    return (
      <EstadoVacio
        icono={<CircleCheck />}
        className="rounded-[14px] border bg-card"
        titulo="No tenés tareas abiertas"
        texto="Cuando te asignen una tarea, la vas a ver acá."
      />
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {GRUPOS.map((grupo) => {
        const delGrupo = tareas.filter((t) => grupoDeTarea(t, hoy) === grupo);
        if (delGrupo.length === 0) return null;
        return (
          <section key={grupo} aria-label={NOMBRE_GRUPO[grupo]} className="flex flex-col gap-2">
            <h2 className="flex items-baseline gap-2 texto-titular">
              {NOMBRE_GRUPO[grupo]}
              <span className="text-sm font-normal text-muted-foreground tabular-nums">{delGrupo.length}</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {delGrupo.map((t) => (
                <FilaTarea key={t.id} tarea={t} hoy={hoy} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function FilaTarea({ tarea, hoy }: { tarea: TareaFila; hoy: string }) {
  const [pendiente, iniciar] = useTransition();
  const siguiente = estadoSiguiente(tarea.estado);

  function avanzar() {
    if (!siguiente) return;
    iniciar(async () => {
      try {
        const resultado = await moverTarea({ id: tarea.id, estado: siguiente.estado });
        if (!resultado.ok) toast.error(resultado.error);
      } catch (e) {
        toast.error(mensajeDeError(e));
      }
    });
  }

  return (
    <li className="flex items-center gap-3 rounded-[14px] border bg-card px-4 py-2">
      <div className="min-w-0 flex-1">
        <EnlaceTarea id={tarea.id} className="flex min-h-11 items-center text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:underline">
          <span className="line-clamp-2">{tarea.titulo}</span>
        </EnlaceTarea>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="truncate text-xs text-muted-foreground">{tarea.proyecto.nombre}</span>
          <EtiquetaEstado estado={tarea.estado} />
          <EtiquetaPrioridad prioridad={tarea.prioridad} />
          <FechaLimite tarea={tarea} hoy={hoy} />
        </div>
      </div>
      <BotonTemporizador tareaId={tarea.id} titulo={tarea.titulo} />
      {siguiente && (
        <Button variant="outline" size="sm" disabled={pendiente} onClick={avanzar} aria-label={`${siguiente.accion}: ${tarea.titulo}`}>
          {siguiente.accion}
        </Button>
      )}
    </li>
  );
}
