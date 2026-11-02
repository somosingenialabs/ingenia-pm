"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/** Cuánto hay que arrastrar el agarre hacia abajo para cerrar (px). */
const UMBRAL_CIERRE = 120;

/**
 * Contenedor de todos los formularios de alta y edición (Apple HIG):
 * - celular: hoja que sube desde abajo, con agarre; se cierra arrastrándola hacia abajo;
 * - escritorio: panel lateral a la derecha, que deja ver la lista detrás.
 * `pie` queda fijo abajo (los botones Guardar / Cancelar), siempre a mano.
 */
export function HojaAdaptable({
  abierta,
  onCambiar,
  titulo,
  descripcion,
  children,
  pie,
  className,
}: {
  abierta: boolean;
  onCambiar: (abierta: boolean) => void;
  titulo: string;
  descripcion?: string;
  children: ReactNode;
  pie?: ReactNode;
  className?: string;
}) {
  const esCelular = useIsMobile();
  const [arrastre, setArrastre] = useState(0);
  const inicio = useRef<number | null>(null);

  function alApretar(e: PointerEvent<HTMLDivElement>) {
    inicio.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function alMover(e: PointerEvent<HTMLDivElement>) {
    if (inicio.current === null) return;
    setArrastre(Math.max(0, e.clientY - inicio.current));
  }
  function alSoltar() {
    if (arrastre > UMBRAL_CIERRE) onCambiar(false);
    inicio.current = null;
    setArrastre(0);
  }

  return (
    <Sheet open={abierta} onOpenChange={onCambiar}>
      <SheetContent
        side={esCelular ? "bottom" : "right"}
        showCloseButton={!esCelular}
        style={arrastre ? { transform: `translateY(${arrastre}px)`, transition: "none" } : undefined}
        className={cn(
          "material-grueso gap-0 p-0",
          esCelular
            ? "max-h-[92svh] rounded-t-3xl pb-[env(safe-area-inset-bottom)]"
            : "w-full sm:max-w-md",
          className,
        )}
      >
        {esCelular && (
          <div
            className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center"
            onPointerDown={alApretar}
            onPointerMove={alMover}
            onPointerUp={alSoltar}
            onPointerCancel={alSoltar}
            aria-hidden
          >
            <div className="h-1.5 w-9 rounded-full bg-muted-foreground/40" />
          </div>
        )}
        <div className={cn("shrink-0 px-5", esCelular ? "pt-1 pb-3" : "pt-5 pb-4 pr-12")}>
          <SheetTitle className="texto-titulo-3">{titulo}</SheetTitle>
          {descripcion ? (
            <SheetDescription className="texto-subtitulo mt-1 text-muted-foreground">{descripcion}</SheetDescription>
          ) : (
            <SheetDescription className="sr-only">{titulo}</SheetDescription>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {pie && <div className="flex shrink-0 flex-col-reverse gap-2 border-t px-5 py-3 sm:flex-row sm:justify-end">{pie}</div>}
      </SheetContent>
    </Sheet>
  );
}
