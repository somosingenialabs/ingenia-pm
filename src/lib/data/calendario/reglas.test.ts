import { describe, expect, it } from "vitest";
import { fechaParaBase } from "@/lib/fechas";
import {
  armarEventos,
  colorDeProyecto,
  COLORES_PROYECTO,
  fechasDesdeRango,
  fechasTrasArrastre,
  rangoDiaCompleto,
  rangoVisible,
  relacionadas,
  textoConflicto,
  type DatosCalendario,
  type TareaCalendario,
} from "./reglas";

describe("zona de los tests", () => {
  it("corre en Argentina (UTC-3), como pide la fase", () => {
    expect(new Date(2026, 10, 4).getTimezoneOffset()).toBe(180);
  });
});

describe("rangoDiaCompleto", () => {
  it("termina a las 00:00 del día siguiente al límite (fin exclusivo)", () => {
    const { start, end } = rangoDiaCompleto("2026-11-03", "2026-11-05");
    expect(fechaParaBase(start)).toBe("2026-11-03");
    expect(fechaParaBase(end)).toBe("2026-11-06");
    expect([end.getHours(), end.getMinutes()]).toEqual([0, 0]);
  });

  it("un solo día dura 24 h", () => {
    const { start, end } = rangoDiaCompleto("2026-11-30", "2026-11-30");
    expect(fechaParaBase(end)).toBe("2026-12-01");
    expect(end.getTime() - start.getTime()).toBe(24 * 3600 * 1000);
  });
});

describe("fechasDesdeRango", () => {
  it("ida y vuelta da las mismas fechas", () => {
    const { start, end } = rangoDiaCompleto("2026-12-30", "2027-01-02");
    expect(fechasDesdeRango(start, end)).toEqual({ inicio: "2026-12-30", limite: "2027-01-02" });
  });

  it("cerca de la medianoche no se corre de día", () => {
    // 23:59 del 3 en Argentina ya es el 4 en UTC: tiene que seguir siendo el 3.
    const casiMedianoche = new Date(2026, 10, 3, 23, 59);
    expect(casiMedianoche.toISOString().slice(0, 10)).toBe("2026-11-04");
    expect(fechasDesdeRango(casiMedianoche, casiMedianoche)).toEqual({ inicio: "2026-11-03", limite: "2026-11-03" });
    // Y 00:00 del 4 como fin exclusivo es el 3.
    expect(fechasDesdeRango(new Date(2026, 10, 3), new Date(2026, 10, 4))).toEqual({ inicio: "2026-11-03", limite: "2026-11-03" });
  });

  it("nunca deja el límite antes del inicio", () => {
    expect(fechasDesdeRango(new Date(2026, 10, 3), new Date(2026, 10, 3))).toEqual({ inicio: "2026-11-03", limite: "2026-11-03" });
  });
});

describe("fechasTrasArrastre", () => {
  const conInicio = { fechaInicio: "2026-11-02", fechaLimite: "2026-11-06" };
  const sinInicio = { fechaInicio: null, fechaLimite: "2026-11-06" };
  const dia = (d: number) => new Date(2026, 10, d);

  it("Plazos: cambia solo el límite", () => {
    expect(fechasTrasArrastre(conInicio, "plazos", "move", dia(9), dia(10))).toEqual({ fecha_limite: "2026-11-09" });
  });

  it("Plazos: si el inicio queda después del límite, lo corre los mismos días", () => {
    expect(fechasTrasArrastre(conInicio, "plazos", "move", dia(1), dia(2))).toEqual({ fecha_inicio: "2026-10-28", fecha_limite: "2026-11-01" });
  });

  it("Plazos: soltar en el mismo día no guarda nada", () => {
    expect(fechasTrasArrastre(conInicio, "plazos", "move", dia(6), dia(7))).toBeNull();
  });

  it("Duración: mover desplaza las dos fechas", () => {
    expect(fechasTrasArrastre(conInicio, "duracion", "move", dia(9), dia(14))).toEqual({ fecha_inicio: "2026-11-09", fecha_limite: "2026-11-13" });
  });

  it("Duración: estirar cambia el límite", () => {
    expect(fechasTrasArrastre(conInicio, "duracion", "resize", dia(2), dia(11))).toEqual({ fecha_inicio: "2026-11-02", fecha_limite: "2026-11-10" });
  });

  it("Duración sin inicio: mover sigue sin inicio; estirar le pone uno", () => {
    expect(fechasTrasArrastre(sinInicio, "duracion", "move", dia(10), dia(11))).toEqual({ fecha_limite: "2026-11-10" });
    expect(fechasTrasArrastre(sinInicio, "duracion", "resize", dia(4), dia(7))).toEqual({ fecha_inicio: "2026-11-04", fecha_limite: "2026-11-06" });
  });
});

