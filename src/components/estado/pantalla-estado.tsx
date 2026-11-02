import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  icono: ReactNode;
  titulo: string;
  texto: string;
  /** Botones: el primero es la acción principal. */
  children: ReactNode;
  className?: string;
};

/**
 * Pantalla de estado (error, no encontrado): ícono, título claro, texto corto y acciones.
 * Los botones los pone quien la usa, para poder mezclar enlaces y acciones (Reintentar).
 */
export function PantallaEstado({ icono, titulo, texto, children, className }: Props) {
  return (
    <div
      role="alert"
      className={cn("mx-auto flex w-full max-w-sm flex-col items-center gap-4 px-4 py-16 text-center", className)}
    >
      <div
        aria-hidden
        className="flex size-14 items-center justify-center rounded-full bg-muted text-[var(--estado-alerta)] [&_svg]:size-7"
      >
        {icono}
      </div>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{texto}</p>
      </div>
      <div className="flex w-full flex-col gap-2 pt-2">{children}</div>
    </div>
  );
}
