import { describe, expect, it } from "vitest";
import { diasLaborales, esFechaDeBase, fechaDesdeBase, fechaParaBase, formatearFecha, hoyEnZona, sumarDias } from "./fechas";

describe("fechaDesdeBase", () => {
  it("construye la fecha local, sin correrse de día", () => {
    const fecha = fechaDesdeBase("2026-11-03");
    expect([fecha.getFullYear(), fecha.getMonth(), fecha.getDate()]).toEqual([2026, 10, 3]);
    expect(fecha.getHours()).toBe(0);
  });

  it("ida y vuelta da lo mismo", () => {
    expect(fechaParaBase(fechaDesdeBase("2026-01-01"))).toBe("2026-01-01");
    expect(formatearFecha("2026-11-03")).toBe("3 nov");
  });
});

describe("esFechaDeBase", () => {
  it("acepta fechas reales y rechaza el resto", () => {
    expect(esFechaDeBase("2026-02-28")).toBe(true);
    expect(esFechaDeBase("2026-02-31")).toBe(false);
    expect(esFechaDeBase("03/11/2026")).toBe(false);
  });
});

describe("hoyEnZona", () => {
  it("a la noche en Argentina sigue siendo hoy, aunque en UTC ya sea mañana", () => {
    const ahora = new Date("2026-11-04T01:30:00Z");
    expect(hoyEnZona("America/Argentina/Buenos_Aires", ahora)).toBe("2026-11-03");
    expect(hoyEnZona("UTC", ahora)).toBe("2026-11-04");
  });
});

describe("sumarDias", () => {
  it("cruza meses", () => {
    expect(sumarDias("2026-11-30", 1)).toBe("2026-12-01");
    expect(sumarDias("2026-11-01", -1)).toBe("2026-10-31");
  });
});

describe("diasLaborales", () => {
  const semana = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"];

  it("de lunes a viernes, sin importar el día de la semana", () => {
    expect(diasLaborales("2026-11-02")).toEqual(semana);
    expect(diasLaborales("2026-11-06")).toEqual(semana);
  });

  it("el fin de semana mira la semana que viene", () => {
    const siguiente = semana.map((d) => sumarDias(d, 7));
    expect(diasLaborales("2026-11-07")).toEqual(siguiente);
    expect(diasLaborales("2026-11-08")).toEqual(siguiente);
  });
});
