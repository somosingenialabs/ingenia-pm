import { differenceInSeconds, format, formatDistanceStrict } from "date-fns";
import { es } from "date-fns/locale";
import type { ComentarioFila } from "./consultas";

// Reglas puras de comentarios: sin base ni React.

export function ordenarComentarios(lista: readonly ComentarioFila[]): ComentarioFila[] {
  return [...lista].sort((a, b) => a.creado_en.localeCompare(b.creado_en) || a.id.localeCompare(b.id));
}

/**
 * Suma una fila que vino de la base (evento de Realtime o respuesta de la acción). Si el id ya
 * estaba, la reemplaza: así el comentario optimista y su evento nunca quedan duplicados.
 */
export function aplicarFila(lista: readonly ComentarioFila[], fila: ComentarioFila): ComentarioFila[] {
  const sin = lista.filter((c) => c.id !== fila.id);
  return ordenarComentarios([...sin, fila]);
}

/** Un evento de Realtime sobre la lista en caché. El borrado lógico llega como UPDATE. */
export function aplicarEvento(
  lista: readonly ComentarioFila[],
  evento: { eventType: "INSERT" | "UPDATE" | "DELETE"; new: Partial<ComentarioFila>; old: Partial<ComentarioFila> },
): ComentarioFila[] {
  if (evento.eventType === "DELETE") return lista.filter((c) => c.id !== evento.old.id);
  return aplicarFila(lista, evento.new as ComentarioFila);
}

export type Pendiente = { id: string; cuerpo: string; creado_en: string; estado: "enviando" | "error"; error?: string };

/** Los provisorios que la base todavía no confirmó, al final. Uno confirmado deja de mostrarse como provisorio. */
export function pendientesVisibles(lista: readonly ComentarioFila[], pendientes: readonly Pendiente[]): Pendiente[] {
  const confirmados = new Set(lista.map((c) => c.id));
  return pendientes.filter((p) => !confirmados.has(p.id));
}

/** "recién", "hace 5 minutos", "hace 2 días". */
export function tiempoRelativo(fecha: string, ahora: Date = new Date()): string {
  const momento = new Date(fecha);
  if (differenceInSeconds(ahora, momento) < 60) return "recién";
  return `hace ${formatDistanceStrict(momento, ahora, { locale: es })}`;
}

/** Fecha completa para el globo: "4 de noviembre de 2026, 15:42". */
export function fechaCompleta(fecha: string): string {
  return format(new Date(fecha), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es });
}

/** ¿La lista está abajo de todo? Con un margen, para no exigir el último píxel. */
export function estaAbajo({ scrollTop, clientHeight, scrollHeight }: { scrollTop: number; clientHeight: number; scrollHeight: number }, margen = 48): boolean {
  return scrollHeight - scrollTop - clientHeight <= margen;
}
