import type { Rol } from "./tipos";

// Reglas de la interfaz: qué botones mostrar a cada rol. Son espejo del RLS
// (arquitectura, sección 2); si no coinciden, manda la base.

/** Nombre del rol para mostrar en pantalla. */
export const NOMBRE_ROL: Record<Rol, string> = {
  admin: "Admin",
  pm: "PM",
  colaborador: "Colaborador",
};

export function puedeCrearProyecto(rol: Rol): boolean {
  return rol === "admin" || rol === "pm";
}

/** Gestor de un proyecto: Admin, o PM que es miembro. Edita el proyecto, sus miembros, tareas y dependencias. */
export function puedeGestionarProyecto(rol: Rol, esMiembro: boolean): boolean {
  return rol === "admin" || (rol === "pm" && esMiembro);
}

/** Editar título, fechas, prioridad y asignado. Quien no es gestor solo cambia estado, posición y descripción de su tarea. */
export function puedeEditarCamposTarea(rol: Rol, esMiembro: boolean): boolean {
  return puedeGestionarProyecto(rol, esMiembro);
}

/** Miembros, invitaciones y datos de la empresa. */
export function puedeConfigurar(rol: Rol): boolean {
  return rol === "admin";
}

/** Métricas de todas las personas. Si no, solo las propias. */
export function veMetricasDeEquipo(rol: Rol): boolean {
  return rol === "admin" || rol === "pm";
}
