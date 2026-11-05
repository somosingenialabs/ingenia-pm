"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Clock, Plus, TriangleAlert } from "lucide-react";
import { ErrorDeCarga } from "@/components/estado/error-de-carga";
import { EstadoVacio } from "@/components/estado/estado-vacio";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Selector } from "@/components/ui/selector";
import { Skeleton } from "@/components/ui/skeleton";
import { textoSemana } from "@/lib/data/carga/reglas";
import type { PersonaRef } from "@/lib/data/comun";
import { listarRegistrosDeSemana, type RegistroFila } from "@/lib/data/tiempo/consultas";
import { armarSemana, textoDuracion, textoTotal, type FilaSemana } from "@/lib/data/tiempo/reglas";
import { formatearDia, sumarDias } from "@/lib/fechas";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { DialogoRegistro, type PedidoRegistro } from "./dialogo-registro";
import { ListaRegistros } from "./lista-registros";
import { useTiempo } from "./proveedor-tiempo";

type Celda = { fila: FilaSemana; fecha: string };

/**
 * Grilla semanal de horas: tareas por día, con totales. En el celular, lista por día. Tocar una
 * celda vacía carga horas en esa tarea y ese día; una con horas muestra sus registros. Un Admin
 * puede mirar a otra persona para corregir sus horas, pero no cargar a su nombre.
 */
