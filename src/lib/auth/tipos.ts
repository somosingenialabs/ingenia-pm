export const ROLES = ["admin", "pm", "colaborador"] as const;

export type Rol = (typeof ROLES)[number];

export type OrganizacionActiva = {
  id: string;
  nombre: string;
  zonaHoraria: string;
  logoUrl: string | null;
  colorAcento: string | null;
};

/** Quién hace el pedido y en qué empresa. Lo arma obtenerContexto() en el servidor. */
export type Contexto = {
  usuario: { id: string; email: string | null; nombre: string; avatarUrl: string | null };
  organizacion: OrganizacionActiva;
  rol: Rol;
};
