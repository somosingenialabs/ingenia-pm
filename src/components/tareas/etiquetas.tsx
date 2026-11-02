import { AlertTriangle, ArrowDown, ArrowUp, CalendarDays, ChevronsUp, Circle, CircleAlert, CircleCheck, CircleDashed, CircleDot, CircleX, Equal, Eye, type LucideIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { PersonaRef } from "@/lib/data/comun";
import { NOMBRE_SALUD, textoAvance, type Salud } from "@/lib/data/proyectos/salud";
import { NOMBRE_ESTADO, NOMBRE_PRIORIDAD, estaVencida } from "@/lib/data/tareas/reglas";
import { formatearFecha } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import type { EstadoTarea, Prioridad } from "@/lib/validaciones/tareas";

// El estado siempre lleva texto o ícono además del color. El color queda en el ícono: el texto va
// en el color normal, porque el turquesa y el ámbar no llegan a AA sobre fondo claro.

const ICONO_PRIORIDAD: Record<Prioridad, { icono: LucideIcon; clase: string }> = {
  baja: { icono: ArrowDown, clase: "text-muted-foreground" },
  media: { icono: Equal, clase: "text-muted-foreground" },
  alta: { icono: ArrowUp, clase: "text-estado-alerta" },
  urgente: { icono: ChevronsUp, clase: "text-estado-mora" },
};

export function EtiquetaPrioridad({ prioridad }: { prioridad: Prioridad }) {
  const { icono: Icono, clase } = ICONO_PRIORIDAD[prioridad];
  return (
    <span className="inline-flex items-center gap-1 text-xs whitespace-nowrap">
      <Icono className={cn("size-3.5", clase)} aria-hidden />
      {NOMBRE_PRIORIDAD[prioridad]}
    </span>
  );
}

const ICONO_ESTADO: Record<EstadoTarea, { icono: LucideIcon; clase: string }> = {
  por_hacer: { icono: Circle, clase: "text-muted-foreground" },
  en_curso: { icono: CircleDot, clase: "text-link" },
  en_revision: { icono: Eye, clase: "text-estado-alerta" },
  hecha: { icono: CircleCheck, clase: "text-estado-ok" },
  cancelada: { icono: CircleX, clase: "text-muted-foreground" },
};

export function EtiquetaEstado({ estado }: { estado: EstadoTarea }) {
  const { icono: Icono, clase } = ICONO_ESTADO[estado];
  return (
    <span className="inline-flex items-center gap-1 text-xs whitespace-nowrap">
      <Icono className={cn("size-3.5", clase)} aria-hidden />
      {NOMBRE_ESTADO[estado]}
    </span>
  );
}

const ICONO_SALUD: Record<Salud, { icono: LucideIcon; clase: string }> = {
  al_dia: { icono: CircleCheck, clase: "text-estado-ok" },
  en_riesgo: { icono: AlertTriangle, clase: "text-estado-alerta" },
  atrasado: { icono: CircleAlert, clase: "text-estado-mora" },
};

export function EtiquetaSalud({ salud }: { salud: Salud }) {
  const { icono: Icono, clase } = ICONO_SALUD[salud];
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap">
      <Icono className={cn("size-4", clase)} aria-hidden />
      {NOMBRE_SALUD[salud]}
    </span>
  );
}

/** Fecha límite, y "Vencida" en texto si corresponde. */
export function FechaLimite({ tarea, hoy }: { tarea: { estado: string; fecha_limite: string | null }; hoy: string }) {
  if (!tarea.fecha_limite) return null;
  const vencida = estaVencida(tarea, hoy);
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs whitespace-nowrap tabular-nums", vencida ? "font-medium text-estado-mora" : "text-muted-foreground")}>
      {vencida ? <CircleDashed className="size-3.5" aria-hidden /> : <CalendarDays className="size-3.5" aria-hidden />}
      {formatearFecha(tarea.fecha_limite)}
      {vencida && " · Vencida"}
    </span>
  );
}

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function AvatarPersona({ persona, className }: { persona: PersonaRef; className?: string }) {
  return (
    <Avatar className={cn("size-6", className)}>
      {persona.avatarUrl && <AvatarImage src={persona.avatarUrl} alt="" />}
      <AvatarFallback className="text-[10px]">{iniciales(persona.nombre)}</AvatarFallback>
    </Avatar>
  );
}

export function Persona({ persona, vacio = "Sin asignar" }: { persona: PersonaRef | null; vacio?: string }) {
  if (!persona) return <span className="text-xs text-muted-foreground">{vacio}</span>;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs">
      <AvatarPersona persona={persona} className="size-5" />
      <span className="truncate">{persona.nombre}</span>
    </span>
  );
}

/** Barra de avance con el número al lado. Sin tareas, solo el texto: no es 0 %. */
export function BarraAvance({ avance, className }: { avance: number | null; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      {avance !== null && (
        <span aria-hidden className="h-1.5 min-w-10 flex-1 overflow-hidden rounded-full bg-muted">
          <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round(avance * 100)}%` }} />
        </span>
      )}
      <span className={cn("text-xs whitespace-nowrap tabular-nums", avance === null && "text-muted-foreground")}>{textoAvance(avance)}</span>
    </span>
  );
}
