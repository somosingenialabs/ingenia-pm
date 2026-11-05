import { z } from "zod";
import { idValido } from "./comun";

const cuerpo = z.string().trim().min(1, "Escribí algo antes de enviar.").max(5000, "Tiene que tener 5000 caracteres o menos.");

/** El id lo genera el navegador: así el evento de Realtime reemplaza al comentario provisorio. */
export const esquemaComentario = z.object({ id: idValido, tarea_id: idValido, cuerpo });
export const esquemaEdicionComentario = z.object({ id: idValido, cuerpo });
