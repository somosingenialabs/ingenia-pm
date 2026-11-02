"use client";

import { useMemo, useRef, useState } from "react";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type RowSelectionState, type SortingState } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Minus } from "lucide-react";
import { toast } from "sonner";
import { mensajeDeError } from "@/components/estado/mensaje-de-error";
import { EnlaceTarea } from "@/components/tareas/enlace-tarea";
import { EtiquetaEstado, EtiquetaPrioridad, FechaLimite, Persona } from "@/components/tareas/etiquetas";
import { Button } from "@/components/ui/button";
import { NINGUNO, Selector } from "@/components/ui/selector";
import type { PersonaRef } from "@/lib/data/comun";
import { editarTareasEnLote } from "@/lib/data/tareas/acciones";
import type { TareaFila } from "@/lib/data/tareas/consultas";
import { NOMBRE_ESTADO, NOMBRE_PRIORIDAD } from "@/lib/data/tareas/reglas";
import { cn } from "@/lib/utils";
import { ESTADOS_TAREA, PRIORIDADES, type EstadoTarea } from "@/lib/validaciones/tareas";

const ALTO_FILA = 52;
const SIN_ASIGNAR = "__sin_asignar";
const ORDEN_PRIORIDAD = { urgente: 0, alta: 1, media: 2, baja: 3 } as const;

function Casilla({ marcada, indeterminada, etiqueta, onCambiar }: { marcada: boolean; indeterminada?: boolean; etiqueta: string; onCambiar: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminada ? "mixed" : marcada}
      aria-label={etiqueta}
      onClick={onCambiar}
      className="group/casilla flex size-11 items-center justify-center rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className={cn("flex size-5 items-center justify-center rounded border", marcada || indeterminada ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background")}>
        {marcada && <Check className="size-3.5" aria-hidden />}
        {!marcada && indeterminada && <Minus className="size-3.5" aria-hidden />}
      </span>
    </button>
  );
}

