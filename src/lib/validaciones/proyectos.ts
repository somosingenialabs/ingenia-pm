import { z } from "zod";
import { fechaOpcional, idValido, numeroOpcional, textoOpcional } from "./comun";

export const ESTADOS_PROYECTO = ["planificado", "activo", "en_pausa", "terminado", "cancelado"] as const;
export type EstadoProyecto = (typeof ESTADOS_PROYECTO)[number];

export const NOMBRE_ESTADO_PROYECTO: Record<EstadoProyecto, string> = {
  planificado: "Planificado",
  activo: "Activo",
  en_pausa: "En pausa",
  terminado: "Terminado",
  cancelado: "Cancelado",
};

export const esquemaProyecto = z
  .object({
    nombre: z.string().trim().min(2, "Escribí un nombre de 2 caracteres o más.").max(120, "Tiene que tener 120 caracteres o menos."),
    descripcion: textoOpcional(5000, "Tiene que tener 5000 caracteres o menos."),
    cliente: textoOpcional(120, "Tiene que tener 120 caracteres o menos."),
    estado: z.enum(ESTADOS_PROYECTO, "Elegí un estado."),
    responsable_id: idValido,
    fecha_inicio: fechaOpcional,
    fecha_fin_objetivo: fechaOpcional,
    horas_presupuestadas: numeroOpcional(999_999),
  })
  .refine((d) => !d.fecha_inicio || !d.fecha_fin_objetivo || d.fecha_fin_objetivo >= d.fecha_inicio, {
    path: ["fecha_fin_objetivo"],
    message: "El objetivo no puede ser anterior al inicio.",
  });
export type EntradaProyecto = z.input<typeof esquemaProyecto>;
export type DatosProyecto = z.output<typeof esquemaProyecto>;

export const esquemaMiembroProyecto = z.object({ proyectoId: idValido, usuarioId: idValido });
