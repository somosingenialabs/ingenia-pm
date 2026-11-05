"use client";

import { AlertTriangle, ArrowUp, ChevronsUp, CircleDashed, Flag } from "lucide-react";
import type { EventProps } from "react-big-calendar";
import { EtiquetaEstado, EtiquetaPrioridad } from "@/components/tareas/etiquetas";
import type { EventoCalendario } from "@/lib/data/calendario/reglas";
import { NOMBRE_PRIORIDAD } from "@/lib/data/tareas/reglas";

// La librería dibuja el evento como un div sin foco. Adentro va un botón: con Tab se llega, y
// Enter dispara un clic que sube hasta la librería y abre la tarea, igual que con el mouse.
// El estado (vencida, conflicto, prioridad) va con ícono y texto, nunca solo color.

/** Texto completo para lectores de pantalla y para el globo al pasar el mouse. */
export function descripcionEvento(e: EventoCalendario): string {
  if (e.tipo === "objetivo") return `Objetivo del proyecto ${e.titulo}`;
  const partes = [e.titulo, e.proyectoNombre, `Prioridad ${NOMBRE_PRIORIDAD[e.tarea!.prioridad].toLowerCase()}`];
  if (e.vencida) partes.push("Vencida");
  for (const c of e.conflictos) partes.push(`Conflicto: arranca antes de que termine «${c}»`);
  return partes.join(". ");
}

function Marcas({ evento }: { evento: EventoCalendario }) {
  const prioridad = evento.tarea?.prioridad;
  return (
    <>
      {prioridad === "urgente" && <ChevronsUp className="size-3.5 shrink-0 text-estado-mora" aria-hidden />}
      {prioridad === "alta" && <ArrowUp className="size-3.5 shrink-0 text-estado-alerta" aria-hidden />}
      {evento.vencida && <CircleDashed className="size-3.5 shrink-0 text-estado-mora" aria-hidden />}
      {evento.conflictos.length > 0 && <AlertTriangle className="size-3.5 shrink-0 text-estado-alerta" aria-hidden />}
    </>
  );
}

/** Mes y Semana: una línea con íconos y título. */
export function EventoGrilla({ event }: EventProps<EventoCalendario>) {
  const descripcion = descripcionEvento(event);
  return (
    <button type="button" className="evento-boton" aria-label={descripcion} title={descripcion}>
      {event.tipo === "objetivo" ? (
        <>
          <Flag className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">Objetivo: {event.titulo}</span>
        </>
      ) : (
        <>
          <Marcas evento={event} />
          <span className="truncate">{event.titulo}</span>
        </>
      )}
    </button>
  );
}

/** Agenda: hay lugar, así que todo va escrito. */
export function EventoAgenda({ event }: EventProps<EventoCalendario>) {
  if (event.tipo === "objetivo") {
    return (
      <button type="button" className="evento-boton evento-agenda" aria-label={descripcionEvento(event)}>
        <span className="flex items-center gap-1.5 font-medium">
          <Flag className="size-4 shrink-0" aria-hidden />
          Objetivo del proyecto
        </span>
        <span className="text-muted-foreground">{event.titulo}</span>
      </button>
    );
  }
  const tarea = event.tarea!;
  return (
    <button type="button" className="evento-boton evento-agenda">
      <span className="font-medium">{event.titulo}</span>
      <span className="text-xs text-muted-foreground">
        {event.proyectoNombre}
        {tarea.asignadoNombre ? ` · ${tarea.asignadoNombre}` : " · Sin asignar"}
      </span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <EtiquetaEstado estado={tarea.estado} />
        <EtiquetaPrioridad prioridad={tarea.prioridad} />
        {event.vencida && (
          <span className="inline-flex items-center gap-1 text-xs font-medium">
            <CircleDashed className="size-3.5 text-estado-mora" aria-hidden />
            Vencida
          </span>
        )}
      </span>
      {event.conflictos.map((c) => (
        <span key={c} className="inline-flex items-center gap-1 text-xs">
          <AlertTriangle className="size-3.5 shrink-0 text-estado-alerta" aria-hidden />
          Arranca antes de que termine «{c}»
        </span>
      ))}
    </button>
  );
}
