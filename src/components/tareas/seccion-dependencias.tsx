"use client";

import { useCallback, useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { ErrorDeCarga } from "@/components/estado/error-de-carga";
import { mensajeDeError } from "@/components/estado/mensaje-de-error";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { ConfirmarAccion, type ConfirmacionPendiente } from "@/components/ui/confirmar-accion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { Ref } from "@/lib/data/comun";
import { agregarDependencia, quitarDependencia } from "@/lib/data/dependencias/acciones";
import { buscarTareasDelProyecto, listarDependenciasDeTarea, type TareaVinculada } from "@/lib/data/dependencias/consultas";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { EnlaceTarea } from "./enlace-tarea";
import { EtiquetaEstado } from "./etiquetas";

type Lado = "dependeDe" | "bloquea";

const TEXTOS: Record<Lado, { titulo: string; ayuda: string; vacio: string; agregar: string }> = {
  dependeDe: {
    titulo: "Depende de",
    ayuda: "Esta tarea no arranca hasta que terminen estas.",
    vacio: "No depende de ninguna tarea.",
    agregar: "Tarea de la que depende",
  },
  bloquea: {
    titulo: "Bloquea",
    ayuda: "Estas tareas no arrancan hasta que termine esta.",
    vacio: "No bloquea a ninguna tarea.",
    agregar: "Tarea que bloquea",
  },
};

/** Dependencias de la tarea, en el detalle. Solo la ve y la usa quien gestiona el proyecto. */
export function SeccionDependencias({ tareaId, proyectoId }: { tareaId: string; proyectoId: string }) {
  const db = crearClienteNavegador();
  const clienteConsultas = useQueryClient();
  const [confirmacion, setConfirmacion] = useState<ConfirmacionPendiente | null>(null);
  const consulta = useQuery({ queryKey: ["dependencias", tareaId], queryFn: () => listarDependenciasDeTarea(db, tareaId) });

  function refrescar() {
    void clienteConsultas.invalidateQueries({ queryKey: ["dependencias"] });
    void clienteConsultas.invalidateQueries({ queryKey: ["calendario"] });
  }

  function pedirQuitar(lado: Lado, otra: TareaVinculada) {
    const par = lado === "dependeDe" ? { tarea_id: tareaId, depende_de_id: otra.id } : { tarea_id: otra.id, depende_de_id: tareaId };
    setConfirmacion({
      titulo: "¿Quitar esta dependencia?",
      descripcion:
        lado === "dependeDe"
          ? `Esta tarea deja de esperar a «${otra.titulo}».`
          : `«${otra.titulo}» deja de esperar a esta tarea.`,
      etiqueta: "Quitar dependencia",
      accion: async () => {
        const resultado = await quitarDependencia(par);
        if (!resultado.ok) {
          toast.error(resultado.error);
          return;
        }
        toast.success("Dependencia quitada.");
        refrescar();
      },
    });
  }

  return (
    <section aria-labelledby={`dependencias-${tareaId}`} className="flex flex-col gap-4 border-t pt-4">
      <h3 id={`dependencias-${tareaId}`} className="flex items-center gap-2 texto-titulo-3">
        <Link2 className="size-5 text-muted-foreground" aria-hidden />
        Dependencias
      </h3>
      {consulta.isPending && <Skeleton className="h-24" />}
      {consulta.isError && <ErrorDeCarga titulo="No pudimos cargar las dependencias" error={consulta.error} onReintentar={() => void consulta.refetch()} />}
      {consulta.isSuccess &&
        (["dependeDe", "bloquea"] as const).map((lado) => (
          <GrupoDependencias
            key={lado}
            lado={lado}
            tareaId={tareaId}
            proyectoId={proyectoId}
            vinculadas={consulta.data[lado]}
            excluir={[tareaId, ...consulta.data.dependeDe.map((t) => t.id), ...consulta.data.bloquea.map((t) => t.id)]}
            buscarEn={db}
            alQuitar={(t) => pedirQuitar(lado, t)}
            alAgregar={refrescar}
          />
        ))}
      <ConfirmarAccion pendiente={confirmacion} onCerrar={() => setConfirmacion(null)} />
    </section>
  );
}

function GrupoDependencias({
  lado,
  tareaId,
  proyectoId,
  vinculadas,
  excluir,
  buscarEn,
  alQuitar,
  alAgregar,
}: {
  lado: Lado;
  tareaId: string;
  proyectoId: string;
  vinculadas: TareaVinculada[];
  excluir: string[];
  buscarEn: ReturnType<typeof crearClienteNavegador>;
  alQuitar: (t: TareaVinculada) => void;
  alAgregar: () => void;
}) {
  const textos = TEXTOS[lado];
  const id = useId();
  const [elegida, setElegida] = useState<Ref | null>(null);
  const [desfase, setDesfase] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const claveExcluir = excluir.join(",");
  // Estable mientras no cambien las vinculadas: el combo vuelve a buscar solo si cambia.
  const buscar = useCallback(
    (texto: string) => buscarTareasDelProyecto(buscarEn, { proyectoId, texto, excluir: claveExcluir.split(",") }),
    [buscarEn, proyectoId, claveExcluir],
  );

  async function agregar() {
    if (!elegida) {
      setError("Elegí una tarea de la lista.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const par = lado === "dependeDe" ? { tarea_id: tareaId, depende_de_id: elegida.id } : { tarea_id: elegida.id, depende_de_id: tareaId };
      const resultado = await agregarDependencia({ ...par, desfase_dias: desfase }, tareaId);
      if (!resultado.ok) {
        setError(resultado.campos?.desfase_dias ?? resultado.error);
        return;
      }
      toast.success("Dependencia agregada.");
      for (const aviso of resultado.datos.avisos) toast.warning(aviso);
      setElegida(null);
      setDesfase("0");
      alAgregar();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <h4 className="text-sm font-semibold">{textos.titulo}</h4>
        <p className="text-xs text-muted-foreground">{textos.ayuda}</p>
      </div>

      {vinculadas.length === 0 ? (
        <p className="text-sm text-muted-foreground">{textos.vacio}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-[14px] border bg-card">
          {vinculadas.map((t) => (
            <li key={t.id} className="flex items-center gap-2 py-1 pr-1 pl-3">
              <div className="min-w-0 flex-1">
                <EnlaceTarea id={t.id} className="flex min-h-11 items-center text-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:underline">
                  <span className="truncate">{t.titulo}</span>
                </EnlaceTarea>
                <div className="flex flex-wrap items-center gap-x-3 pb-1">
                  <EtiquetaEstado estado={t.estado} />
                  {t.desfaseDias > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t.desfaseDias === 1 ? "1 día de desfase" : `${t.desfaseDias} días de desfase`}
                    </span>
                  )}
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" aria-label={`Quitar dependencia con ${t.titulo}`} onClick={() => alQuitar(t)}>
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor={`${id}-tarea`}>{textos.agregar}</Label>
          <Combobox
            id={`${id}-tarea`}
            valor={elegida}
            onCambiar={(v) => {
              setElegida(v);
              setError(null);
            }}
            buscar={buscar}
            placeholder="Elegí una tarea del proyecto"
            etiquetaBusqueda="Buscar tarea…"
            invalido={!!error}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-desfase`}>Desfase (días)</Label>
          <Input
            id={`${id}-desfase`}
            type="number"
            inputMode="numeric"
            min={0}
            max={365}
            step={1}
            value={desfase}
            onChange={(e) => setDesfase(e.target.value)}
            className="h-11 tabular-nums"
          />
        </div>
        <Button type="button" variant="outline" onClick={() => void agregar()} disabled={enviando} className="self-end">
          <Plus aria-hidden /> {enviando ? "Agregando…" : "Agregar"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
