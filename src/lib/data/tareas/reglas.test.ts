import { describe, expect, it } from "vitest";
import { calcularPosicion, estadoSiguiente, estaVencida, grupoDeTarea, ordenarPorPosicion, posicionAlSoltar } from "./reglas";

describe("calcularPosicion", () => {
  it("punto medio entre vecinas", () => {
    expect(calcularPosicion(1000, 2000)).toBe(1500);
    expect(calcularPosicion(1000, 1001)).toBe(1000.5);
  });
  it("al final, última + 1000", () => {
    expect(calcularPosicion(3000, null)).toBe(4000);
  });
  it("al principio, primera - 1000", () => {
    expect(calcularPosicion(null, 1000)).toBe(0);
  });
  it("en una columna vacía, 1000", () => {
    expect(calcularPosicion(null, null)).toBe(1000);
  });
});

describe("posicionAlSoltar", () => {
  const columna = [
    { id: "a", posicion: 1000 },
    { id: "b", posicion: 2000 },
    { id: "c", posicion: 3000 },
  ];

  it("desde otra columna, queda antes de la tarea sobre la que se suelta", () => {
    expect(posicionAlSoltar(columna, "x", "b")).toBe(1500);
    expect(posicionAlSoltar(columna, "x", "a")).toBe(0);
  });
  it("desde otra columna, sobre la columna, va al final", () => {
    expect(posicionAlSoltar(columna, "x", null)).toBe(4000);
    expect(posicionAlSoltar([], "x", null)).toBe(1000);
  });
  it("en la misma columna, bajar deja la tarea después", () => {
    expect(posicionAlSoltar(columna, "a", "b")).toBe(2500);
    expect(posicionAlSoltar(columna, "a", "c")).toBe(4000);
  });
  it("en la misma columna, subir deja la tarea antes", () => {
    expect(posicionAlSoltar(columna, "c", "b")).toBe(1500);
    expect(posicionAlSoltar(columna, "c", "a")).toBe(0);
  });
  it("si queda donde estaba, no hay nada que guardar", () => {
    expect(posicionAlSoltar(columna, "b", "b")).toBeNull();
    expect(posicionAlSoltar(columna, "c", null)).toBeNull();
  });
});

describe("ordenarPorPosicion", () => {
  it("desempata por id, para que el orden sea estable", () => {
    const ordenadas = ordenarPorPosicion([
      { id: "b", posicion: 1 },
      { id: "a", posicion: 1 },
      { id: "c", posicion: 0 },
    ]);
    expect(ordenadas.map((t) => t.id)).toEqual(["c", "a", "b"]);
  });
});

describe("vencimiento y grupos", () => {
  const hoy = "2026-11-03";

  it("una tarea cerrada nunca está vencida", () => {
    expect(estaVencida({ estado: "en_curso", fecha_limite: "2026-11-02" }, hoy)).toBe(true);
    expect(estaVencida({ estado: "hecha", fecha_limite: "2026-11-02" }, hoy)).toBe(false);
    expect(estaVencida({ estado: "cancelada", fecha_limite: "2026-11-02" }, hoy)).toBe(false);
  });
  it("vence hoy no es vencida", () => {
    expect(estaVencida({ estado: "en_curso", fecha_limite: hoy }, hoy)).toBe(false);
  });
  it("agrupa en Vencidas, Hoy, Próximas y Sin fecha", () => {
    expect(grupoDeTarea({ estado: "por_hacer", fecha_limite: "2026-11-02" }, hoy)).toBe("vencidas");
    expect(grupoDeTarea({ estado: "por_hacer", fecha_limite: hoy }, hoy)).toBe("hoy");
    expect(grupoDeTarea({ estado: "por_hacer", fecha_limite: "2026-11-04" }, hoy)).toBe("proximas");
    expect(grupoDeTarea({ estado: "por_hacer", fecha_limite: null }, hoy)).toBe("sin_fecha");
  });
});

describe("estadoSiguiente", () => {
  it("avanza hasta Hecha y ahí termina", () => {
    expect(estadoSiguiente("por_hacer")?.estado).toBe("en_curso");
    expect(estadoSiguiente("en_curso")?.estado).toBe("en_revision");
    expect(estadoSiguiente("en_revision")?.estado).toBe("hecha");
    expect(estadoSiguiente("hecha")).toBeNull();
    expect(estadoSiguiente("cancelada")).toBeNull();
  });
});
