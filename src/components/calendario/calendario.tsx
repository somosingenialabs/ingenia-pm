"use client";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "./calendario.css";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, getDay, parse, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, dateFnsLocalizer, type Formats, type Messages, type ToolbarProps, type View } from "react-big-calendar";
import withDragAndDrop, { type EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import { toast } from "sonner";
import { ErrorDeCarga } from "@/components/estado/error-de-carga";
import { mensajeDeError } from "@/components/estado/mensaje-de-error";
import { navegarSinRecargar, useUrlCon } from "@/components/tareas/enlace-tarea";
import { Button } from "@/components/ui/button";
import { Segmentado } from "@/components/ui/segmented";
import { useIsMobile } from "@/hooks/use-mobile";
import { moverTareaEnCalendario } from "@/lib/data/calendario/acciones";
import { listarCalendario } from "@/lib/data/calendario/consultas";
import {
  armarEventos,
  colorDeProyecto,
  DIAS_AGENDA,
  fechasTrasArrastre,
  rangoVisible,
  relacionadas,
  SEMANA,
  type CambioFechas,
  type DatosCalendario,
  type EventoCalendario,
  type VistaCalendario,
} from "@/lib/data/calendario/reglas";
import type { PersonaRef, Ref } from "@/lib/data/comun";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { EventoAgenda, EventoGrilla } from "./evento";
import { FiltrosCalendario, leerFiltros } from "./filtros";

const localizador = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (fecha: Date) => startOfWeek(fecha, SEMANA),
  getDay,
  locales: { es },
});

const CalendarioArrastrable = withDragAndDrop<EventoCalendario>(Calendar);

const MENSAJES: Messages<EventoCalendario> = {
  date: "Fecha",
  time: "Hora",
  event: "Tarea",
  allDay: "Todo el día",
  week: "Semana",
  work_week: "Semana laboral",
  day: "Día",
  month: "Mes",
  previous: "Anterior",
  next: "Siguiente",
  yesterday: "Ayer",
  tomorrow: "Mañana",
  today: "Hoy",
  agenda: "Agenda",
  noEventsInRange: "No hay tareas con fecha en este período. Probá con otro, o sacá algún filtro.",
  showMore: (cantidad) => `${cantidad} más`,
};

// Sin rayas largas: "3 nov al 9 nov".
const FORMATOS: Formats = {
  monthHeaderFormat: "MMMM yyyy",
  weekdayFormat: "EEE",
  dayFormat: "EEE d",
  dateFormat: "d",
  agendaDateFormat: "EEE d MMM",
  dayRangeHeaderFormat: ({ start, end }, cultura, loc) =>
    `${loc!.format(start, "d MMM", cultura)} al ${loc!.format(end, "d MMM yyyy", cultura)}`,
  agendaHeaderFormat: ({ start, end }, cultura, loc) =>
    `${loc!.format(start, "d MMM", cultura)} al ${loc!.format(end, "d MMM yyyy", cultura)}`,
};

const NOMBRE_VISTA: Record<VistaCalendario, string> = { month: "Mes", week: "Semana", agenda: "Agenda" };

/** Error de una acción que ya trae un mensaje para mostrar. */
class ErrorDeAccion extends Error {}

