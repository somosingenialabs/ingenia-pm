import { describe, expect, it } from "vitest";
import {
  puedeConfigurar,
  puedeCrearProyecto,
  puedeEditarCamposTarea,
  puedeGestionarProyecto,
  veMetricasDeEquipo,
} from "./permisos";
import { ROLES } from "./tipos";

// Espejo de la sección 2 de docs/arquitectura.md. Si cambia una regla del RLS, cambia acá.

describe("permisos por rol", () => {
  it("crean proyectos Admin y PM", () => {
    expect(ROLES.filter(puedeCrearProyecto)).toEqual(["admin", "pm"]);
  });

  it.each([puedeGestionarProyecto, puedeEditarCamposTarea])("%o: Admin siempre, PM donde es miembro, Colaborador nunca", (regla) => {
    expect(regla("admin", false)).toBe(true);
    expect(regla("admin", true)).toBe(true);
    expect(regla("pm", true)).toBe(true);
    expect(regla("pm", false)).toBe(false);
    expect(regla("colaborador", true)).toBe(false);
    expect(regla("colaborador", false)).toBe(false);
  });

  it("configura solo Admin", () => {
    expect(ROLES.filter(puedeConfigurar)).toEqual(["admin"]);
  });

  it("el Colaborador ve solo sus métricas", () => {
    expect(ROLES.filter(veMetricasDeEquipo)).toEqual(["admin", "pm"]);
  });
});
