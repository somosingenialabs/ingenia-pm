import { NextResponse, type NextRequest } from "next/server";
import { destinoSeguro } from "@/lib/auth/destino";
import { crearClienteServidor } from "@/lib/supabase/server";

/** Canjea el `code` del enlace del mail por una sesión y redirige dentro del sitio. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const url = request.nextUrl.clone();
  url.search = "";

  if (code) {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const destino = new URL(destinoSeguro(request.nextUrl.searchParams.get("next")), url);
      return NextResponse.redirect(destino);
    }
  }

  url.pathname = "/recuperar";
  url.searchParams.set("error", "enlace");
  return NextResponse.redirect(url);
}
