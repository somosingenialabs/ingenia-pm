"use client";

import { useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarOff, ChevronLeft, ChevronRight, CircleHelp, History } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ErrorDeCarga } from "@/components/estado/error-de-carga";
import { EstadoVacio } from "@/components/estado/estado-vacio";
import { EnlaceTarea } from "@/components/tareas/enlace-tarea";
import { AvatarPersona, EtiquetaEstado, FechaLimite } from "@/components/tareas/etiquetas";
import { Button } from "@/components/ui/button";
import { HojaAdaptable } from "@/components/ui/hoja-adaptable";
import { NINGUNO, Selector } from "@/components/ui/selector";
import { Skeleton } from "@/components/ui/skeleton";
import { listarTareasDeSemana, type Carga, type TareaDeCarga } from "@/lib/data/carga/consultas";
import { textoHoras, textoHorasSobreCapacidad, textoSemana, textoSemanaCorto, UMBRALES_CARGA, type CeldaCarga, type PersonaCarga } from "@/lib/data/carga/reglas";
import type { PersonaRef, Ref } from "@/lib/data/comun";
import { formatearFecha, sumarDias } from "@/lib/fechas";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { EtiquetaNivel } from "./nivel";

const formatoPorcentaje = new Intl.NumberFormat("es-AR", { style: "percent", maximumFractionDigits: 0 });

function textoPorcentaje(c: CeldaCarga) {
  return c.proporcion === null ? "Sin capacidad" : formatoPorcentaje.format(c.proporcion);
}

function textoAtraso(c: CeldaCarga) {
  return c.atrasadas > 0 ? `, ${textoHoras(c.atrasadas)} atrasadas` : "";
}

type Elegida = { persona: PersonaRef; celda: CeldaCarga };

/**
 * Carga por persona y semana. Escritorio: grilla con personas en filas y 8 semanas en columnas.
 * Celular: una semana elegida y la lista de personas. Las dos se dibujan y las separa el CSS.
 * Período y proyecto van en la URL (`?desde=`, `?proyecto=`): los datos los arma el servidor.
 */
export function GrillaCarga({
  carga,
  proyectos,
  proyectoId,
  lunesActual,
  hoy,
}: {
  carga: Carga;
  proyectos: Ref[];
  proyectoId: string | null;
  lunesActual: string;
  hoy: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();
  const [cargando, iniciar] = useTransition();
  const [elegida, setElegida] = useState<Elegida | null>(null);
  const [semanaCelular, setSemanaCelular] = useState(() => (carga.semanas.includes(lunesActual) ? lunesActual : carga.semanas[0]!));

  function ir(cambios: Record<string, string | null>) {
    const nuevos = new URLSearchParams(parametros.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null) nuevos.delete(clave);
      else nuevos.set(clave, valor);
    }
    const texto = nuevos.toString();
    iniciar(() => router.push(texto ? `${pathname}?${texto}` : pathname));
  }

  const desde = carga.semanas[0]!;
  const semanaVisible = carga.semanas.includes(semanaCelular) ? semanaCelular : desde;

  return (
    <div className="flex flex-col gap-4" aria-busy={cargando}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" onClick={() => ir({ desde: null })} disabled={desde === lunesActual}>
            Esta semana
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="4 semanas antes" onClick={() => ir({ desde: sumarDias(desde, -28) })}>
            <ChevronLeft aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="4 semanas después" onClick={() => ir({ desde: sumarDias(desde, 28) })}>
            <ChevronRight aria-hidden />
          </Button>
          <p className="ml-1 text-sm font-medium tabular-nums">
            {formatearFecha(desde)} al {formatearFecha(sumarDias(carga.semanas.at(-1)!, 6), { anio: true })}
          </p>
        </div>
        <Selector
          etiquetaAria="Proyecto"
          className="md:w-64"
          valor={proyectoId ?? NINGUNO}
          onCambiar={(v) => ir({ proyecto: v === NINGUNO ? null : v })}
          opciones={[{ valor: NINGUNO, etiqueta: "Todos los proyectos" }, ...proyectos.map((p) => ({ valor: p.id, etiqueta: p.nombre }))]}
        />
      </div>

      <Leyenda />

      {carga.personas.length === 0 ? (
        <EstadoVacio
          className="rounded-[14px] border bg-card"
          titulo="No hay personas para mostrar"
          texto={proyectoId ? "Este proyecto todavía no tiene miembros." : "Cuando haya personas en la empresa, vas a ver su carga acá."}
        />
      ) : (
        <>
          <GrillaEscritorio carga={carga} lunesActual={lunesActual} alElegir={setElegida} />
          <ListaCelular carga={carga} semana={semanaVisible} lunesActual={lunesActual} alCambiarSemana={setSemanaCelular} alElegir={setElegida} />
        </>
      )}

      <HojaTareas elegida={elegida} proyectoId={proyectoId} hoy={hoy} alCerrar={() => setElegida(null)} />
    </div>
  );
}

