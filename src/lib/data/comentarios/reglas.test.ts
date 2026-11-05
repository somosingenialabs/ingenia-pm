import { describe, expect, it } from "vitest";
import type { ComentarioFila } from "./consultas";
import { aplicarEvento, aplicarFila, estaAbajo, fechaCompleta, pendientesVisibles, tiempoRelativo } from "./reglas";

const fila = (id: string, creado_en: string, parcial: Partial<ComentarioFila> = {}): ComentarioFila => ({
  id,
  tarea_id: "t",
  autor_id: "a",
  cuerpo: `Cuerpo ${id}`,
  creado_en,
  editado_en: null,
  eliminado_en: null,
  ...parcial,
});

describe("aplicarFila y aplicarEvento", () => {
  const lista = [fila("1", "2026-11-04T10:00:00Z"), fila("2", "2026-11-04T11:00:00Z")];

  it("el evento de un comentario que ya estaba lo reemplaza: no duplica", () => {
    const conPropio = aplicarFila(lista, fila("3", "2026-11-04T12:00:00Z"));
    const despues = aplicarEvento(conPropio, { eventType: "INSERT", new: fila("3", "2026-11-04T12:00:00Z", { cuerpo: "De la base" }), old: {} });
    expect(despues.map((c) => c.id)).toEqual(["1", "2", "3"]);
    expect(despues[2]!.cuerpo).toBe("De la base");
  });

  it("ordena por fecha, aunque el evento llegue desordenado", () => {
    const despues = aplicarEvento(lista, { eventType: "INSERT", new: fila("0", "2026-11-04T09:00:00Z"), old: {} });
    expect(despues.map((c) => c.id)).toEqual(["0", "1", "2"]);
  });

  it("edición y borrado lógico llegan como UPDATE", () => {
    const editada = aplicarEvento(lista, { eventType: "UPDATE", new: fila("1", "2026-11-04T10:00:00Z", { cuerpo: "Nuevo", editado_en: "2026-11-04T10:05:00Z" }), old: { id: "1" } });
    expect(editada[0]).toMatchObject({ cuerpo: "Nuevo", editado_en: "2026-11-04T10:05:00Z" });
    const borrada = aplicarEvento(editada, { eventType: "UPDATE", new: fila("1", "2026-11-04T10:00:00Z", { eliminado_en: "2026-11-04T10:06:00Z" }), old: { id: "1" } });
    expect(borrada).toHaveLength(2);
    expect(borrada[0]!.eliminado_en).not.toBeNull();
  });

  it("un DELETE real lo saca", () => {
    expect(aplicarEvento(lista, { eventType: "DELETE", new: {}, old: { id: "1" } }).map((c) => c.id)).toEqual(["2"]);
  });
});

describe("pendientesVisibles", () => {
  it("un provisorio confirmado deja de mostrarse como provisorio", () => {
    const pendientes = [
      { id: "3", cuerpo: "Hola", creado_en: "x", estado: "enviando" as const },
      { id: "4", cuerpo: "Chau", creado_en: "x", estado: "error" as const },
    ];
    expect(pendientesVisibles([fila("3", "2026-11-04T12:00:00Z")], pendientes).map((p) => p.id)).toEqual(["4"]);
  });
});

describe("tiempos", () => {
  const ahora = new Date("2026-11-04T15:00:00Z");

  it("relativo, en castellano", () => {
    expect(tiempoRelativo("2026-11-04T14:59:30Z", ahora)).toBe("recién");
    expect(tiempoRelativo("2026-11-04T14:55:00Z", ahora)).toBe("hace 5 minutos");
    expect(tiempoRelativo("2026-11-02T15:00:00Z", ahora)).toBe("hace 2 días");
  });

  it("la fecha completa va en la hora de Argentina", () => {
    // 02:30 UTC del 5 son las 23:30 del 4 en Argentina.
    expect(fechaCompleta("2026-11-05T02:30:00Z")).toBe("4 de noviembre de 2026, 23:30");
  });
});

describe("estaAbajo", () => {
  it("con margen: casi abajo cuenta como abajo", () => {
    expect(estaAbajo({ scrollTop: 560, clientHeight: 400, scrollHeight: 1000 })).toBe(true);
    expect(estaAbajo({ scrollTop: 100, clientHeight: 400, scrollHeight: 1000 })).toBe(false);
  });
});
