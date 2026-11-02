import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type TamanoBento = "chica" | "mediana" | "grande" | "ancha";
export type EstadoBento = "cargando" | "vacio" | "error" | "listo";

/** Cuánto ocupa cada tamaño: chica 3×1, mediana 6×2, grande 6×3, ancha 12×2 (en escritorio). */
const CLASES_TAMANO: Record<TamanoBento, string> = {
  chica: "md:col-span-3 xl:col-span-3 row-span-1",
  mediana: "md:col-span-6 xl:col-span-6 md:row-span-2",
  grande: "md:col-span-6 xl:col-span-6 md:row-span-3",
  ancha: "md:col-span-6 xl:col-span-12 md:row-span-2",
};

export type Variacion = {
  /** Cambio relativo contra el período anterior (0.12 = +12 %). */
  valor: number;
  /** Si subir es bueno (tareas cerradas) o malo (tareas vencidas). Por defecto, bueno. */
  subirEsBueno?: boolean;
};

/**
 * Tarjeta del Bento.
 * Autoexplicativa: título, "qué mide" en una línea, valor grande, variación con flecha y
 * signo (nunca solo color) y lugar para el gráfico.
 */
export function BentoCard({
  tamano,
  titulo,
  queMide,
  valor,
  variacion,
  estado = "listo",
  onReintentar,
  textoVacio = "Todavía no hay datos para este período.",
  accionError,
  href,
  children,
  className,
}: {
  tamano: TamanoBento;
  titulo: string;
  queMide: string;
  valor?: ReactNode;
  variacion?: Variacion;
  estado?: EstadoBento;
  onReintentar?: () => void;
  textoVacio?: string;
  /** Acción del estado de error cuando la tarjeta se arma en el servidor y no puede pasar una función. */
  accionError?: ReactNode;
  /** La tarjeta entera lleva a este lugar. */
  href?: string;
  children?: ReactNode;
  className?: string;
}) {
  const tarjeta = (
    <section
      aria-label={titulo}
      aria-busy={estado === "cargando"}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card p-4 text-card-foreground",
        href ? "h-full transition-colors group-hover/tarjeta:bg-accent" : [CLASES_TAMANO[tamano], className],
      )}
    >
      <header className="space-y-0.5">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        <p className="text-xs text-muted-foreground">{queMide}</p>
      </header>

      {estado === "cargando" && (
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="w-full flex-1" />
        </div>
      )}

      {estado === "vacio" && (
        <p className="flex flex-1 items-center text-sm text-muted-foreground">{textoVacio}</p>
      )}

      {estado === "error" && (
        <div role="alert" className="flex flex-1 flex-col items-start justify-center gap-2 text-sm">
          <p>No pudimos cargar este dato.</p>
          {onReintentar && (
            <Button size="sm" variant="outline" onClick={onReintentar}>
              <RefreshCw aria-hidden /> Reintentar
            </Button>
          )}
          {accionError}
        </div>
      )}

      {estado === "listo" && (
        <>
          {(valor !== undefined || variacion) && (
            <div className="flex items-baseline gap-2">
              {valor !== undefined && <p className="text-3xl font-semibold tracking-tight tabular-nums">{valor}</p>}
              {variacion && <IndicadorVariacion {...variacion} />}
            </div>
          )}
          {children && <div className="min-h-0 flex-1">{children}</div>}
        </>
      )}
    </section>
  );

  if (!href) return tarjeta;
  return (
    <Link href={href} className={cn("group/tarjeta rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50", CLASES_TAMANO[tamano], className)}>
      {tarjeta}
    </Link>
  );
}

function IndicadorVariacion({ valor, subirEsBueno = true }: Variacion) {
  const formato = new Intl.NumberFormat("es-AR", { style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero" });
  const neutro = Math.abs(valor) < 0.0005;
  const bueno = neutro ? null : (valor > 0) === subirEsBueno;
  const Icono = neutro ? Minus : valor > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-sm font-medium tabular-nums",
        bueno === null ? "text-muted-foreground" : bueno ? "text-[var(--estado-ok)]" : "text-[var(--estado-mora)]",
      )}
    >
      <Icono className="size-4" aria-hidden />
      {formato.format(valor)}
      <span className="sr-only">contra el período anterior</span>
    </span>
  );
}
