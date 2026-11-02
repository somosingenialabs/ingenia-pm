"use client";

import { useState } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, GripVertical } from "lucide-react";
import { EnlaceTarea } from "@/components/tareas/enlace-tarea";
import { EtiquetaPrioridad, FechaLimite, Persona } from "@/components/tareas/etiquetas";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Segmentado } from "@/components/ui/segmented";
import { puedeMoverTarea } from "@/lib/auth/permisos";
import type { TareaFila } from "@/lib/data/tareas/consultas";
import { COLUMNAS_TABLERO, NOMBRE_ESTADO, ordenarPorPosicion, posicionAlSoltar } from "@/lib/data/tareas/reglas";
import { cn } from "@/lib/utils";
import type { EstadoTarea } from "@/lib/validaciones/tareas";

export type Movimiento = { id: string; estado: EstadoTarea; posicion?: number };

const PREFIJO_COLUMNA = "columna:";

/**
 * Tablero. Desde 768 px, cuatro columnas con arrastre: mouse, dedo y teclado (agarre, Espacio,
 * flechas y Espacio). A 375 px no hay columnas lado a lado: control segmentado y lista, con un
 * menú "Mover a..." en vez de arrastrar, porque el arrastre choca con el scroll.
 * Las dos se dibujan y las separa el CSS, así la primera pantalla sale bien sin esperar al navegador.
 */
export function Tablero({
  tareas,
  gestiona,
  usuarioId,
  hoy,
  onMover,
}: {
  tareas: TareaFila[];
  gestiona: boolean;
  usuarioId: string;
  hoy: string;
  onMover: (movimiento: Movimiento) => void;
}) {
  const puedeMover = (t: TareaFila) => puedeMoverTarea(gestiona, t.asignado?.id ?? null, usuarioId);
  const porColumna = (estado: EstadoTarea) => ordenarPorPosicion(tareas.filter((t) => t.estado === estado));

  return (
    <>
      <TableroEscritorio tareas={tareas} porColumna={porColumna} puedeMover={puedeMover} hoy={hoy} onMover={onMover} />
      <TableroCelular porColumna={porColumna} puedeMover={puedeMover} hoy={hoy} onMover={onMover} />
    </>
  );
}

type PropsVista = {
  porColumna: (estado: EstadoTarea) => TareaFila[];
  puedeMover: (tarea: TareaFila) => boolean;
  hoy: string;
  onMover: (movimiento: Movimiento) => void;
};

