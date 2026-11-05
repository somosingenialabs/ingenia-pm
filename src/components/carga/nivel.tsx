import { AlertTriangle, CircleCheck, CircleDashed, type LucideIcon } from "lucide-react";
import { NOMBRE_NIVEL, type NivelCarga } from "@/lib/data/carga/reglas";
import { cn } from "@/lib/utils";

// El nivel siempre va con ícono y texto. El color queda en el ícono: el texto va en el color
// normal, porque el turquesa y el ámbar no llegan a AA sobre fondo claro.
const ICONO: Record<NivelCarga, { icono: LucideIcon; clase: string }> = {
  libre: { icono: CircleDashed, clase: "text-muted-foreground" },
  normal: { icono: CircleCheck, clase: "text-estado-ok" },
  sobrecargada: { icono: AlertTriangle, clase: "text-estado-mora" },
};

export function EtiquetaNivel({ nivel, className }: { nivel: NivelCarga; className?: string }) {
  const { icono: Icono, clase } = ICONO[nivel];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs whitespace-nowrap", className)}>
      <Icono className={cn("size-3.5 shrink-0", clase)} aria-hidden />
      {NOMBRE_NIVEL[nivel]}
    </span>
  );
}
