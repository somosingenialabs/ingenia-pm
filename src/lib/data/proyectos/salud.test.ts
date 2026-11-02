import { describe, expect, it } from "vitest";
import { calcularAvance, calcularSalud, textoAvance, UMBRALES_SALUD } from "./salud";

const HOY = "2026-11-03";
const abierto = { estado: "activo", fecha_fin_objetivo: null };
const tarea = (estado: string, prioridad = "media", fecha_limite: string | null = null) => ({ estado, prioridad, fecha_limite });
const hechas = (n: number) => Array.from({ length: n }, () => tarea("hecha"));
const pendientes = (n: number) => Array.from({ length: n }, () => tarea("en_curso"));

describe("calcularAvance", () => {
  it("hechas sobre no canceladas", () => {
    expect(calcularAvance([tarea("hecha"), tarea("en_curso"), tarea("cancelada")])).toBe(0.5);
  });
  it("sin tareas o solo canceladas no es 0 %: es Sin tareas", () => {
    expect(calcularAvance([])).toBeNull();
    expect(calcularAvance([tarea("cancelada")])).toBeNull();
    expect(textoAvance(null)).toBe("Sin tareas");
    expect(textoAvance(0)).toBe("0 %");
    expect(textoAvance(2 / 3)).toBe("67 %");
  });
});

describe("calcularSalud", () => {
  it("los umbrales son los del plan", () => {
    expect(UMBRALES_SALUD).toEqual({ diasAlObjetivo: 7, avanceMinimo: 0.8 });
  });

  it("Atrasado: objetivo pasado y proyecto abierto", () => {
    expect(calcularSalud({ estado: "activo", fecha_fin_objetivo: "2026-11-02" }, hechas(1), HOY)).toBe("atrasado");
    expect(calcularSalud({ estado: "en_pausa", fecha_fin_objetivo: "2026-11-02" }, [], HOY)).toBe("atrasado");
  });
  it("Atrasado: tarea urgente vencida", () => {
    expect(calcularSalud(abierto, [tarea("en_curso", "urgente", "2026-11-02")], HOY)).toBe("atrasado");
  });
  it("una urgente que vence hoy o ya está cerrada no atrasa", () => {
    expect(calcularSalud(abierto, [tarea("en_curso", "urgente", HOY)], HOY)).toBe("al_dia");
    expect(calcularSalud(abierto, [tarea("hecha", "urgente", "2026-11-02")], HOY)).toBe("al_dia");
  });

  it("En riesgo: alguna tarea vencida", () => {
    expect(calcularSalud(abierto, [tarea("en_curso", "alta", "2026-11-02")], HOY)).toBe("en_riesgo");
  });
  it("En riesgo: a menos de 7 días con avance menor a 80 %", () => {
    const cerca = { estado: "activo", fecha_fin_objetivo: "2026-11-09" }; // 6 días
    expect(calcularSalud(cerca, [...hechas(3), ...pendientes(1)], HOY)).toBe("en_riesgo");
    expect(calcularSalud(cerca, [], HOY)).toBe("en_riesgo");
  });
  it("el objetivo de hoy todavía no pasó, pero está cerca", () => {
    expect(calcularSalud({ estado: "activo", fecha_fin_objetivo: HOY }, pendientes(1), HOY)).toBe("en_riesgo");
  });

  it("Al día: justo en los límites", () => {
    const cerca = { estado: "activo", fecha_fin_objetivo: "2026-11-09" };
    const a7dias = { estado: "activo", fecha_fin_objetivo: "2026-11-10" };
    expect(calcularSalud(cerca, [...hechas(4), ...pendientes(1)], HOY)).toBe("al_dia"); // 80 %
    expect(calcularSalud(a7dias, pendientes(1), HOY)).toBe("al_dia");
    expect(calcularSalud(abierto, [], HOY)).toBe("al_dia");
  });

  it("un proyecto cerrado no se atrasa", () => {
    expect(calcularSalud({ estado: "terminado", fecha_fin_objetivo: "2026-01-01" }, [], HOY)).toBe("al_dia");
    expect(calcularSalud({ estado: "cancelado", fecha_fin_objetivo: "2026-01-01" }, pendientes(1), HOY)).toBe("al_dia");
  });
});
