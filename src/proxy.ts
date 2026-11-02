import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";

// Next.js 16: "proxy" reemplaza a "middleware".
// Renueva la sesión de Supabase en cada pedido y, sin sesión, manda a /ingresar.
// Es un control de navegación; la protección real de los datos es el RLS de la base.

const PUBLICAS = ["/ingresar", "/recuperar", "/nueva-clave", "/invitacion", "/auth"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({ request });
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const publica = PUBLICAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (user || publica) {
    // Con sesión, la pantalla de ingreso no tiene sentido.
    if (user && pathname === "/ingresar") {
      const url = request.nextUrl.clone();
      url.pathname = "/inicio";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return response;
  }

  const url = request.nextUrl.clone();
  url.pathname = "/ingresar";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Sin sesión también tienen que cargar el manifiesto, el service worker y los íconos.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
