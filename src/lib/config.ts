// Datos públicos de conexión a Supabase. Sin ellos la app no arranca: no hay modo demo
// (decisión 100). Para desarrollo salen de `npx supabase status` y van en .env.local.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const BUCKET_LOGOS = "logos";
export const BUCKET_ADJUNTOS = "adjuntos";

/**
 * Catálogo de componentes (/dev/componentes): en desarrollo, o con MOSTRAR_CATALOGO=1 para
 * verlo sobre un build. No lee datos. Nunca se habilita en un servidor de clientes.
 */
export function catalogoHabilitado() {
  return process.env.NODE_ENV !== "production" || process.env.MOSTRAR_CATALOGO === "1";
}

/** Días que algo eliminado queda en la papelera antes de poder borrarse del todo. */
export const DIAS_PAPELERA = 30;