function TableroEscritorio({ tareas, porColumna, puedeMover, hoy, onMover }: PropsVista & { tareas: TareaFila[] }) {
  const [activa, setActiva] = useState<TareaFila | null>(null);
  const sensores = useSensors(
    // Una distancia mínima: así un clic en el agarre no cuenta como arrastre.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const titulo = (id: unknown) => tareas.find((t) => t.id === id)?.titulo ?? "la tarea";
  const nombreDestino = (id: unknown) => {
    const texto = String(id);
    if (texto.startsWith(PREFIJO_COLUMNA)) return NOMBRE_ESTADO[texto.slice(PREFIJO_COLUMNA.length) as EstadoTarea];
    const estado = tareas.find((t) => t.id === id)?.estado;
    return estado ? NOMBRE_ESTADO[estado] : "";
  };
  const anuncios: Announcements = {
    onDragStart: ({ active }) => `Agarraste ${titulo(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${titulo(active.id)} sobre ${nombreDestino(over.id)}.` : `${titulo(active.id)} fuera de las columnas.`),
    onDragEnd: ({ active, over }) => (over ? `${titulo(active.id)} quedó en ${nombreDestino(over.id)}.` : `${titulo(active.id)} volvió a su lugar.`),
    onDragCancel: ({ active }) => `Cancelaste. ${titulo(active.id)} volvió a su lugar.`,
  };

  function alEmpezar({ active }: DragStartEvent) {
    setActiva(tareas.find((t) => t.id === active.id) ?? null);
  }

  function alSoltar({ active, over }: DragEndEvent) {
    setActiva(null);
    if (!over) return;
    const tarea = tareas.find((t) => t.id === active.id);
    if (!tarea) return;

    const destino = String(over.id);
    const sobreColumna = destino.startsWith(PREFIJO_COLUMNA);
    const estado = sobreColumna ? (destino.slice(PREFIJO_COLUMNA.length) as EstadoTarea) : tareas.find((t) => t.id === destino)?.estado;
    if (!estado) return;

    const posicion = posicionAlSoltar(porColumna(estado), tarea.id, sobreColumna ? null : destino);
    if (posicion === null) return;
    onMover({ id: tarea.id, estado, posicion });
  }

  return (
    <div className="hidden md:block">
      <DndContext
        id="tablero"
        sensors={sensores}
        collisionDetection={closestCorners}
        onDragStart={alEmpezar}
        onDragEnd={alSoltar}
        onDragCancel={() => setActiva(null)}
        accessibility={{
          announcements: anuncios,
          screenReaderInstructions: {
            draggable: "Para agarrar la tarea, apretá Espacio. Movela con las flechas. Soltala con Espacio, o cancelá con Escape.",
          },
        }}
      >
        <div className="grid grid-cols-4 gap-3">
          {COLUMNAS_TABLERO.map((estado) => (
            <Columna key={estado} estado={estado} tareas={porColumna(estado)} puedeMover={puedeMover} hoy={hoy} />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>{activa && <CuerpoTarjeta tarea={activa} hoy={hoy} agarre={<AgarreVisual />} />}</DragOverlay>
      </DndContext>
    </div>
  );
}

function Columna({ estado, tareas, puedeMover, hoy }: { estado: EstadoTarea; tareas: TareaFila[]; puedeMover: (t: TareaFila) => boolean; hoy: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${PREFIJO_COLUMNA}${estado}` });
  return (
    <section
      aria-label={`Columna ${NOMBRE_ESTADO[estado]}`}
      ref={setNodeRef}
      className={cn("flex min-h-64 min-w-0 flex-col gap-2 rounded-[14px] border bg-muted/40 p-2 transition-colors", isOver && "border-primary bg-accent")}
    >
      <h2 className="flex items-center justify-between px-1 pt-1 text-sm font-semibold">
        {NOMBRE_ESTADO[estado]}
        <span className="text-xs font-normal text-muted-foreground tabular-nums">{tareas.length}</span>
      </h2>
      <SortableContext items={tareas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-1 flex-col gap-2">
          {tareas.map((t) => (
            <TarjetaArrastrable key={t.id} tarea={t} movible={puedeMover(t)} hoy={hoy} />
          ))}
        </ul>
      </SortableContext>
    </section>
  );
}

function TarjetaArrastrable({ tarea, movible, hoy }: { tarea: TareaFila; movible: boolean; hoy: string }) {
  // Sin `disabled.droppable`: sobre una tarjeta ajena igual se puede soltar otra.
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: tarea.id,
    disabled: { draggable: !movible, droppable: false },
  });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && "opacity-40")}>
      <CuerpoTarjeta
        tarea={tarea}
        hoy={hoy}
        agarre={
          movible ? (
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              aria-label={`Mover ${tarea.titulo}`}
              className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
            >
              <GripVertical className="size-4" aria-hidden />
            </button>
          ) : null
        }
      />
    </li>
  );
}

function AgarreVisual() {
  return (
    <span className="flex size-11 shrink-0 items-center justify-center text-muted-foreground">
      <GripVertical className="size-4" aria-hidden />
    </span>
  );
}

/** Título, prioridad (ícono y texto), asignado, fecha, y "Vencida" en texto si corresponde. */
function CuerpoTarjeta({ tarea, hoy, agarre }: { tarea: TareaFila; hoy: string; agarre?: React.ReactNode }) {
  return (
    <article className="flex gap-1 rounded-[14px] border bg-card py-1 pr-3 pl-1 text-card-foreground">
      {agarre ?? <span className="w-2 shrink-0" />}
      <div className="min-w-0 flex-1 py-1">
        <EnlaceTarea id={tarea.id} className="flex min-h-11 items-center text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:underline">
          <span className="line-clamp-3">{tarea.titulo}</span>
        </EnlaceTarea>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <EtiquetaPrioridad prioridad={tarea.prioridad} />
          <FechaLimite tarea={tarea} hoy={hoy} />
        </div>
        <div className="mt-1">
          <Persona persona={tarea.asignado} />
        </div>
      </div>
    </article>
  );
}

function TableroCelular({ porColumna, puedeMover, hoy, onMover }: PropsVista) {
  const [columna, setColumna] = useState<EstadoTarea>("por_hacer");
  const tareas = porColumna(columna);
  return (
    <div className="flex flex-col gap-3 md:hidden">
      <Segmentado
        etiquetaAria="Estado"
        // Las cuatro con su cantidad no entran en una fila de 375 px: "Hecha" quedaba cortada.
        className="grid grid-cols-2"
        valor={columna}
        onChange={setColumna}
        opciones={COLUMNAS_TABLERO.map((e) => ({ valor: e, etiqueta: NOMBRE_ESTADO[e], cantidad: porColumna(e).length }))}
      />
      {tareas.length === 0 ? (
        <p className="rounded-[14px] border bg-card px-4 py-8 text-center text-sm text-muted-foreground">No hay tareas en {NOMBRE_ESTADO[columna]}.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tareas.map((t) => (
            <li key={t.id} className="flex flex-col gap-1">
              <CuerpoTarjeta tarea={t} hoy={hoy} />
              {puedeMover(t) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" aria-label={`Mover a... ${t.titulo}`} className="self-end">
                      Mover a... <ChevronRight aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Mover a</DropdownMenuLabel>
                    {COLUMNAS_TABLERO.filter((e) => e !== t.estado).map((e) => (
                      <DropdownMenuItem key={e} className="min-h-11" onSelect={() => onMover({ id: t.id, estado: e })}>
                        {NOMBRE_ESTADO[e]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