export function MisHoras({
  lunes,
  lunesActual,
  persona,
  personas,
}: {
  lunes: string;
  lunesActual: string;
  /** Otra persona que mira un Admin; null son las propias. */
  persona: PersonaRef | null;
  /** Solo para un Admin: el filtro de persona. */
  personas: PersonaRef[];
}) {
  const db = crearClienteNavegador();
  const router = useRouter();
  const { usuarioId, hoy } = useTiempo();
  const personaId = persona?.id ?? usuarioId;
  const propias = !persona;
  const [pedido, setPedido] = useState<PedidoRegistro | null>(null);
  const [celda, setCelda] = useState<Celda | null>(null);

  const consulta = useQuery({
    queryKey: ["registros", "semana", personaId, lunes],
    queryFn: () => listarRegistrosDeSemana(db, { usuarioId: personaId, lunes }),
    staleTime: 0,
  });
  const registros = useMemo(() => consulta.data ?? [], [consulta.data]);
  const semana = useMemo(() => armarSemana(registros, lunes), [registros, lunes]);

  function url(cambios: { semana?: string; persona?: string | null }) {
    const p = new URLSearchParams();
    const s = cambios.semana ?? lunes;
    if (s !== lunesActual) p.set("semana", s);
    const per = cambios.persona === undefined ? persona?.id : cambios.persona;
    if (per && per !== usuarioId) p.set("persona", per);
    const texto = p.toString();
    return texto ? `/horas?${texto}` : "/horas";
  }

  const deCelda = (c: Celda) => registros.filter((r) => r.tareaId === c.fila.tareaId && r.fecha === c.fecha);
  const cargar = (extra: { fecha?: string; tarea?: { id: string; nombre: string } } = {}) =>
    setPedido({ modo: "crear", fecha: extra.fecha && extra.fecha <= hoy ? extra.fecha : undefined, tarea: extra.tarea });

  function tocarCelda(fila: FilaSemana, fecha: string) {
    const c = { fila, fecha };
    if (deCelda(c).length > 0) setCelda(c);
    else if (propias && fecha <= hoy) cargar({ fecha, tarea: { id: fila.tareaId, nombre: fila.tareaTitulo } });
  }

  const enEstaSemana = lunes <= hoy && hoy <= sumarDias(lunes, 6);

  return (
    <>
      <PageHeader
        titulo={propias ? "Mis horas" : `Horas de ${persona.nombre}`}
        descripcion={propias ? "Lo que registraste cada día, por tarea." : "Podés corregir o borrar sus registros. Para cargar a su nombre, tiene que hacerlo esa persona."}
        acciones={
          propias ? (
            <Button onClick={() => cargar({ fecha: enEstaSemana ? hoy : sumarDias(lunes, 4) })}>
              <Plus aria-hidden /> Cargar horas
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Semana" className="flex items-center gap-1">
          <Button asChild variant="outline" size="icon">
            <Link href={url({ semana: sumarDias(lunes, -7) })} aria-label="Semana anterior">
              <ChevronLeft aria-hidden />
            </Link>
          </Button>
          <p className="min-w-40 px-2 text-center text-sm font-medium tabular-nums" aria-live="polite">
            {lunes === lunesActual ? "Esta semana" : textoSemana(lunes)}
            {lunes === lunesActual && <span className="block text-xs font-normal text-muted-foreground">{textoSemana(lunes)}</span>}
          </p>
          {lunes < lunesActual ? (
            <Button asChild variant="outline" size="icon">
              <Link href={url({ semana: sumarDias(lunes, 7) })} aria-label="Semana siguiente">
                <ChevronRight aria-hidden />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="icon" disabled aria-label="Semana siguiente: todavía no llegó">
              <ChevronRight aria-hidden />
            </Button>
          )}
          {lunes !== lunesActual && (
            <Button asChild variant="ghost">
              <Link href={url({ semana: lunesActual })}>Hoy</Link>
            </Button>
          )}
        </nav>
        {personas.length > 0 && (
          <Selector
            etiquetaAria="Persona"
            valor={personaId}
            onCambiar={(id) => router.push(url({ persona: id }))}
            opciones={personas.map((p) => ({ valor: p.id, etiqueta: p.id === usuarioId ? `${p.nombre} (vos)` : p.nombre }))}
            className="sm:w-64"
          />
        )}
      </div>

      {consulta.isPending && <Skeleton className="h-64" />}
      {consulta.isError && <ErrorDeCarga titulo="No pudimos cargar las horas" error={consulta.error} onReintentar={() => void consulta.refetch()} />}

      {consulta.isSuccess && (
        <>
          {semana.diasLargos.map((dia) => (
            <p key={dia} role="status" className="flex items-start gap-2 rounded-[14px] border border-estado-alerta/40 bg-estado-alerta/10 px-4 py-3 text-sm">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-estado-alerta" />
              <span>
                El {formatearDia(dia)} suma {textoDuracion(semana.totalesPorDia[semana.dias.indexOf(dia)]!)}, más de 12 h en un día. Revisá que esté bien.
              </span>
            </p>
          ))}

          {semana.filas.length === 0 ? (
            <EstadoVacio
              icono={<Clock />}
              titulo="No hay horas en esta semana"
              texto={propias ? "Cargalas a mano o con el temporizador de una tarea." : undefined}
              className="hidden md:flex"
            />
          ) : (
            <Grilla semana={semana} hoy={hoy} propias={propias} onTocar={tocarCelda} />
          )}
          <ListaPorDia semana={semana} registros={registros} hoy={hoy} propias={propias} onCargar={(fecha) => cargar({ fecha })} />
        </>
      )}

      <DialogoRegistro pedido={pedido} onCerrar={() => setPedido(null)} />
      <DialogoCelda
        celda={celda}
        registros={celda ? deCelda(celda) : []}
        puedeCargar={!!celda && propias && celda.fecha <= hoy}
        onCerrar={() => setCelda(null)}
        onCargar={() => {
          if (!celda) return;
          cargar({ fecha: celda.fecha, tarea: { id: celda.fila.tareaId, nombre: celda.fila.tareaTitulo } });
          setCelda(null);
        }}
      />
    </>
  );
}

function Grilla({
  semana,
  hoy,
  propias,
  onTocar,
}: {
  semana: ReturnType<typeof armarSemana>;
  hoy: string;
  propias: boolean;
  onTocar: (fila: FilaSemana, fecha: string) => void;
}) {
  return (
    <div className="hidden overflow-x-auto rounded-[14px] border bg-card md:block">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <caption className="sr-only">Horas por tarea y día. Tocá una celda para ver sus registros o cargar horas.</caption>
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="px-4 py-2 font-medium">
              Tarea
            </th>
            {semana.dias.map((dia) => (
              <th key={dia} scope="col" className={cn("w-20 px-1 py-2 text-center font-medium capitalize", dia === hoy && "text-foreground")}>
                {formatearDia(dia)}
                {dia === hoy && <span className="block text-[11px] font-semibold normal-case text-link">Hoy</span>}
              </th>
            ))}
            <th scope="col" className="w-20 px-3 py-2 text-right font-medium">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {semana.filas.map((fila) => (
            <tr key={fila.tareaId} className="border-b last:border-b-0">
              <th scope="row" className="max-w-0 px-4 py-1 text-left font-normal">
                <span className="block truncate font-medium">{fila.tareaTitulo}</span>
                <span className="block truncate text-xs text-muted-foreground">{fila.proyectoNombre}</span>
              </th>
              {semana.dias.map((dia, i) => {
                const minutos = fila.dias[i]!;
                const tocable = minutos > 0 || (propias && dia <= hoy);
                const texto = minutos > 0 ? textoTotal(minutos) : "";
                return (
                  <td key={dia} className={cn("p-0.5 text-center", dia === hoy && "bg-muted/50")}>
                    {tocable ? (
                      <button
                        type="button"
                        onClick={() => onTocar(fila, dia)}
                        aria-label={
                          minutos > 0
                            ? `${fila.tareaTitulo}, ${formatearDia(dia)}: ${textoDuracion(minutos)}. Ver registros`
                            : `Cargar horas en ${fila.tareaTitulo} el ${formatearDia(dia)}`
                        }
                        className="group flex min-h-11 w-full items-center justify-center rounded-lg tabular-nums outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {texto || <Plus aria-hidden className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />}
                      </button>
                    ) : (
                      <span className="flex min-h-11 items-center justify-center" />
                    )}
                  </td>
                );
              })}
              <td className="px-3 text-right font-semibold tabular-nums">{textoTotal(fila.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/30">
            <th scope="row" className="px-4 py-3 text-left font-semibold">
              Total
            </th>
            {semana.totalesPorDia.map((minutos, i) => (
              <td key={semana.dias[i]} className="px-1 text-center font-semibold tabular-nums">
                {textoTotal(minutos)}
              </td>
            ))}
            <td className="px-3 text-right font-bold tabular-nums">{textoTotal(semana.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Celular: un bloque por día, con su total y "Cargar". */
function ListaPorDia({
  semana,
  registros,
  hoy,
  propias,
  onCargar,
}: {
  semana: ReturnType<typeof armarSemana>;
  registros: readonly RegistroFila[];
  hoy: string;
  propias: boolean;
  onCargar: (fecha: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4 md:hidden">
      <p className="text-sm">
        Total de la semana: <span className="font-semibold tabular-nums">{textoDuracion(semana.total)}</span>
      </p>
      {semana.dias.map((dia, i) => {
        const delDia = registros.filter((r) => r.fecha === dia && r.minutos !== null);
        return (
          <section key={dia} aria-labelledby={`dia-${dia}`} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 id={`dia-${dia}`} className="text-[17px] font-semibold capitalize">
                {formatearDia(dia)}
                {dia === hoy && <span className="ml-2 text-sm font-medium normal-case text-link">Hoy</span>}
                <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">{textoTotal(semana.totalesPorDia[i]!)}</span>
              </h2>
              {propias && dia <= hoy && (
                <Button variant="ghost" size="sm" onClick={() => onCargar(dia)} aria-label={`Cargar horas el ${formatearDia(dia)}`}>
                  <Plus aria-hidden /> Cargar
                </Button>
              )}
            </div>
            {delDia.length > 0 && <ListaRegistros registros={delDia} mostrarTarea mostrarFecha={false} />}
          </section>
        );
      })}
    </div>
  );
}

function DialogoCelda({
  celda,
  registros,
  puedeCargar,
  onCerrar,
  onCargar,
}: {
  celda: Celda | null;
  registros: RegistroFila[];
  puedeCargar: boolean;
  onCerrar: () => void;
  onCargar: () => void;
}) {
  return (
    <Dialog open={!!celda} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{celda?.fila.tareaTitulo}</DialogTitle>
          <DialogDescription className="capitalize">{celda ? formatearDia(celda.fecha) : ""}</DialogDescription>
        </DialogHeader>
        {registros.length > 0 ? (
          <ListaRegistros registros={registros} mostrarFecha={false} />
        ) : (
          <p className="text-sm text-muted-foreground">No quedan registros en este día.</p>
        )}
        {puedeCargar && (
          <DialogFooter>
            <Button variant="outline" onClick={onCargar}>
              <Plus aria-hidden /> Cargar más
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
