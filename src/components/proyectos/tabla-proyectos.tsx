"use client";

import { useMemo, useState } from "react";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, FolderKanban, Plus } from "lucide-react";
import Link from "next/link";
import { EstadoVacio } from "@/components/estado/estado-vacio";
import { BarraAvance, EtiquetaSalud, Persona } from "@/components/tareas/etiquetas";
import { Button } from "@/components/ui/button";
import { NINGUNO, Selector } from "@/components/ui/selector";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PersonaRef } from "@/lib/data/comun";
import type { ProyectoFila } from "@/lib/data/proyectos/consultas";
import { formatearFecha } from "@/lib/fechas";
import { ESTADOS_PROYECTO, NOMBRE_ESTADO_PROYECTO } from "@/lib/validaciones/proyectos";
import { FormularioProyecto } from "./formulario-proyecto";

const ORDEN_SALUD = { atrasado: 0, en_riesgo: 1, al_dia: 2 } as const;

const COLUMNAS: ColumnDef<ProyectoFila>[] = [
  {
    accessorKey: "nombre",
    header: "Nombre",
    cell: ({ row }) => (
      <Link href={`/proyectos/${row.original.id}`} className="flex min-h-11 items-center font-medium underline-offset-4 hover:underline">
        {row.original.nombre}
      </Link>
    ),
  },
  { accessorFn: (p) => p.cliente ?? "", id: "cliente", header: "Cliente", cell: ({ row }) => row.original.cliente ?? <span className="text-muted-foreground">Sin cliente</span> },
  { accessorFn: (p) => p.responsable?.nombre ?? "", id: "responsable", header: "Responsable", cell: ({ row }) => <Persona persona={row.original.responsable} vacio="Sin responsable" /> },
  { accessorKey: "estado", header: "Estado", cell: ({ row }) => NOMBRE_ESTADO_PROYECTO[row.original.estado] },
  { accessorFn: (p) => p.avance ?? -1, id: "avance", header: "Avance", cell: ({ row }) => <BarraAvance avance={row.original.avance} className="w-32" /> },
  {
    accessorFn: (p) => p.fecha_fin_objetivo ?? "9999",
    id: "objetivo",
    header: "Objetivo",
    cell: ({ row }) => (row.original.fecha_fin_objetivo ? <span className="tabular-nums">{formatearFecha(row.original.fecha_fin_objetivo, { anio: true })}</span> : <span className="text-muted-foreground">Sin fecha</span>),
  },
  { accessorFn: (p) => ORDEN_SALUD[p.salud], id: "salud", header: "Salud", cell: ({ row }) => <EtiquetaSalud salud={row.original.salud} /> },
];

