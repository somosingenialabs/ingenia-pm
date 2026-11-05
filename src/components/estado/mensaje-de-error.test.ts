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
  it("traduce los errores de dependencias y comentarios de la fase 4", () => {
    expect(mensajeDeError({ message: 'duplicate key value violates unique constraint "tarea_dependencias_pkey"' })).toBe("Esa dependencia ya existe.");
    expect(mensajeDeError({ message: "Las dos tareas de una dependencia tienen que ser del mismo proyecto." })).toMatch(/mismo proyecto/);
    expect(mensajeDeError({ message: 'new row for relation "tarea_dependencias" violates check constraint "tarea_dependencias_check"' })).toMatch(/sí misma/);
    expect(mensajeDeError({ message: "Un comentario eliminado no se puede editar." })).toMatch(/se borró/);
    expect(mensajeDeError({ message: "No podés borrar este comentario." })).toBe("No podés borrar este comentario.");
    expect(mensajeDeError({ message: "El comentario no existe." })).toMatch(/ya no existe/);
  });
  it("nunca muestra el detalle crudo", () => {
    const crudo = 'column "x" of relation "tareas" does not exist';
    expect(mensajeDeError({ message: crudo })).not.toContain("relation");
  });
});
