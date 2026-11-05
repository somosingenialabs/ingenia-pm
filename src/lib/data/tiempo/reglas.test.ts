import { describe, expect, it } from "vitest";
import {
  armarSemana,
  duracionParaCampo,
  minutosAlDetener,
  parsearDuracion,
  textoCronometro,
  textoDuracion,
  type RegistroSemana,
} from "./reglas";

describe("parsearDuracion", () => {
  it.each([
    ["1:30", 90],
    ["0:05", 5],
    ["1.5", 90],
    ["1,5", 90],
    ["0.25", 15],
    ["2", 120],
    ["2h", 120],
    ["2 hs", 120],
    ["90m", 90],
    ["90 min", 90],
    ["1h30", 90],
    ["1h 30m", 90],
    ["  45M ", 45],
    ["24", 1440],
    ["24:00", 1440],
  ])("%s son %i minutos", (texto, minutos) => {
    expect(parsearDuracion(texto)).toBe(minutos);
  });

  it.each(["", "abc", "1:60", "1:5", "-1", "0", "0:00", "25", "24:01", "1441m", "1h75", "1.5.2", "1:30:00"])(
    "%s no se acepta",
    (texto) => {
      expect(parsearDuracion(texto)).toBeNull();
    },
  );
});

describe("textos", () => {
  it("duración legible", () => {
    expect(textoDuracion(45)).toBe("45 min");
    expect(textoDuracion(120)).toBe("2 h");
    expect(textoDuracion(90)).toBe("1 h 30 min");
  });
  it("duración para el campo", () => {
    expect(duracionParaCampo(90)).toBe("1:30");
    expect(duracionParaCampo(5)).toBe("0:05");
  });
  it("cronómetro", () => {
    expect(textoCronometro(309)).toBe("0:05:09");
    expect(textoCronometro(43200)).toBe("12:00:00");
    expect(textoCronometro(-3)).toBe("0:00:00");
  });
});

describe("minutosAlDetener", () => {
  const inicio = "2026-11-05T12:00:00.000Z";
  it("redondea como la base, con mínimo 1", () => {
    expect(minutosAlDetener(inicio, Date.parse("2026-11-05T12:00:10Z"))).toBe(1);
    expect(minutosAlDetener(inicio, Date.parse("2026-11-05T12:29:31Z"))).toBe(30);
    expect(minutosAlDetener(inicio, Date.parse("2026-11-05T13:30:00Z"))).toBe(90);
  });
});

describe("armarSemana", () => {
  const lunes = "2026-11-02";
  const r = (tareaId: string, fecha: string, minutos: number | null, proyecto = "Obra"): RegistroSemana => ({
    tareaId,
    tareaTitulo: `Tarea ${tareaId}`,
    proyectoNombre: proyecto,
    fecha,
    minutos,
  });

  it("suma por tarea y por día, sin el temporizador corriendo", () => {
    const semana = armarSemana(
      [r("b", "2026-11-02", 60), r("b", "2026-11-02", 30), r("a", "2026-11-04", 120), r("a", "2026-11-04", null), r("c", "2026-11-08", 15, "Aaa")],
      lunes,
    );
    expect(semana.dias).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
    // Ordenadas por proyecto y título.
    expect(semana.filas.map((f) => f.tareaId)).toEqual(["c", "a", "b"]);
    expect(semana.filas.find((f) => f.tareaId === "b")!.dias).toEqual([90, 0, 0, 0, 0, 0, 0]);
    expect(semana.filas.find((f) => f.tareaId === "a")!.total).toBe(120);
    expect(semana.totalesPorDia).toEqual([90, 0, 120, 0, 0, 0, 15]);
    expect(semana.total).toBe(225);
    expect(semana.diasLargos).toEqual([]);
  });

  it("ignora lo que cae fuera de la semana", () => {
    expect(armarSemana([r("a", "2026-11-09", 60), r("a", "2026-11-01", 60)], lunes).total).toBe(0);
  });

  it("marca los días de más de 12 h, no los de 12 justas", () => {
    const semana = armarSemana([r("a", "2026-11-02", 720), r("a", "2026-11-03", 600), r("b", "2026-11-03", 121)], lunes);
    expect(semana.diasLargos).toEqual(["2026-11-03"]);
  });
});
