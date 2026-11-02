import type { Rol } from "@/lib/auth/tipos";
import type { ClienteSupabase, PersonaRef } from "@/lib/data/comun";
import { aPersona, SELECT_PERSONA, type PerfilCrudo } from "@/lib/data/proyectos/consultas";

export type MiembroFila = PersonaRef & {
  email: string | null;
  rol: Rol;
  activo: boolean;
  horasSemanales: number;
};

export type InvitacionPendiente = { id: string; email: string; rol: Rol; venceEn: string };

/**
 * El RLS de `miembros` deja ver todas las empresas de las que uno es miembro: por eso esta
 * consulta pide la empresa, a diferencia de las de proyectos y tareas. Sin el filtro, quien está
 * en dos empresas vería mezclada a la gente de las dos.
 */
export async function listarMiembros(db: ClienteSupabase, organizacionId: string): Promise<MiembroFila[]> {
  const { data, error } = await db
    .from("miembros")
    .select(`rol, activo, horas_semanales, ${SELECT_PERSONA.replace("avatar_url", "avatar_url, email")}`)
    .eq("organizacion_id", organizacionId);
  if (error) throw error;

  type Cruda = { rol: Rol; activo: boolean; horas_semanales: number; perfil: (PerfilCrudo & { email: string | null }) | null };
  return (data as unknown as Cruda[])
    .flatMap((m) => {
      const persona = aPersona(m.perfil);
      return persona ? [{ ...persona, email: m.perfil!.email, rol: m.rol, activo: m.activo, horasSemanales: m.horas_semanales }] : [];
    })
    .sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre));
}

/** Pendientes y sin vencer. Nunca se lee token_hash: no hace falta y no sale del servidor. */
export async function listarInvitacionesPendientes(db: ClienteSupabase, organizacionId: string): Promise<InvitacionPendiente[]> {
  const { data, error } = await db
    .from("invitaciones")
    .select("id, email, rol, vence_en")
    .eq("organizacion_id", organizacionId)
    .is("aceptada_en", null)
    .is("revocada_en", null)
    .gt("vence_en", new Date().toISOString())
    .order("creado_en", { ascending: false });
  if (error) throw error;
  return data.map((i) => ({ id: i.id, email: i.email, rol: i.rol as Rol, venceEn: i.vence_en }));
}
