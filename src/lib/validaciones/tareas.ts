import { z } from "zod";
import { fechaOpcional, idValido, numeroOpcional, textoOpcional } from "./comun";

export const ESTADOS_TAREA = ["por_hacer", "en_curso", "en_revision", "hecha", "cancelada"] as const;
export type EstadoTarea = (typeof ESTADOS_TAREA)[number];

export const PRIORIDADES = ["baja", "media", "alta", "urgente"] as const;
export type Prioridad = (typeof PRIORIDADES)[number];

const camposTarea = {
  titulo: z.string().trim().min(2, "Escribí un título de 2 caracteres o más.").max(200, "Tiene que tener 200 caracteres o menos."),
  descripcion: textoOpcional(10000, "Tiene que tener 10000 caracteres o menos."),
  estado: z.enum(ESTADOS_TAREA, "Elegí un estado."),
  prioridad: z.enum(PRIORIDADES, "Elegí una prioridad."),
  asignado_id: idValido.nullable().optional(),
  fecha_inicio: fechaOpcional,
  fecha_limite: fechaOpcional,
  horas_estimadas: numeroOpcional(99_999),
};

const fechasEnOrden = (d: { fecha_inicio?: string | null; fecha_limite?: string | null }) =>
  !d.fecha_inicio || !d.fecha_limite || d.fecha_limite >= d.fecha_inicio;
const errorFechas = { path: ["fecha_limite"], message: "El límite no puede ser anterior al inicio." };

export const esquemaTarea = z.object({ proyecto_id: idValido, ...camposTarea }).refine(fechasEnOrden, errorFechas);
export type EntradaTarea = z.input<typeof esquemaTarea>;

/** Edición parcial: solo se toca lo que viene. Quien no es gestor manda estado y descripción. */
export const esquemaEdicionTarea = z.object(camposTarea).partial().refine(fechasEnOrden, errorFechas);
export type EntradaEdicionTarea = z.input<typeof esquemaEdicionTarea>;

export const esquemaMoverTarea = z.object({
  id: idValido,
  estado: z.enum(ESTADOS_TAREA, "Elegí un estado."),
  /** Sin posición, va al final de la columna. */
  posicion: z.number().finite().optional(),
});
export type EntradaMoverTarea = z.input<typeof esquemaMoverTarea>;

export const esquemaLoteTareas = z
  .object({
    ids: z.array(idValido).min(1, "Elegí al menos una tarea.").max(500, "Elegí 500 tareas o menos."),
    estado: z.enum(ESTADOS_TAREA).optional(),
    asignado_id: idValido.nullable().optional(),
  })
  .refine((d) => d.estado !== undefined || d.asignado_id !== undefined, "Elegí qué cambiar.");
export type EntradaLoteTareas = z.input<typeof esquemaLoteTareas>;
