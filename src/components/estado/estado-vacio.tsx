import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Lista o bloque sin datos: qué pasa y, si corresponde, la acción para empezar. */
export function EstadoVacio({
  icono,
  titulo,
  texto,
  accion,
  className,
}: {
  icono?: ReactNode;
  titulo: string;
  texto?: string;
  accion?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-4 py-12 text-center", className)}>
      {icono && (
        <div aria-hidden className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6">
          {icono}
        </div>
      )}
      <p className="font-medium">{titulo}</p>
      {texto && <p className="max-w-sm text-sm text-muted-foreground">{texto}</p>}
      {accion}
    </div>
  );
}
