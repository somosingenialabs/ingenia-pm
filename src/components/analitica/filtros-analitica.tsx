"use client";

import { useState, useTransition, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmentado } from "@/components/ui/segmented";
import { NINGUNO, Selector } from "@/components/ui/selector";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Ref } from "@/lib/data/comun";
import { MAXIMO_DIAS, NOMBRE_PERIODO, PERIODOS, type ClavePeriodo } from "@/lib/data/analitica/reglas";

/** A 375 px las cuatro opciones no entran con el nombre completo. */
const NOMBRE_CORTO: Record<ClavePeriodo, string> = { "4": "4 sem", "12": "12 sem", "26": "26 sem", medida: "A medida" };

/**
 * Filtros de Analítica. Todo va en la URL (`?periodo=`, `?desde=`, `?hasta=`, `?proyecto=`,
 * `?persona=`): sobreviven a recargar y el enlace se puede compartir. Los datos los arma el servidor.
 */
export function FiltrosAnalitica({
  periodo,
  desde,
  hasta,
  hoy,
  proyectos,
  proyectoId,
  personas,
  personaId,
}: {
  periodo: ClavePeriodo;
  desde: string;
  hasta: string;
  hoy: string;
  proyectos: Ref[];
  proyectoId: string | null;
  /** Vacío: no se muestra el filtro de persona (colaborador). */
  personas: Ref[];
  personaId: string | null;
}) {
  const movil = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const parametros = useSearchParams();
  const [cargando, iniciar] = useTransition();
  const [aMedida, setAMedida] = useState(periodo === "medida");
  const [error, setError] = useState<string | null>(null);

  function ir(cambios: Record<string, string | null>) {
    const nuevos = new URLSearchParams(parametros.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null) nuevos.delete(clave);
      else nuevos.set(clave, valor);
    }
    // El detalle de una tarea abierta no tiene que ver con los filtros.
    nuevos.delete("tarea");
    const texto = nuevos.toString();
    iniciar(() => router.push(texto ? `${pathname}?${texto}` : pathname, { scroll: false }));
  }

  function elegirPeriodo(valor: ClavePeriodo) {
    if (valor === "medida") {
      setAMedida(true);
      return;
    }
    setAMedida(false);
    setError(null);
    ir({ periodo: valor === "12" ? null : valor, desde: null, hasta: null });
  }

  function aplicar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const d = String(datos.get("desde") ?? "");
    const h = String(datos.get("hasta") ?? "");
    if (!d || !h) return setError("Elegí las dos fechas.");
    if (d > h) return setError("La fecha de inicio tiene que ser anterior a la de fin.");
    if (h > hoy) return setError("La fecha de fin no puede ser futura.");
    const dias = (Date.parse(h) - Date.parse(d)) / 86_400_000 + 1;
    if (dias > MAXIMO_DIAS) return setError(`El período puede tener hasta ${MAXIMO_DIAS} días.`);
    setError(null);
    ir({ periodo: "medida", desde: d, hasta: h });
  }

  return (
    <div className="flex flex-col gap-3" aria-busy={cargando}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Segmentado
          etiquetaAria="Período"
          className="lg:w-auto"
          valor={aMedida ? "medida" : periodo}
          onChange={elegirPeriodo}
          opciones={PERIODOS.map((p) => ({ valor: p, etiqueta: movil ? NOMBRE_CORTO[p] : NOMBRE_PERIODO[p] }))}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:ml-auto lg:flex">
          <Selector
            etiquetaAria="Proyecto"
            className="lg:w-56"
            valor={proyectoId ?? NINGUNO}
            onCambiar={(v) => ir({ proyecto: v === NINGUNO ? null : v })}
            opciones={[{ valor: NINGUNO, etiqueta: "Todos los proyectos" }, ...proyectos.map((p) => ({ valor: p.id, etiqueta: p.nombre }))]}
          />
          {personas.length > 0 && (
            <Selector
              etiquetaAria="Persona"
              className="lg:w-56"
              valor={personaId ?? NINGUNO}
              onCambiar={(v) => ir({ persona: v === NINGUNO ? null : v })}
              opciones={[{ valor: NINGUNO, etiqueta: "Todo el equipo" }, ...personas.map((p) => ({ valor: p.id, etiqueta: p.nombre }))]}
            />
          )}
        </div>
      </div>

      {aMedida && (
        <form onSubmit={aplicar} className="flex flex-col gap-3 rounded-[14px] border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-end" noValidate>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="analitica-desde">Desde</Label>
            <Input id="analitica-desde" name="desde" type="date" defaultValue={desde} max={hoy} required />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="analitica-hasta">Hasta</Label>
            <Input id="analitica-hasta" name="hasta" type="date" defaultValue={hasta} max={hoy} required />
          </div>
          <Button type="submit" disabled={cargando}>
            Ver período
          </Button>
          {error && (
            <p role="alert" className="text-sm text-destructive sm:basis-full">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
