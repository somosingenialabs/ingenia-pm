import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";

let cliente: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Cliente de Supabase para componentes del navegador (uno por pestaña). */
export function crearClienteNavegador() {
  cliente ??= createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  return cliente;
}
