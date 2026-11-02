import { describe, expect, it } from "vitest";
import { esquemaOrganizacion } from "./configuracion";
import { esquemaCuentaNueva, esquemaHoras, esquemaInvitar } from "./miembros";
import { esquemaProyecto } from "./proyectos";
import { esquemaEdicionTarea, esquemaLoteTareas, esquemaMoverTarea, esquemaTarea } from "./tareas";

const ID = "00000000-0000-4000-a000-000000000002";

describe("esquemaProyecto", () => {
  const base = { nombre: "Línea 2", estado: "activo", responsable_id: ID };

  it("vacío se guarda como null", () => {
    const datos = esquemaProyecto.parse({ ...base, cliente: "  ", fecha_inicio: "", horas_presupuestadas: "" });
    expect(datos.cliente).toBeNull();
    expect(datos.fecha_inicio).toBeNull();
    expect(datos.horas_presupuestadas).toBeNull();
  });
  it("el número del formulario llega como texto", () => {
    expect(esquemaProyecto.parse({ ...base, horas_presupuestadas: "12.5" }).horas_presupuestadas).toBe(12.5);
  });
  it("rechaza nombre corto, estado inventado y fechas al revés", () => {
    expect(esquemaProyecto.safeParse({ ...base, nombre: "x" }).success).toBe(false);
    expect(esquemaProyecto.safeParse({ ...base, estado: "otro" }).success).toBe(false);
    const fechas = esquemaProyecto.safeParse({ ...base, fecha_inicio: "2026-11-03", fecha_fin_objetivo: "2026-11-02" });
    expect(fechas.success).toBe(false);
    expect(fechas.error?.issues[0]?.path).toEqual(["fecha_fin_objetivo"]);
  });
  it("rechaza una fecha que no existe", () => {
    expect(esquemaProyecto.safeParse({ ...base, fecha_inicio: "2026-02-31" }).success).toBe(false);
  });
});

describe("esquemaTarea", () => {
  it("pide proyecto y título", () => {
    expect(esquemaTarea.safeParse({ proyecto_id: ID, titulo: "Cablear", estado: "por_hacer", prioridad: "alta" }).success).toBe(true);
    expect(esquemaTarea.safeParse({ titulo: "Cablear", estado: "por_hacer", prioridad: "alta" }).success).toBe(false);
  });
});

describe("esquemaEdicionTarea", () => {
  // Un campo que no vino no se toca: si se volviera null, un colaborador borraría las fechas.
  it("lo que no viene sigue sin venir", () => {
    const datos = esquemaEdicionTarea.parse({ estado: "hecha", descripcion: "Listo" });
    const presentes = Object.entries(datos).filter(([, v]) => v !== undefined);
    expect(Object.fromEntries(presentes)).toEqual({ estado: "hecha", descripcion: "Listo" });
  });
  it("vaciar un campo sí lo vuelve null", () => {
    const datos = esquemaEdicionTarea.parse({ fecha_limite: "", horas_estimadas: "", descripcion: "" });
    expect(datos).toMatchObject({ fecha_limite: null, horas_estimadas: null, descripcion: null });
  });
  it("rechaza horas negativas y fechas al revés", () => {
    expect(esquemaEdicionTarea.safeParse({ horas_estimadas: "-1" }).success).toBe(false);
    expect(esquemaEdicionTarea.safeParse({ fecha_inicio: "2026-11-03", fecha_limite: "2026-11-02" }).success).toBe(false);
  });
});

describe("esquemaMoverTarea", () => {
  it("la posición es opcional, pero tiene que ser un número finito", () => {
    expect(esquemaMoverTarea.safeParse({ id: ID, estado: "hecha" }).success).toBe(true);
    expect(esquemaMoverTarea.safeParse({ id: ID, estado: "hecha", posicion: 1500.5 }).success).toBe(true);
    expect(esquemaMoverTarea.safeParse({ id: ID, estado: "hecha", posicion: Infinity }).success).toBe(false);
    expect(esquemaMoverTarea.safeParse({ id: "no-es-un-id", estado: "hecha" }).success).toBe(false);
  });
});

describe("esquemaLoteTareas", () => {
  it("pide alguna tarea y algo que cambiar", () => {
    expect(esquemaLoteTareas.safeParse({ ids: [ID], estado: "hecha" }).success).toBe(true);
    expect(esquemaLoteTareas.safeParse({ ids: [ID], asignado_id: null }).success).toBe(true);
    expect(esquemaLoteTareas.safeParse({ ids: [ID] }).success).toBe(false);
    expect(esquemaLoteTareas.safeParse({ ids: [], estado: "hecha" }).success).toBe(false);
  });
});

describe("miembros", () => {
  it("el mail se normaliza como lo exige la tabla", () => {
    expect(esquemaInvitar.parse({ email: "  Alguien@Prueba.Test ", rol: "pm" }).email).toBe("alguien@prueba.test");
    expect(esquemaInvitar.safeParse({ email: "no-es-mail", rol: "pm" }).success).toBe(false);
    expect(esquemaInvitar.safeParse({ email: "a@prueba.test", rol: "propietario" }).success).toBe(false);
  });
  it("la cuenta nueva pide 10 caracteres y que coincidan", () => {
    const base = { nombre: "Ana Paz", clave: "una-clave-larga", repetida: "una-clave-larga" };
    expect(esquemaCuentaNueva.safeParse(base).success).toBe(true);
    expect(esquemaCuentaNueva.safeParse({ ...base, clave: "corta", repetida: "corta" }).success).toBe(false);
    expect(esquemaCuentaNueva.safeParse({ ...base, repetida: "otra-clave-larga" }).success).toBe(false);
  });
  it("las horas semanales van de 0 a 80", () => {
    expect(esquemaHoras.parse({ usuarioId: ID, horas: "37.5" }).horas).toBe(37.5);
    expect(esquemaHoras.safeParse({ usuarioId: ID, horas: "81" }).success).toBe(false);
  });
});

describe("esquemaOrganizacion", () => {
  const base = { nombre: "Empresa", zona_horaria: "America/Argentina/Buenos_Aires", color_acento: null };

  it("acepta los datos normales", () => {
    expect(esquemaOrganizacion.safeParse(base).success).toBe(true);
    expect(esquemaOrganizacion.safeParse({ ...base, color_acento: "#0062CC" }).success).toBe(true);
  });
  it("rechaza una zona que no existe: rompería el cálculo de hoy", () => {
    expect(esquemaOrganizacion.safeParse({ ...base, zona_horaria: "Marte/Olympus" }).success).toBe(false);
  });
  it("rechaza un acento que no llega a AA", () => {
    expect(esquemaOrganizacion.safeParse({ ...base, color_acento: "#FFFF00" }).success).toBe(false);
    expect(esquemaOrganizacion.safeParse({ ...base, color_acento: "azul" }).success).toBe(false);
  });
});
