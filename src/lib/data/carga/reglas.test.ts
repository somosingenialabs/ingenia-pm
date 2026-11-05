import { describe, expect, it } from "vitest";
import {
  armarGrilla,
  lunesDe,
  nivelDeCarga,
  proporcion,
  semanasDesde,
  textoHoras,
  textoHorasSobreCapacidad,
  textoSemana,
  textoSemanaCorto,
  UMBRALES_CARGA,
} from "./reglas";

describe("umbrales de carga", () => {
  it("son los de la fase: 70 % y 100 %", () => {
    expect(UMBRALES_CARGA).toEqual({ normalDesde: 0.7, sobrecargaDesde: 1 });
  });

  it("Libre por debajo del 70 %, Normal hasta el 100 % inclusive, Sobrecargada por encima", () => {
    expect(nivelDeCarga(0, 40)).toBe("libre");
    expect(nivelDeCarga(27.9, 40)).toBe("libre");
    expect(nivelDeCarga(28, 40)).toBe("normal");
    expect(nivelDeCarga(40, 40)).toBe("normal");
    expect(nivelDeCarga(40.1, 40)).toBe("sobrecargada");
  });

  it("sin capacidad, cualquier hora es de más y no hay porcentaje", () => {
    expect(proporcion(5, 0)).toBeNull();
    expect(nivelDeCarga(5, 0)).toBe("sobrecargada");
    expect(nivelDeCarga(0, 0)).toBe("libre");
  });
});

describe("semanas", () => {
  it("el lunes de cualquier día, también un domingo", () => {
    expect(lunesDe("2026-11-04")).toBe("2026-11-02");
    expect(lunesDe("2026-11-08")).toBe("2026-11-02");
    expect(lunesDe("2026-11-09")).toBe("2026-11-09");
  });

  it("8 semanas seguidas, cruzando el año", () => {
    const semanas = semanasDesde("2026-12-14");
    expect(semanas).toHaveLength(8);
    expect(semanas[3]).toBe("2027-01-04");
  });

  it("textos sin rayas largas", () => {
    expect(textoSemana("2026-11-02")).toBe("2 nov al 8 nov");
    expect(textoHoras(13.5)).toBe("13,5 h");
    expect(textoHoras(40)).toBe("40 h");
    expect(textoSemanaCorto("2026-11-02")).toBe("2 al 8 nov");
    expect(textoSemanaCorto("2026-11-30")).toBe("30 nov al 6 dic");
    expect(textoHorasSobreCapacidad(5.75, 40)).toBe("5,8 / 40 h");
  });
});

describe("armarGrilla", () => {
  const semanas = ["2026-11-02", "2026-11-09"];
  const personas = [
    { id: "b", nombre: "Beatriz", avatarUrl: null },
    { id: "a", nombre: "Ana", avatarUrl: null },
  ];
  const fila = (usuario_id: string, semana: string, horas: number) => ({
    usuario_id,
    semana,
    horas_asignadas: horas,
    horas_atrasadas: semana === "2026-11-02" && usuario_id === "a" ? 4 : 0,
    capacidad: 40,
    tareas_sin_estimar: usuario_id === "a" ? 3 : 0,
    tareas_sin_fecha: usuario_id === "a" ? 2 : 0,
  });

  it("una fila por persona, ordenada por nombre, con las semanas en orden", () => {
    const grilla = armarGrilla([fila("b", "2026-11-09", 10), fila("a", "2026-11-02", 44), fila("b", "2026-11-02", 30), fila("a", "2026-11-09", 0)], personas, semanas);
    expect(grilla.map((p) => p.persona.nombre)).toEqual(["Ana", "Beatriz"]);
    expect(grilla[0]).toMatchObject({ sinEstimar: 3, sinFecha: 2 });
    expect(grilla[0]!.semanas.map((s) => [s.semana, s.horas, s.nivel])).toEqual([
      ["2026-11-02", 44, "sobrecargada"],
      ["2026-11-09", 0, "libre"],
    ]);
    expect(grilla[1]!.semanas.map((s) => s.nivel)).toEqual(["normal", "libre"]);
    // Las atrasadas ya están dentro de las horas: no se suman dos veces.
    expect(grilla[0]!.semanas.map((s) => s.atrasadas)).toEqual([4, 0]);
  });

  it("los números que llegan como texto (numeric de Postgres) se convierten", () => {
    const grilla = armarGrilla([{ ...fila("a", "2026-11-02", 0), horas_asignadas: "12.50" as unknown as number, capacidad: "40.0" as unknown as number }], personas, ["2026-11-02"]);
    expect(grilla[0]!.semanas[0]).toMatchObject({ horas: 12.5, capacidad: 40 });
  });
});
