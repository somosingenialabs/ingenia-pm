"use client";

import { UserRound } from "lucide-react";
import { navegarSinRecargar, useUrlCon } from "@/components/tareas/enlace-tarea";
import { Button } from "@/components/ui/button";
import { Segmentado } from "@/components/ui/segmented";
import { NINGUNO, Selector } from "@/components/ui/selector";
import type { PersonaRef, Ref } from "@/lib/data/comun";
import type { ModoCalendario } from "@/lib/data/calendario/reglas";

export type FiltrosElegidos = {
  modo: ModoCalendario;
  proyectoId: string | null;
  personaId: string | null;
  soloMias: boolean;
};

/** Lee los filtros de la URL: así se comparten por enlace y "atrás" los recuerda. */
export function leerFiltros(parametros: URLSearchParams): FiltrosElegidos {
  return {
    modo: parametros.get("modo") === "duracion" ? "duracion" : "plazos",
    proyectoId: parametros.get("proyecto"),
    personaId: parametros.get("persona"),
    soloMias: parametros.get("mias") === "1",
  };
}

const OPCIONES_MODO = [
  { valor: "plazos" as const, etiqueta: "Plazos" },
  { valor: "duracion" as const, etiqueta: "Duración" },
];

export function FiltrosCalendario({ filtros, proyectos, personas }: { filtros: FiltrosElegidos; proyectos: Ref[]; personas: PersonaRef[] }) {
  const urlCon = useUrlCon();
  const cambiar = (cambios: Record<string, string | null>) => navegarSinRecargar(urlCon(cambios));

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <Segmentado
        etiquetaAria="Qué mostrar de cada tarea"
        className="lg:w-56"
        opciones={OPCIONES_MODO}
        valor={filtros.modo}
        onChange={(v) => cambiar({ modo: v === "plazos" ? null : v })}
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] lg:flex-1">
        <Selector
          etiquetaAria="Proyecto"
          valor={filtros.proyectoId ?? NINGUNO}
          onCambiar={(v) => cambiar({ proyecto: v === NINGUNO ? null : v })}
          opciones={[{ valor: NINGUNO, etiqueta: "Todos los proyectos" }, ...proyectos.map((p) => ({ valor: p.id, etiqueta: p.nombre }))]}
        />
        <Selector
          etiquetaAria="Persona"
          valor={filtros.soloMias ? NINGUNO : (filtros.personaId ?? NINGUNO)}
          deshabilitado={filtros.soloMias}
          onCambiar={(v) => cambiar({ persona: v === NINGUNO ? null : v })}
          opciones={[{ valor: NINGUNO, etiqueta: filtros.soloMias ? "Solo las mías" : "Todas las personas" }, ...personas.map((p) => ({ valor: p.id, etiqueta: p.nombre }))]}
        />
        <Button
          type="button"
          variant={filtros.soloMias ? "default" : "outline"}
          aria-pressed={filtros.soloMias}
          onClick={() => cambiar({ mias: filtros.soloMias ? null : "1", persona: null })}
        >
          <UserRound aria-hidden /> Solo mías
        </Button>
      </div>
    </div>
  );
}
