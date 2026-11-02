import { describe, expect, it } from "vitest";
import { esquemaToken } from "@/lib/validaciones/miembros";
import { estadoDeInvitacion, generarToken, hashDeToken } from "./invitacion";

describe("token", () => {
  it("no se repite y pasa el esquema del enlace", () => {
    const token = generarToken();
    expect(token).not.toBe(generarToken());
    expect(esquemaToken.safeParse(token).success).toBe(true);
  });
  it("un token adulterado no pasa o da otro hash", () => {
    const token = generarToken();
    expect(esquemaToken.safeParse(`${token}x`).success).toBe(false);
    const adulterado = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
    expect(hashDeToken(adulterado)).not.toBe(hashDeToken(token));
  });
  it("el hash no contiene el token", () => {
    const token = generarToken();
    expect(hashDeToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDeToken(token)).not.toContain(token);
  });
});

describe("estadoDeInvitacion", () => {
  const ahora = new Date("2026-11-03T12:00:00Z");
  const base = { vence_en: "2026-11-04T12:00:00Z", aceptada_en: null, revocada_en: null };

  it("vigente, vencida, revocada y usada", () => {
    expect(estadoDeInvitacion(base, ahora)).toBe("vigente");
    expect(estadoDeInvitacion({ ...base, vence_en: "2026-11-03T12:00:00Z" }, ahora)).toBe("vencida");
    expect(estadoDeInvitacion({ ...base, revocada_en: "2026-11-02T00:00:00Z" }, ahora)).toBe("revocada");
    expect(estadoDeInvitacion({ ...base, aceptada_en: "2026-11-02T00:00:00Z" }, ahora)).toBe("usada");
  });
});