function Leyenda() {
  const niveles = [
    ["libre", `menos del ${formatoPorcentaje.format(UMBRALES_CARGA.normalDesde)}`],
    ["normal", `hasta el ${formatoPorcentaje.format(UMBRALES_CARGA.sobrecargaDesde)}`],
    ["sobrecargada", `más del ${formatoPorcentaje.format(UMBRALES_CARGA.sobrecargaDesde)}`],
  ] as const;
  return (
    <div className="flex flex-col gap-2 rounded-[14px] border bg-card px-4 py-3 text-xs lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-6">
      {niveles.map(([nivel, texto]) => (
        <span key={nivel} className="inline-flex items-center gap-1.5">
          <EtiquetaNivel nivel={nivel} />
          <span className="text-muted-foreground">{texto}</span>
        </span>
      ))}
      <span className="text-muted-foreground lg:ml-auto">Horas que faltan de tareas abiertas, de lunes a viernes. Lo vencido cae en esta semana como atrasado. Sin contar feriados.</span>
    </div>
  );
}

/** "3 sin estimar · 2 sin fecha": por qué el número puede quedar corto. */
function Faltantes({ persona }: { persona: PersonaCarga }) {
  if (persona.sinEstimar === 0 && persona.sinFecha === 0) return null;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
      {persona.sinEstimar > 0 && (
        <span className="inline-flex items-center gap-1" title="Tareas de este período sin horas estimadas: no suman a la carga.">
          <CircleHelp className="size-3.5 text-estado-alerta" aria-hidden />
          {persona.sinEstimar} sin estimar
        </span>
      )}
      {persona.sinFecha > 0 && (
        <span className="inline-flex items-center gap-1" title="Tareas abiertas sin fecha límite: no se sabe en qué semana caen.">
          <CalendarOff className="size-3.5 text-estado-alerta" aria-hidden />
          {persona.sinFecha} sin fecha
        </span>
      )}
    </span>
  );
}

function NombrePersona({ persona }: { persona: PersonaCarga }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <AvatarPersona persona={persona.persona} className="size-7" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{persona.persona.nombre}</p>
        <Faltantes persona={persona} />
      </div>
    </div>
  );
}

/** Arriba horas y porcentaje, abajo el nivel: entra en una columna de ~110 px. */
function ContenidoCelda({ celda }: { celda: CeldaCarga }) {
  return (
    <>
      <span className="flex flex-wrap items-baseline gap-x-1.5 text-sm font-medium tabular-nums">
        <span className="whitespace-nowrap">{textoHorasSobreCapacidad(celda.horas, celda.capacidad)}</span>
        <span className="text-xs font-normal whitespace-nowrap text-muted-foreground">{textoPorcentaje(celda)}</span>
      </span>
      <EtiquetaNivel nivel={celda.nivel} />
      {celda.atrasadas > 0 && (
        <span className="inline-flex items-center gap-1 text-xs whitespace-nowrap">
          <History className="size-3.5 shrink-0 text-estado-mora" aria-hidden />
          {textoHoras(celda.atrasadas)} atrasadas
        </span>
      )}
    </>
  );
}

