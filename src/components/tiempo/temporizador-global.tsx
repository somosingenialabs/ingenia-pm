"use client";

import { Square } from "lucide-react";
import { EnlaceTarea } from "@/components/tareas/enlace-tarea";
import { Button } from "@/components/ui/button";
import { textoCronometro, segundosCorridos } from "@/lib/data/tiempo/reglas";
import { cn } from "@/lib/utils";
import { useAhora, useTiempo } from "./proveedor-tiempo";

/** `ahora - inicio`, cada segundo. Lo lee un lector de pantalla solo si se le pide (role="timer"). */
export function Cronometro({ inicio, className }: { inicio: string; className?: string }) {
  const ahora = useAhora(true);
  return (
    <span role="timer" className={cn("tabular-nums", className)}>
      {textoCronometro(segundosCorridos(inicio, ahora))}
    </span>
  );
}

/** Punto que late: acompaña al texto "Midiendo", nunca va solo. */
function Punto() {
  return <span aria-hidden className="size-2 shrink-0 rounded-full bg-destructive motion-safe:animate-pulse" />;
}

/** En el encabezado de escritorio, si hay uno corriendo: tarea, tiempo y detener. */
export function TemporizadorEncabezado() {
  const { temporizador, ocupado, pedirDetener } = useTiempo();
  if (!temporizador?.inicio) return null;
  return (
    <div role="group" aria-label="Temporizador" className="hidden h-12 min-w-0 items-center gap-2 rounded-xl border bg-card pr-0.5 pl-3 md:flex">
      <Punto />
      <span className="sr-only">Midiendo</span>
      <EnlaceTarea id={temporizador.tareaId} className="flex min-h-11 max-w-56 min-w-0 items-center text-sm underline-offset-4 hover:underline focus-visible:underline">
        <span className="truncate">{temporizador.tareaTitulo}</span>
      </EnlaceTarea>
      <Cronometro inicio={temporizador.inicio} className="text-sm font-semibold" />
      <Button size="sm" variant="secondary" disabled={ocupado} onClick={pedirDetener}>
        <Square aria-hidden className="fill-current" /> Detener
      </Button>
    </div>
  );
}

/** En el celular, sobre la barra de pestañas. */
export function TemporizadorCelular() {
  const { temporizador, ocupado, pedirDetener } = useTiempo();
  if (!temporizador?.inicio) return null;
  return (
    <div
      role="group"
      aria-label="Temporizador"
      className="material-regular fixed inset-x-0 bottom-[calc(49px+env(safe-area-inset-bottom))] z-30 flex h-14 items-center gap-3 border-t px-4 md:hidden"
    >
      <Punto />
      <EnlaceTarea id={temporizador.tareaId} className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
        <span className="truncate text-[15px] font-medium">
          <span className="sr-only">Midiendo: </span>
          {temporizador.tareaTitulo}
        </span>
        <Cronometro inicio={temporizador.inicio} className="text-[13px] text-muted-foreground" />
      </EnlaceTarea>
      <Button size="sm" variant="secondary" disabled={ocupado} onClick={pedirDetener}>
        <Square aria-hidden className="fill-current" /> Detener
      </Button>
    </div>
  );
}

/** Lugar al final del contenido, para que la barra del celular no tape lo último de la pantalla. */
export function EspacioTemporizador() {
  const { temporizador } = useTiempo();
  return temporizador ? <div aria-hidden className="h-14 shrink-0 md:hidden" /> : null;
}
