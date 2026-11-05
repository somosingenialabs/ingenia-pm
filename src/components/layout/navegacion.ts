import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  ChartColumn,
  CircleCheck,
  Clock,
  FolderKanban,
  House,
  Settings,
  Users,
} from "lucide-react";

export type Seccion = {
  href: string;
  titulo: string;
  icono: LucideIcon;
  /** Va en la barra inferior del celular (máximo 4; la quinta pestaña es "Más"). */
  enBarraInferior?: boolean;
  /** Abajo en la barra lateral (Configuración). */
  alPie?: boolean;
};

export const SECCIONES: readonly Seccion[] = [
  { href: "/inicio", titulo: "Inicio", icono: House, enBarraInferior: true },
  { href: "/proyectos", titulo: "Proyectos", icono: FolderKanban, enBarraInferior: true },
  { href: "/mis-tareas", titulo: "Mis tareas", icono: CircleCheck },
  { href: "/calendario", titulo: "Calendario", icono: CalendarDays, enBarraInferior: true },
  { href: "/carga", titulo: "Carga", icono: Users },
  { href: "/horas", titulo: "Horas", icono: Clock, enBarraInferior: true },
  { href: "/analitica", titulo: "Analítica", icono: ChartColumn },
  { href: "/configuracion", titulo: "Configuración", icono: Settings, alPie: true },
];

/** Entradas que todavía no tienen pantalla. Cada fase saca de acá las suyas. */
const SIN_PANTALLA: readonly string[] = ["/analitica"];

export function seccionesVisibles(): Seccion[] {
  return SECCIONES.filter((s) => !SIN_PANTALLA.includes(s.href));
}

export function esSeccionActiva(href: string, pathname: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