describe("rangoVisible", () => {
  it("Mes: semanas completas de lunes a domingo", () => {
    // Noviembre de 2026 arranca un domingo: la grilla empieza el lunes 26 de octubre.
    expect(rangoVisible("month", new Date(2026, 10, 15))).toEqual({ desde: "2026-10-26", hasta: "2026-12-06" });
  });

  it("Semana: de lunes a domingo, también un domingo", () => {
    expect(rangoVisible("week", new Date(2026, 10, 8))).toEqual({ desde: "2026-11-02", hasta: "2026-11-08" });
  });

  it("Agenda: 30 días desde la fecha", () => {
    expect(rangoVisible("agenda", new Date(2026, 10, 4))).toEqual({ desde: "2026-11-04", hasta: "2026-12-03" });
  });
});

describe("armarEventos", () => {
  const tarea = (parcial: Partial<TareaCalendario>): TareaCalendario => ({
    id: "t1",
    titulo: "Tarea",
    proyectoId: "p1",
    proyectoNombre: "Proyecto",
    estado: "por_hacer",
    prioridad: "media",
    asignadoNombre: null,
    fechaInicio: "2026-11-02",
    fechaLimite: "2026-11-04",
    ...parcial,
  });
  const datos: DatosCalendario = {
    tareas: [tarea({}), tarea({ id: "t2", titulo: "Sucesora", proyectoId: "p2", fechaInicio: "2026-11-03", fechaLimite: "2026-11-10" })],
    objetivos: [{ proyectoId: "p1", nombre: "Proyecto", fecha: "2026-11-20" }],
    dependencias: [{ tareaId: "t2", dependeDeId: "t1", desfaseDias: 0 }],
    conflictos: [{ tareaId: "t2", dependeDeId: "t1", debeArrancarDesde: "2026-11-04", arrancaEl: "2026-11-03" }],
    titulos: { t1: "Tarea", t2: "Sucesora" },
  };
  const opciones = { hoy: "2026-11-05", gestionados: new Set(["p1"]) };

  it("Plazos: un día, el del límite", () => {
    const [, t1] = armarEventos(datos, { ...opciones, modo: "plazos" });
    expect(fechaParaBase(t1!.start)).toBe("2026-11-04");
    expect(fechaParaBase(t1!.end)).toBe("2026-11-05");
  });

  it("Duración: de inicio a límite", () => {
    const [, t1] = armarEventos(datos, { ...opciones, modo: "duracion" });
    expect(fechaParaBase(t1!.start)).toBe("2026-11-02");
    expect(fechaParaBase(t1!.end)).toBe("2026-11-05");
  });

  it("marca vencida, conflicto y quién puede moverla", () => {
    const [objetivo, t1, t2] = armarEventos(datos, { ...opciones, modo: "plazos" });
    expect(objetivo).toMatchObject({ tipo: "objetivo", movible: false });
    expect(t1).toMatchObject({ vencida: true, conflictos: [], movible: true });
    expect(t2).toMatchObject({ vencida: false, conflictos: ["Tarea"], movible: false });
  });

  it("una tarea hecha no queda vencida", () => {
    const [, t1] = armarEventos({ ...datos, tareas: [tarea({ estado: "hecha" })] }, { ...opciones, modo: "plazos" });
    expect(t1!.vencida).toBe(false);
  });
});

describe("relacionadas y textoConflicto", () => {
  const deps = [
    { tareaId: "b", dependeDeId: "a", desfaseDias: 0 },
    { tareaId: "c", dependeDeId: "b", desfaseDias: 2 },
  ];

  it("encuentra predecesoras y sucesoras directas", () => {
    expect(relacionadas(deps, "b")).toEqual({ predecesoras: ["a"], sucesoras: ["c"] });
    expect(relacionadas(deps, "a")).toEqual({ predecesoras: [], sucesoras: ["b"] });
  });

  it("el aviso depende de qué tarea se movió", () => {
    const titulos = { a: "Comprar", b: "Montar" };
    expect(textoConflicto("b", { tareaId: "b", dependeDeId: "a" }, titulos)).toBe("Esta tarea arranca antes de que termine «Comprar».");
    expect(textoConflicto("a", { tareaId: "b", dependeDeId: "a" }, titulos)).toBe("«Montar» arranca antes de que termine esta tarea.");
  });
});

describe("colorDeProyecto", () => {
  it("cada proyecto por su orden, y vuelve a empezar", () => {
    const orden = ["a", "b", "c", "d", "e"];
    expect(colorDeProyecto("a", orden)).toBe(COLORES_PROYECTO[0]);
    expect(colorDeProyecto("e", orden)).toBe(COLORES_PROYECTO[0]);
    expect(colorDeProyecto("x", orden)).toBe(COLORES_PROYECTO[0]);
  });
});
