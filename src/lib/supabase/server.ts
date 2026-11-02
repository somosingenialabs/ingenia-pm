import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";

/** Cliente con la sesión de quien hace el pedido (lee las cookies). Respeta el RLS. */
export async function crearClienteServidor() {
  const cookieStore = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Desde un Server Component no se pueden escribir cookies; el proxy ya renueva la sesión.
        }
      },
    },
  });
}

/**
 * Cliente con la clave secreta: saltea el RLS y puede crear usuarios en Auth.
 * Solo para el servidor y siempre después de verificar el rol de quien llama (obtenerContexto).
 */
export function crearClienteAdmin() {
  const clave = process.env.SUPABASE_SECRET_KEY;
  if (!clave) throw new Error("Falta SUPABASE_SECRET_KEY en .env.local.");
  return createClient<Database>(SUPABASE_URL, clave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