const FONDO_NIVEL = {
  libre: "",
  normal: "bg-[color-mix(in_srgb,var(--estado-ok)_10%,transparent)]",
  sobrecargada: "bg-[color-mix(in_srgb,var(--estado-mora)_10%,transparent)]",
} as const;

function GrillaEscritorio({ carga, lunesActual, alElegir }: { carga: Carga; lunesActual: string; alElegir: (e: Elegida) => void }) {
  // Cada semana necesita ~110 px: desde unos 1440 px entran las 8. En pantallas más angostas la
  // grilla se desplaza de costado, con la columna de personas fija.
  return (
    <div className="hidden overflow-x-auto rounded-[14px] border bg-card md:block">
      <table className="w-full min-w-[1100px] table-fixed border-collapse text-left">
        <caption className="sr-only">Horas asignadas sobre capacidad, por persona y semana</caption>
        <thead>
          <tr className="border-b">
            <th scope="col" className="sticky left-0 z-10 w-52 border-r bg-card px-4 py-2 text-xs font-semibold text-muted-foreground">
              Persona
            </th>
            {carga.semanas.map((s) => (
              <th key={s} scope="col" className="px-1.5 py-2 text-xs font-semibold whitespace-nowrap text-muted-foreground">
                {textoSemanaCorto(s)}
                {s === lunesActual && <span className="block font-normal text-link">Esta semana</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {carga.personas.map((p) => (
            <tr key={p.persona.id} className="border-b last:border-b-0">
              <th scope="row" className="sticky left-0 z-10 overflow-hidden border-r bg-card px-4 py-2 font-normal" title={p.persona.nombre}>
                <NombrePersona persona={p} />
              </th>
              {p.semanas.map((c) => (
                <td key={c.semana} className="p-0.5">
                  <button
                    type="button"
                    onClick={() => alElegir({ persona: p.persona, celda: c })}
                    aria-label={`${p.persona.nombre}, ${textoSemana(c.semana)}: ${textoHoras(c.horas)} de ${textoHoras(c.capacidad)}, ${textoPorcentaje(c)}${textoAtraso(c)}. Ver tareas`}
                    className={cn(
                      "flex min-h-14 w-full min-w-0 flex-col items-start justify-center gap-0.5 overflow-hidden rounded-lg px-1.5 py-1 text-left outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50",
                      FONDO_NIVEL[c.nivel],
                    )}
                  >
                    <ContenidoCelda celda={c} />
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListaCelular({
  carga,
  semana,
  lunesActual,
  alCambiarSemana,
  alElegir,
}: {
  carga: Carga;
  semana: string;
  lunesActual: string;
  alCambiarSemana: (s: string) => void;
  alElegir: (e: Elegida) => void;
}) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      <Selector
        etiquetaAria="Semana"
        valor={semana}
        onCambiar={alCambiarSemana}
        opciones={carga.semanas.map((s) => ({ valor: s, etiqueta: s === lunesActual ? `Esta semana (${textoSemana(s)})` : textoSemana(s) }))}
      />
      <ul className="flex flex-col gap-2">
        {carga.personas.map((p) => {
          const celda = p.semanas.find((c) => c.semana === semana)!;
          return (
            <li key={p.persona.id}>
              <button
                type="button"
                onClick={() => alElegir({ persona: p.persona, celda })}
                aria-label={`${p.persona.nombre}: ${textoHoras(celda.horas)} de ${textoHoras(celda.capacidad)}, ${textoPorcentaje(celda)}${textoAtraso(celda)}. Ver tareas`}
                className={cn(
                  "flex w-full flex-col gap-2 rounded-[14px] border bg-card px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-accent",
                )}
              >
                <NombrePersona persona={p} />
                <span className={cn("flex flex-col gap-0.5 rounded-lg px-2 py-1.5", FONDO_NIVEL[celda.nivel])}>
                  <ContenidoCelda celda={celda} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function HojaTareas({ elegida, proyectoId, hoy, alCerrar }: { elegida: Elegida | null; proyectoId: string | null; hoy: string; alCerrar: () => void }) {
  const db = crearClienteNavegador();
  const consulta = useQuery({
    queryKey: ["carga-semana", elegida?.persona.id, elegida?.celda.semana, proyectoId, hoy],
    queryFn: () => listarTareasDeSemana(db, { personaId: elegida!.persona.id, lunes: elegida!.celda.semana, hoy, proyectoId }),
    enabled: !!elegida,
  });
  const atrasadas = consulta.data?.filter((t) => t.atrasada) ?? [];
  const estimadas = consulta.data?.filter((t) => !t.atrasada && t.horasEstimadas !== null) ?? [];
  const sinEstimar = consulta.data?.filter((t) => !t.atrasada && t.horasEstimadas === null) ?? [];

  return (
    <HojaAdaptable
      abierta={!!elegida}
      onCambiar={(abierta) => !abierta && alCerrar()}
      titulo={elegida?.persona.nombre ?? "Carga"}
      descripcion={elegida ? `Semana del ${textoSemana(elegida.celda.semana)}` : undefined}
    >
      {elegida && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-0.5 rounded-[14px] border bg-card px-4 py-3">
            <ContenidoCelda celda={elegida.celda} />
          </div>
          {consulta.isPending && <Skeleton className="h-32" />}
          {consulta.isError && <ErrorDeCarga titulo="No pudimos cargar las tareas" error={consulta.error} onReintentar={() => void consulta.refetch()} />}
          {consulta.isSuccess && consulta.data.length === 0 && <p className="text-sm text-muted-foreground">No tiene tareas abiertas con fecha en esta semana.</p>}
          {atrasadas.length > 0 && (
            <ListaTareasCarga titulo="Atrasadas" texto="Ya vencieron y siguen abiertas: lo que les falta suma hoy." tareas={atrasadas} hoy={hoy} alAbrir={alCerrar} />
          )}
          {estimadas.length > 0 && (
            <ListaTareasCarga titulo="Suman a la carga" texto="Lo que falta se reparte de lunes a viernes entre el inicio y el límite." tareas={estimadas} hoy={hoy} alAbrir={alCerrar} />
          )}
          {sinEstimar.length > 0 && (
            <ListaTareasCarga titulo="Sin estimar" texto="No suman horas: el número de arriba puede quedar corto." tareas={sinEstimar} hoy={hoy} alAbrir={alCerrar} />
          )}
        </div>
      )}
    </HojaAdaptable>
  );
}

function ListaTareasCarga({
  titulo,
  texto,
  tareas,
  hoy,
  alAbrir,
}: {
  titulo: string;
  texto: string;
  tareas: TareaDeCarga[];
  hoy: string;
  alAbrir: () => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="text-sm font-semibold">{titulo}</h3>
        <p className="text-xs text-muted-foreground">{texto}</p>
      </div>
      <ul className="flex flex-col divide-y rounded-[14px] border bg-card">
        {tareas.map((t) => (
          // Al abrir la tarea se cierra esta hoja: el detalle ocupa el mismo lugar.
          <li key={t.id} className="px-4 py-2" onClickCapture={alAbrir}>
            <EnlaceTarea id={t.id} className="flex min-h-11 items-center text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:underline">
              <span className="line-clamp-2">{t.titulo}</span>
            </EnlaceTarea>
            <p className="text-xs text-muted-foreground">{t.proyectoNombre}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <EtiquetaEstado estado={t.estado} />
              <FechaLimite tarea={{ estado: t.estado, fecha_limite: t.fechaLimite }} hoy={hoy} />
              {t.horasEstimadas !== null && <span className="text-xs text-muted-foreground tabular-nums">{textoHoras(t.horasEstimadas)} estimadas</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
