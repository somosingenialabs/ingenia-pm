import { createHash, randomBytes } from "node:crypto";

// Solo servidor (node:crypto). Fuera de acciones.ts porque un archivo "use server" solo exporta acciones.

export function generarToken(): string {
  return randomBytes(32).toString("base64url");
}

/** En la base queda este hash: quien lea la tabla no puede armar un enlace válido. */
export function hashDeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type EstadoInvitacion = "vigente" | "vencida" | "revocada" | "usada";

export function estadoDeInvitacion(
  invitacion: { vence_en: string; aceptada_en: string | null; revocada_en: string | null },
  ahora: Date = new Date(),
): EstadoInvitacion {
  if (invitacion.revocada_en) return "revocada";
  if (invitacion.aceptada_en) return "usada";
  return new Date(invitacion.vence_en) <= ahora ? "vencida" : "vigente";
}

export const MENSAJE_INVITACION: Record<Exclude<EstadoInvitacion, "vigente"> | "invalida", string> = {
  invalida: "Este enlace no es válido. Revisá que esté completo o pedí uno nuevo.",
  vencida: "Este enlace venció. Pedile uno nuevo a quien te invitó.",
  revocada: "Esta invitación se canceló. Pedile una nueva a quien te invitó.",
  usada: "Esta invitación ya se usó. Si es tuya, ingresá con tu mail y contraseña.",
};