export function Calendario({
  proyectos,
  personas,
  gestionados,
  usuarioId,
  hoy,
}: {
  proyectos: Ref[];
  personas: PersonaRef[];
  gestionados: string[];
  usuarioId: string;
  hoy: string;
}) {
  const db = crearClienteNavegador();
  const router = useRouter();
  const urlCon = useUrlCon();
  const parametros = useSearchParams();
  const clienteConsultas = useQueryClient();
  const esCelular = useIsMobile();

  const filtros = leerFiltros(parametros);
  const personaId = filtros.soloMias ? usuarioId : filtros.personaId;

  // En el celular, Agenda primero y Mes como vista general; Semana no entra en 375 px.
  const vistas: VistaCalendario[] = esCelular ? ["agenda", "month"] : ["month", "week", "agenda"];
  const [vistaElegida, setVista] = useState<VistaCalendario>(esCelular ? "agenda" : "month");
  const vista = vistas.includes(vistaElegida) ? vistaElegida : vistas[0]!;
  const [fecha, setFecha] = useState(() => new Date());
  const [seleccion, setSeleccion] = useState<string | null>(null);

  const { desde, hasta } = rangoVisible(vista, fecha);
  const clave = ["calendario", desde, hasta, { proyectoId: filtros.proyectoId, personaId }] as const;
  const consulta = useQuery({
    queryKey: clave,
    queryFn: () => listarCalendario(db, { desde, hasta, proyectoId: filtros.proyectoId, personaId }),
    placeholderData: keepPreviousData,
  });

  const conjuntoGestionados = useMemo(() => new Set(gestionados), [gestionados]);
  const ordenProyectos = useMemo(() => proyectos.map((p) => p.id), [proyectos]);
  const eventos = useMemo(
    () => (consulta.data ? armarEventos(consulta.data, { modo: filtros.modo, hoy, gestionados: conjuntoGestionados }) : []),
    [consulta.data, filtros.modo, hoy, conjuntoGestionados],
  );

  // Si la tarea seleccionada ya no está (otro período, otro filtro), se suelta.
  const tareaSeleccionada = seleccion ? (consulta.data?.tareas.find((t) => t.id === seleccion) ?? null) : null;
  const vinculos = useMemo(
    () => (seleccion && consulta.data ? relacionadas(consulta.data.dependencias, seleccion) : null),
    [seleccion, consulta.data],
  );
  const resaltadas = useMemo(() => new Set(vinculos ? [...vinculos.predecesoras, ...vinculos.sucesoras] : []), [vinculos]);

  useEffect(() => {
    if (!seleccion) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && !parametros.get("tarea") && setSeleccion(null);
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [seleccion, parametros]);

  const mover = useMutation({
    mutationFn: async (cambio: CambioFechas & { id: string }) => {
      const resultado = await moverTareaEnCalendario(cambio);
      if (!resultado.ok) throw new ErrorDeAccion(resultado.error);
      return resultado.datos;
    },
    // Optimista: el evento queda donde se soltó. Si falla, vuelve a su lugar con aviso.
    onMutate: async (cambio) => {
      await clienteConsultas.cancelQueries({ queryKey: clave });
      const previo = clienteConsultas.getQueryData<DatosCalendario>(clave);
      clienteConsultas.setQueryData<DatosCalendario>(clave, (d) =>
        d && {
          ...d,
          tareas: d.tareas.map((t) =>
            t.id === cambio.id
              ? { ...t, fechaLimite: cambio.fecha_limite, fechaInicio: cambio.fecha_inicio === undefined ? t.fechaInicio : cambio.fecha_inicio }
              : t,
          ),
        },
      );
      return { previo };
    },
    onError: (error, _cambio, contexto) => {
      clienteConsultas.setQueryData(clave, contexto?.previo);
      toast.error(`No pudimos mover la tarea. ${error instanceof ErrorDeAccion ? error.message : mensajeDeError(error)}`);
    },
    onSuccess: ({ avisos }) => {
      for (const aviso of avisos) toast.warning(aviso);
    },
    onSettled: (_datos, _error, cambio) => {
      void clienteConsultas.invalidateQueries({ queryKey: ["calendario"] });
      void clienteConsultas.invalidateQueries({ queryKey: ["tarea", cambio.id] });
    },
  });

  function alSoltar(accion: "move" | "resize") {
    return ({ event, start, end }: EventInteractionArgs<EventoCalendario>) => {
      if (!event.tarea || !event.movible) return;
      const cambio = fechasTrasArrastre(event.tarea, filtros.modo, accion, new Date(start), new Date(end));
      if (cambio) mover.mutate({ id: event.id, ...cambio });
    };
  }

  function alElegir(evento: EventoCalendario) {
    if (evento.tipo === "objetivo") {
      router.push(`/proyectos/${evento.proyectoId}`);
      return;
    }
    setSeleccion(evento.id);
    navegarSinRecargar(urlCon({ tarea: evento.id }));
  }

  function propsDeEvento(evento: EventoCalendario) {
    const relacionada = resaltadas.has(evento.id);
    return {
      className: cn(
        evento.tipo === "objetivo" && "evento-objetivo",
        evento.id === seleccion && "evento-seleccionado",
        relacionada && "evento-relacionado",
        seleccion && evento.id !== seleccion && !relacionada && "evento-atenuado",
      ),
      style: { "--color-proyecto": colorDeProyecto(evento.proyectoId, ordenProyectos) } as CSSProperties,
    };
  }

  return (
    <div className="flex flex-col gap-4">
      <FiltrosCalendario filtros={filtros} proyectos={proyectos} personas={personas} />

      {consulta.isError && !consulta.data ? (
        <ErrorDeCarga titulo="No pudimos cargar el calendario" error={consulta.error} onReintentar={() => void consulta.refetch()} />
      ) : (
        <>
          <Leyenda
            tarea={tareaSeleccionada?.titulo ?? null}
            predecesoras={vinculos?.predecesoras.length ?? 0}
            sucesoras={vinculos?.sucesoras.length ?? 0}
            alQuitar={() => setSeleccion(null)}
          />
          <div className={cn("calendario-ingenia", `vista-${vista}`)} aria-busy={consulta.isFetching}>
            <CalendarioArrastrable
              localizer={localizador}
              culture="es"
              messages={MENSAJES}
              formats={FORMATOS}
              events={eventos}
              view={vista as View}
              views={vistas}
              onView={(v) => setVista(v as VistaCalendario)}
              date={fecha}
              onNavigate={setFecha}
              // La librería cuenta el último día aparte: con 29 muestra 30 días, igual que rangoVisible.
              length={DIAS_AGENDA - 1}
              popup
              selected={eventos.find((e) => e.id === seleccion)}
              onSelectEvent={alElegir}
              onDrillDown={(dia) => {
                setFecha(dia);
                setVista(esCelular ? "agenda" : "week");
              }}
              eventPropGetter={propsDeEvento}
              tooltipAccessor={null}
              // El arrastre de esta librería no anda con teclado: la fecha también se cambia en el detalle.
              draggableAccessor={(e) => !esCelular && e.movible}
              resizableAccessor={(e) => !esCelular && e.movible && filtros.modo === "duracion"}
              resizable={filtros.modo === "duracion"}
              onEventDrop={alSoltar("move")}
              onEventResize={alSoltar("resize")}
              components={{ toolbar: BarraCalendario, event: EventoGrilla, agenda: { event: EventoAgenda } }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {gestionados.length > 0 && !esCelular
              ? "Arrastrá una tarea para cambiarle la fecha. Con el teclado, cambiala desde el detalle de la tarea."
              : "Para cambiar una fecha, abrí la tarea."}
          </p>
        </>
      )}
    </div>
  );
}

/** Resaltado de dependencias: se dice con texto, no solo con la opacidad. */
function Leyenda({ tarea, predecesoras, sucesoras, alQuitar }: { tarea: string | null; predecesoras: number; sucesoras: number; alQuitar: () => void }) {
  return (
    <div aria-live="polite" className="empty:hidden">
      {tarea && (
        <div className="flex items-center gap-2 rounded-[14px] border bg-card py-1 pr-1 pl-4 text-sm">
          <p className="flex-1">
            <span className="font-medium">«{tarea}»</span>
            {predecesoras + sucesoras === 0
              ? " no tiene dependencias."
              : ` depende de ${plural(predecesoras, "tarea", "tareas")} y bloquea ${plural(sucesoras, "tarea", "tareas")}. Quedan con borde; las demás, atenuadas.`}
          </p>
          <Button type="button" variant="ghost" size="icon" aria-label="Quitar resaltado" onClick={alQuitar}>
            <X aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}

function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}

function BarraCalendario({ label, onNavigate, onView, view, views }: ToolbarProps<EventoCalendario>) {
  const lista = (Array.isArray(views) ? views : Object.keys(views)) as VistaCalendario[];
  return (
    <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      {/* En el celular el período va arriba, entero; en escritorio, al lado de las flechas. */}
      <div className="flex flex-col gap-2 md:flex-row-reverse md:items-center md:gap-1">
        <h2 className="texto-titulo-3 first-letter:uppercase md:ml-1" aria-live="polite">
          {label}
        </h2>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" onClick={() => onNavigate("TODAY")}>
            Hoy
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Anterior" onClick={() => onNavigate("PREV")}>
            <ChevronLeft aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Siguiente" onClick={() => onNavigate("NEXT")}>
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>
      <Segmentado
        etiquetaAria="Vista del calendario"
        className="md:w-auto"
        opciones={lista.map((v) => ({ valor: v, etiqueta: NOMBRE_VISTA[v] }))}
        valor={view as VistaCalendario}
        onChange={(v) => onView(v)}
      />
    </div>
  );
}
