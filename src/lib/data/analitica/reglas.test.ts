import { describe, expect, it } from "vitest";
import {
  agruparHorasPorProyecto,
  CLAVE_OTROS,
  consumoSobreAvance,
  diasEntre,
  hayDatosSuficientes,
  resolverPeriodo,
  semanasDelPeriodo,
  textoDuracionLarga,
  textoInsuficiente,
  textoPrecision,
  variacion,
  type FilaHoras,
} from "./reglas";

// Viernes.
const HOY = "2026-11-06";

describe("resolverPeriodo", () => {
  it("12 semanas por defecto: del lunes de hace 11 semanas a hoy, y el anterior del mismo largo", () => {
    expect(resolverPeriodo({}, HOY)).toEqual({
      clave: "12",
      desde: "2026-08-17",
      hasta: HOY,
      anteriorDesde: "2026-05-27",
      anteriorHasta: "2026-08-16",
      dias: 82,
    });
  });

  it("4 y 26 semanas arrancan un lunes", () => {
    expect(resolverPeriodo({ periodo: "4" }, HOY).desde).toBe("2026-10-12");
    expect(resolverPeriodo({ periodo: "26" }, HOY).desde).toBe("2026-05-11");
  });

  it("a medida respeta las fechas, y el anterior termina el día antes", () => {
    const p = resolverPeriodo({ periodo: "medida", desde: "2026-10-01", hasta: "2026-10-10" }, HOY);
    expect(p).toMatchObject({ clave: "medida", desde: "2026-10-01", hasta: "2026-10-10", dias: 10, anteriorDesde: "2026-09-21", anteriorHasta: "2026-09-30" });
  });

  it.each([
    ["sin fechas", {}],
    ["al revés", { desde: "2026-10-10", hasta: "2026-10-01" }],
    ["futuro", { desde: "2026-11-01", hasta: "2026-11-07" }],
    ["fecha imposible", { desde: "2026-02-31", hasta: "2026-03-05" }],
    ["más de 370 días", { desde: "2025-01-01", hasta: "2026-11-01" }],
  ])("a medida inválido (%s) vuelve a 12 semanas", (_caso, fechas) => {
    expect(resolverPeriodo({ periodo: "medida", ...fechas }, HOY).clave).toBe("12");
  });

  it("un período raro en la URL vuelve a 12 semanas", () => {
    expect(resolverPeriodo({ periodo: "99" }, HOY).clave).toBe("12");
  });

  it("diasEntre cuenta los dos extremos", () => {
    expect(diasEntre(HOY, HOY)).toBe(1);
    expect(diasEntre("2026-02-27", "2026-03-01")).toBe(3);
  });
});

describe("mínimos y textos", () => {
  it("con menos de 5 datos no se muestra el número", () => {
    expect(hayDatosSuficientes(4)).toBe(false);
    expect(hayDatosSuficientes(5)).toBe(true);
    expect(textoInsuficiente(3)).toBe("Todavía no hay datos suficientes (3 de 5).");
  });

  it("variación contra el período anterior, sin base no hay", () => {
    expect(variacion(12, 10)).toBeCloseTo(0.2);
    expect(variacion(5, 10)).toBeCloseTo(-0.5);
    expect(variacion(3, 0)).toBeNull();
  });

  it("precisión en palabras", () => {
    expect(textoPrecision(1.27)).toBe("Tardamos 1,3 veces lo estimado");
    expect(textoPrecision(0.8)).toBe("Tardamos 0,8 veces lo estimado");
    expect(textoPrecision(1.02)).toBe("Tardamos lo estimado");
  });

  it("duraciones largas en días y horas", () => {
    expect(textoDuracionLarga(16.4)).toBe("16 h");
    expect(textoDuracionLarga(72)).toBe("3 d");
    expect(textoDuracionLarga(456.01)).toBe("19 d");
    expect(textoDuracionLarga(100)).toBe("4 d 4 h");
  });

  it("presupuesto: se marca si el consumo pasa al avance por más de 20 puntos", () => {
    expect(consumoSobreAvance(85.9, 58.8)).toBe(true);
    expect(consumoSobreAvance(57.7, 85.1)).toBe(false);
    expect(consumoSobreAvance(70, 50)).toBe(false);
    expect(consumoSobreAvance(null, 10)).toBe(false);
  });
});

describe("agruparHorasPorProyecto", () => {
  const semanas = ["2026-10-26", "2026-11-02"];
  const fila = (periodo: string, proyecto: string, horas: number): FilaHoras => ({ periodo, proyecto_id: proyecto, usuario_id: "u", horas, n: 1 });
  const nombres = new Map(["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => [id, `Proyecto ${id.toUpperCase()}`]));

  it("hasta 6 proyectos por horas, el resto en Otros, y todas las semanas aunque estén vacías", () => {
    const filas = [
      ...["a", "b", "c", "d", "e", "f", "g", "h"].map((id, i) => fila("2026-11-02", id, 10 - i)),
      fila("2026-11-02", "a", 2), // varias filas del mismo proyecto (otra persona) se suman
    ];
    const { series, semanas: porSemana } = agruparHorasPorProyecto(filas, nombres, semanas);
    expect(series.map((s) => [s.clave, s.total])).toEqual([
      ["a", 12], ["b", 9], ["c", 8], ["d", 7], ["e", 6], ["f", 5], [CLAVE_OTROS, 7],
    ]);
    expect(series.at(-1)!.nombre).toBe("Otros (2)");
    expect(porSemana[0]).toEqual({ semana: "2026-10-26", valores: {}, total: 0 });
    expect(porSemana[1]!.valores[CLAVE_OTROS]).toBe(7);
    expect(porSemana[1]!.total).toBe(54);
  });

  it("sin Otros si entran todos; empate de horas por nombre", () => {
    const { series } = agruparHorasPorProyecto([fila("2026-10-26", "b", 3), fila("2026-10-26", "a", 3)], nombres, semanas);
    expect(series.map((s) => s.clave)).toEqual(["a", "b"]);
  });

  it("semanas del período: desde el lunes de la primera", () => {
    expect(semanasDelPeriodo({ desde: "2026-10-28", hasta: HOY })).toEqual(["2026-10-26", "2026-11-02"]);
  });
});
