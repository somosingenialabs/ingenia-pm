"use client";

import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export interface OpcionSegmentada<T extends string> {
  valor: T;
  etiqueta: string;
  /** Cantidad opcional que se muestra al lado de la etiqueta. */
  cantidad?: number;
}

/**
 * Control segmentado (Apple HIG): para elegir UNA vista entre pocas opciones relacionadas.
 * El segmento elegido es uno de los tres lugares con neumorfismo (globals.css).
 * Se maneja con el dedo, el mouse o el teclado (flechas, inicio y fin).
 */
export function Segmentado<T extends string>({
  opciones,
  valor,
  onChange,
  etiquetaAria,
  className,
}: {
  opciones: OpcionSegmentada<T>[];
  valor: T;
  onChange: (v: T) => void;
  etiquetaAria: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function alTeclear(e: KeyboardEvent, i: number) {
    const ultimo = opciones.length - 1;
    const destino =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? (i + 1) % opciones.length
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? (i - 1 + opciones.length) % opciones.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? ultimo
              : null;
    if (destino === null) return;
    e.preventDefault();
    onChange(opciones[destino]!.valor);
    refs.current[destino]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={etiquetaAria}
      className={cn("no-scrollbar flex w-full gap-0.5 overflow-x-auto rounded-xl bg-secondary p-0.5", className)}
    >
      {opciones.map((o, i) => {
        const activa = o.valor === valor;
        return (
          <button
            key={o.valor}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={activa}
            tabIndex={activa ? 0 : -1}
            onClick={() => onChange(o.valor)}
            onKeyDown={(e) => alTeclear(e, i)}
            className={cn(
              "flex min-h-9 flex-1 shrink-0 items-center justify-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3 pointer-coarse:min-h-11 pointer-coarse:text-[14px]",
              activa ? "border bg-card text-foreground" : "text-muted-foreground active:bg-accent",
            )}
          >
            {o.etiqueta}
            {o.cantidad !== undefined && (
              <span className={cn("text-[12px] tabular-nums", activa ? "text-muted-foreground" : "text-muted-foreground/80")}>
                {o.cantidad}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
