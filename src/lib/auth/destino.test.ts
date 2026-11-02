import { describe, expect, it } from "vitest";
import { destinoSeguro } from "./destino";

describe("destinoSeguro", () => {
  it("deja pasar rutas del sitio", () => {
    expect(destinoSeguro("/nueva-clave")).toBe("/nueva-clave");
    expect(destinoSeguro("/proyectos/1?tarea=2")).toBe("/proyectos/1?tarea=2");
  });

  it("sin destino, va al inicio", () => {
    expect(destinoSeguro(null)).toBe("/inicio");
    expect(destinoSeguro("")).toBe("/inicio");
  });

  it.each([
    "https://ejemplo.test",
    "//ejemplo.test",
    "///ejemplo.test",
    "/\\ejemplo.test",
    "\\\\ejemplo.test",
    "/\t/ejemplo.test",
    "/\n/ejemplo.test",
    "javascript:alert(1)",
    "ejemplo.test",
  ])("rechaza %j", (destino) => {
    expect(destinoSeguro(destino)).toBe("/inicio");
  });
});
