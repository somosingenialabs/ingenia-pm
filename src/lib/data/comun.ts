import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Piezas comunes de los contratos de datos. Se agregan cosas, no se cambian.
 *
 * - `consultas.ts` lee. Recibe el cliente de Supabase como primer parámetro: la misma función
 *   sirve en un Server Component y en un hook de TanStack Query. En los dos casos rige el RLS.
 * - `acciones.ts` escribe. Son Server Actions: validan con Zod y devuelven un `Resultado`, sin
 *   tirar excepciones para errores esperables.
 */
export type ClienteSupabase = SupabaseClient<Database>;

/** Respuesta de una Server Action. `campos` trae el error de cada campo del formulario. */
export type Resultado<T = void> =
  | { ok: true; datos: T }
  | { ok: false; error: string; campos?: Record<string, string> };

/** Referencia corta para combos, chips y tarjetas. */
export type Ref = { id: string; nombre: string };

export type PersonaRef = { id: string; nombre: string; avatarUrl: string | null };