/** Lista con filtros y selección múltiple (solo gestor). Virtualizada: solo se dibujan las filas que se ven. */
export function ListaTareas({
  proyectoId,
  tareas,
  personas,
  gestiona,
  hoy,
  asignadoInicial,
}: {
  proyectoId: string;
  tareas: TareaFila[];
  personas: PersonaRef[];
  gestiona: boolean;
  hoy: string;
  asignadoInicial: string | null;
}) {
  const [orden, setOrden] = useState<SortingState>([]);
  const [seleccion, setSeleccion] = useState<RowSelectionState>({});
  const [estado, setEstado] = useState<string>(NINGUNO);
  const [asignado, setAsignado] = useState<string>(asignadoInicial ?? NINGUNO);
  const [prioridad, setPrioridad] = useState<string>(NINGUNO);
  const [enviando, setEnviando] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  const filtradas = useMemo(
    () =>
      tareas.filter(
        (t) =>
          (estado === NINGUNO ? t.estado !== "cancelada" : t.estado === estado) &&
          (asignado === NINGUNO || (asignado === SIN_ASIGNAR ? !t.asignado : t.asignado?.id === asignado)) &&
          (prioridad === NINGUNO || t.prioridad === prioridad),
      ),
    [tareas, estado, asignado, prioridad],
  );

  const columnas = useMemo<ColumnDef<TareaFila>[]>(() => {
    const base: ColumnDef<TareaFila>[] = [
      {
        accessorKey: "titulo",
        header: "Título",
        cell: ({ row }) => (
          <EnlaceTarea id={row.original.id} className="flex min-h-11 items-center underline-offset-4 outline-none hover:underline focus-visible:underline">
            <span className="truncate font-medium">{row.original.titulo}</span>
          </EnlaceTarea>
        ),
      },
      { accessorKey: "estado", header: "Estado", cell: ({ row }) => <EtiquetaEstado estado={row.original.estado} /> },
      { accessorFn: (t) => ORDEN_PRIORIDAD[t.prioridad], id: "prioridad", header: "Prioridad", cell: ({ row }) => <EtiquetaPrioridad prioridad={row.original.prioridad} /> },
      { accessorFn: (t) => t.asignado?.nombre ?? "", id: "asignado", header: "Asignado", cell: ({ row }) => <Persona persona={row.original.asignado} /> },
      { accessorFn: (t) => t.fecha_limite ?? "9999", id: "limite", header: "Límite", cell: ({ row }) => <FechaLimite tarea={row.original} hoy={hoy} /> },
    ];
    if (!gestiona) return base;
    return [
      {
        id: "seleccion",
        enableSorting: false,
        header: ({ table }) => (
          <Casilla
            etiqueta="Seleccionar todas"
            marcada={table.getIsAllRowsSelected()}
            indeterminada={table.getIsSomeRowsSelected()}
            onCambiar={() => table.toggleAllRowsSelected()}
          />
        ),
        cell: ({ row }) => <Casilla etiqueta={`Seleccionar ${row.original.titulo}`} marcada={row.getIsSelected()} onCambiar={() => row.toggleSelected()} />,
      },
      ...base,
    ];
  }, [gestiona, hoy]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table devuelve funciones que no se pueden memoizar.
  const tabla = useReactTable({
    data: filtradas,
    columns: columnas,
    state: { sorting: orden, rowSelection: seleccion },
    onSortingChange: setOrden,
    onRowSelectionChange: setSeleccion,
    enableRowSelection: gestiona,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (t) => t.id,
  });

  const filas = tabla.getRowModel().rows;
  const virtual = useVirtualizer({
    count: filas.length,
    getScrollElement: () => contenedor.current,
    estimateSize: () => ALTO_FILA,
    overscan: 10,
    initialRect: { width: 0, height: 600 },
  });
  const visibles = virtual.getVirtualItems();
  const arriba = visibles[0]?.start ?? 0;
  const abajo = virtual.getTotalSize() - (visibles.at(-1)?.end ?? 0);

  // Un filtro puede dejar seleccionada una tarea que ya no se ve: solo cuentan las visibles.
  const idsElegidas = filas.filter((f) => f.getIsSelected()).map((f) => f.id);

  async function aplicarLote(cambios: { estado?: EstadoTarea; asignado_id?: string | null }) {
    setEnviando(true);
    try {
      const resultado = await editarTareasEnLote(proyectoId, { ids: idsElegidas, ...cambios });
      if (!resultado.ok) {
        toast.error(resultado.error);
        return;
      }
      toast.success(resultado.datos.actualizadas === 1 ? "Tarea actualizada." : `${resultado.datos.actualizadas} tareas actualizadas.`);
      setSeleccion({});
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  const opcionesAsignado = [
    { valor: SIN_ASIGNAR, etiqueta: "Sin asignar" },
    ...personas.map((p) => ({ valor: p.id, etiqueta: p.nombre })),
  ];
  // Quien tiene tareas pero ya no es miembro también se tiene que poder filtrar: para reasignarlas.
  const otrosAsignados = [...new Map(tareas.flatMap((t) => (t.asignado && !personas.some((p) => p.id === t.asignado!.id) ? [[t.asignado.id, t.asignado.nombre] as const] : [])))];
  const opcionesFiltroAsignado = [
    { valor: NINGUNO, etiqueta: "Todas las personas" },
    ...opcionesAsignado,
    ...otrosAsignados.map(([valor, etiqueta]) => ({ valor, etiqueta })),
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
        <Selector
          etiquetaAria="Filtrar por estado"
          className="sm:w-48"
          valor={estado}
          onCambiar={setEstado}
          opciones={[{ valor: NINGUNO, etiqueta: "Abiertas y hechas" }, ...ESTADOS_TAREA.map((e) => ({ valor: e, etiqueta: NOMBRE_ESTADO[e] }))]}
        />
        <Selector etiquetaAria="Filtrar por asignado" className="sm:w-56" valor={asignado} onCambiar={setAsignado} opciones={opcionesFiltroAsignado} />
        <Selector
          etiquetaAria="Filtrar por prioridad"
          className="sm:w-48"
          valor={prioridad}
          onCambiar={setPrioridad}
          opciones={[{ valor: NINGUNO, etiqueta: "Todas las prioridades" }, ...PRIORIDADES.map((p) => ({ valor: p, etiqueta: NOMBRE_PRIORIDAD[p] }))]}
        />
      </div>

      {gestiona && idsElegidas.length > 0 && (
        <div role="region" aria-label="Acciones sobre las seleccionadas" className="flex flex-col gap-2 rounded-[14px] border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="text-sm font-medium tabular-nums">{idsElegidas.length === 1 ? "1 seleccionada" : `${idsElegidas.length} seleccionadas`}</span>
          <Selector
            etiquetaAria="Cambiar estado de las seleccionadas"
            placeholder="Cambiar estado"
            className="sm:w-44"
            valor=""
            deshabilitado={enviando}
            onCambiar={(v) => aplicarLote({ estado: v as EstadoTarea })}
            opciones={ESTADOS_TAREA.map((e) => ({ valor: e, etiqueta: NOMBRE_ESTADO[e] }))}
          />
          <Selector
            etiquetaAria="Cambiar asignado de las seleccionadas"
            placeholder="Cambiar asignado"
            className="sm:w-52"
            valor=""
            deshabilitado={enviando}
            onCambiar={(v) => aplicarLote({ asignado_id: v === SIN_ASIGNAR ? null : v })}
            opciones={opcionesAsignado}
          />
          <Button variant="ghost" onClick={() => setSeleccion({})} className="sm:ml-auto">
            Limpiar
          </Button>
        </div>
      )}

      {filas.length === 0 ? (
        <p className="rounded-[14px] border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Ninguna tarea coincide con los filtros.</p>
      ) : (
        <>
          <div ref={contenedor} className="hidden max-h-[calc(100svh-16rem)] min-h-64 overflow-auto rounded-[14px] border bg-card md:block">
            <table aria-label="Tareas del proyecto" className="w-full table-fixed text-sm">
              <colgroup>
                {gestiona && <col className="w-14" />}
                <col />
                <col className="w-32" />
                <col className="w-28" />
                <col className="w-44" />
                <col className="w-40" />
              </colgroup>
              <thead className="sticky top-0 z-10 border-b bg-card">
                {tabla.getHeaderGroups().map((grupo) => (
                  <tr key={grupo.id}>
                    {grupo.headers.map((h) => {
                      const sentido = h.column.getIsSorted();
                      const Icono = sentido === "asc" ? ArrowUp : sentido === "desc" ? ArrowDown : ArrowUpDown;
                      return (
                        <th key={h.id} scope="col" className="px-2 text-left font-medium" aria-sort={h.column.getCanSort() ? (sentido === "asc" ? "ascending" : sentido === "desc" ? "descending" : "none") : undefined}>
                          {h.column.getCanSort() ? (
                            <button type="button" onClick={h.column.getToggleSortingHandler()} className="inline-flex min-h-11 items-center gap-1">
                              {flexRender(h.column.columnDef.header, h.getContext())}
                              <Icono className="size-3.5 text-muted-foreground" aria-hidden />
                            </button>
                          ) : (
                            flexRender(h.column.columnDef.header, h.getContext())
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {arriba > 0 && (
                  <tr aria-hidden style={{ height: arriba }}>
                    <td />
                  </tr>
                )}
                {visibles.map((v) => {
                  const fila = filas[v.index]!;
                  return (
                    <tr key={fila.id} style={{ height: ALTO_FILA }} className="border-b last:border-0 hover:bg-accent/50" data-state={fila.getIsSelected() ? "selected" : undefined}>
                      {fila.getVisibleCells().map((celda) => (
                        <td key={celda.id} className="overflow-hidden px-2">
                          {flexRender(celda.column.columnDef.cell, celda.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {abajo > 0 && (
                  <tr aria-hidden style={{ height: abajo }}>
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-2 md:hidden">
            {filas.map((fila) => {
              const t = fila.original;
              return (
                <li key={t.id} className="flex gap-1 rounded-[14px] border bg-card py-1 pr-3 pl-1">
                  {gestiona && <Casilla etiqueta={`Seleccionar ${t.titulo}`} marcada={fila.getIsSelected()} onCambiar={() => fila.toggleSelected()} />}
                  <div className="min-w-0 flex-1 py-1">
                    <EnlaceTarea id={t.id} className="flex min-h-11 items-center text-sm font-medium">
                      <span className="line-clamp-2">{t.titulo}</span>
                    </EnlaceTarea>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <EtiquetaEstado estado={t.estado} />
                      <EtiquetaPrioridad prioridad={t.prioridad} />
                      <FechaLimite tarea={t} hoy={hoy} />
                    </div>
                    <div className="mt-1">
                      <Persona persona={t.asignado} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