/** Tabla densa en escritorio y tarjetas en el celular, con los mismos filtros. */
export function TablaProyectos({
  proyectos,
  personas,
  puedeCrear,
  usuarioId,
}: {
  proyectos: ProyectoFila[];
  personas: PersonaRef[];
  puedeCrear: boolean;
  usuarioId: string;
}) {
  const [orden, setOrden] = useState<SortingState>([]);
  const [estado, setEstado] = useState<string>(NINGUNO);
  const [responsable, setResponsable] = useState<string>(NINGUNO);
  const [creando, setCreando] = useState(false);

  const filtrados = useMemo(
    () =>
      proyectos.filter(
        (p) => (estado === NINGUNO || p.estado === estado) && (responsable === NINGUNO || p.responsable?.id === responsable),
      ),
    [proyectos, estado, responsable],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table devuelve funciones que no se pueden memoizar.
  const tabla = useReactTable({
    data: filtrados,
    columns: COLUMNAS,
    state: { sorting: orden },
    onSortingChange: setOrden,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (p) => p.id,
  });

  const responsables = useMemo(() => {
    const porId = new Map(proyectos.flatMap((p) => (p.responsable ? [[p.responsable.id, p.responsable.nombre] as const] : [])));
    return [...porId].sort((a, b) => a[1].localeCompare(b[1]));
  }, [proyectos]);

  const botonCrear = puedeCrear && (
    <Button onClick={() => setCreando(true)}>
      <Plus aria-hidden /> Nuevo proyecto
    </Button>
  );

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Selector
          etiquetaAria="Filtrar por estado"
          className="sm:w-48"
          valor={estado}
          onCambiar={setEstado}
          opciones={[{ valor: NINGUNO, etiqueta: "Todos los estados" }, ...ESTADOS_PROYECTO.map((e) => ({ valor: e, etiqueta: NOMBRE_ESTADO_PROYECTO[e] }))]}
        />
        <Selector
          etiquetaAria="Filtrar por responsable"
          className="sm:w-56"
          valor={responsable}
          onCambiar={setResponsable}
          opciones={[{ valor: NINGUNO, etiqueta: "Todos los responsables" }, ...responsables.map(([valor, etiqueta]) => ({ valor, etiqueta }))]}
        />
        {puedeCrear && <div className="sm:ml-auto">{botonCrear}</div>}
      </div>

      {filtrados.length === 0 ? (
        <EstadoVacio
          icono={<FolderKanban />}
          className="rounded-[14px] border bg-card"
          titulo={proyectos.length === 0 ? "Todavía no hay proyectos" : "Ningún proyecto coincide con los filtros"}
          texto={
            proyectos.length > 0
              ? "Probá con otro estado o responsable."
              : puedeCrear
                ? "Creá el primero para empezar a cargar tareas."
                : "Cuando te sumen a un proyecto, lo vas a ver acá."
          }
        />
      ) : (
        <>
          <div className="hidden rounded-[14px] border bg-card md:block">
            <Table aria-label="Proyectos">
              <TableHeader>
                {tabla.getHeaderGroups().map((grupo) => (
                  <TableRow key={grupo.id}>
                    {grupo.headers.map((h) => {
                      const sentido = h.column.getIsSorted();
                      const Icono = sentido === "asc" ? ArrowUp : sentido === "desc" ? ArrowDown : ArrowUpDown;
                      return (
                        <TableHead key={h.id} aria-sort={sentido === "asc" ? "ascending" : sentido === "desc" ? "descending" : "none"}>
                          <button type="button" onClick={h.column.getToggleSortingHandler()} className="inline-flex min-h-11 items-center gap-1 font-medium">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            <Icono className="size-3.5 text-muted-foreground" aria-hidden />
                          </button>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {tabla.getRowModel().rows.map((fila) => (
                  <TableRow key={fila.id}>
                    {fila.getVisibleCells().map((celda) => (
                      <TableCell key={celda.id} className="py-0">
                        {flexRender(celda.column.columnDef.cell, celda.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="flex flex-col gap-3 md:hidden">
            {tabla.getRowModel().rows.map(({ original: p }) => (
              <li key={p.id}>
                <Link href={`/proyectos/${p.id}`} className="flex flex-col gap-2 rounded-[14px] border bg-card p-4 active:bg-accent">
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.nombre}</span>
                      <span className="block truncate text-sm text-muted-foreground">{p.cliente ?? "Sin cliente"}</span>
                    </span>
                    <EtiquetaSalud salud={p.salud} />
                  </span>
                  <BarraAvance avance={p.avance} />
                  <span className="flex items-center justify-between gap-3">
                    <Persona persona={p.responsable} vacio="Sin responsable" />
                    <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                      {NOMBRE_ESTADO_PROYECTO[p.estado]}
                      {p.fecha_fin_objetivo && ` · ${formatearFecha(p.fecha_fin_objetivo)}`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {puedeCrear && creando && (
        <FormularioProyecto
          abierta={creando}
          onCambiar={setCreando}
          personas={personas}
          valores={{
            nombre: "",
            descripcion: "",
            cliente: "",
            estado: "activo",
            responsable_id: usuarioId,
            fecha_inicio: "",
            fecha_fin_objetivo: "",
            horas_presupuestadas: "",
          }}
        />
      )}
    </>
  );
}
