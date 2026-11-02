import { describe, expect, it } from "vitest";
import { mensajeDeError } from "./mensaje-de-error";

describe("mensajeDeError", () => {
  it("traduce los errores de Postgres, que no son instancias de Error", () => {
    expect(mensajeDeError({ message: "new row violates row-level security policy for table \"tareas\"" })).toBe(
      "No tenés permiso para hacer esto.",
    );
    expect(mensajeDeError({ message: "Esa dependencia arma un ciclo entre tareas." })).toMatch(/ciclo/);
    expect(mensajeDeError({ message: "La persona asignada no es miembro del proyecto." })).toMatch(/Sumala/);
    expect(mensajeDeError({ message: "La empresa no puede quedarse sin un Admin activo." })).toMatch(/Admin activo/);
  });
  it("nunca muestra el detalle crudo", () => {
    const crudo = 'column "x" of relation "tareas" does not exist';
    expect(mensajeDeError({ message: crudo })).not.toContain("relation");
  });
});
