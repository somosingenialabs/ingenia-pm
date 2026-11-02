import type { Metadata } from "next";
import Link from "next/link";
import { EstadoVacio } from "@/components/estado/estado-vacio";
import { Button } from "@/components/ui/button";
import { salir } from "@/lib/auth/acciones";
import { NOMBRE_ROL } from "@/lib/auth/permisos";
import type { Rol } from "@/lib/auth/tipos";
import { estadoDeInvitacion, hashDeToken, MENSAJE_INVITACION } from "@/lib/data/miembros/invitacion";
import { crearClienteAdmin, crearClienteServidor } from "@/lib/supabase/server";
import { esquemaToken } from "@/lib/validaciones/miembros";
import { FormularioInvitacion } from "./formulario-invitacion";

// El enlace es una credencial: que no quede en buscadores.
export const metadata: Metadata = { title: "Invitación", robots: { index: false, follow: false } };

function SinInvitacion({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex flex-col gap-4">
      <EstadoVacio titulo="No podemos usar este enlace" texto={mensaje} />
      <Button size="lg" variant="outline" asChild>
        <Link href="/ingresar">Ir a ingresar</Link>
      </Button>
    </div>
  );
}

/**
 * Pública: quien la abre todavía no es miembro. Solo se muestra algo si el hash del token coincide
 * con una invitación. La aceptación vuelve a validar todo en el servidor.
 */
export default async function InvitacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenOk = esquemaToken.safeParse(token);
  if (!tokenOk.success) return <SinInvitacion mensaje={MENSAJE_INVITACION.invalida} />;

  const { data, error } = await crearClienteAdmin().rpc("invitacion_por_token", { p_token_hash: hashDeToken(tokenOk.data) });
  if (error) throw error;
  const invitacion = data?.[0];
  if (!invitacion) return <SinInvitacion mensaje={MENSAJE_INVITACION.invalida} />;

  const estado = estadoDeInvitacion(invitacion);
  if (estado !== "vigente") return <SinInvitacion mensaje={MENSAJE_INVITACION[estado]} />;

  const {
    data: { user },
  } = await (await crearClienteServidor()).auth.getUser();
  const sesionPropia = user?.email?.toLowerCase() === invitacion.email;

  const encabezado = (
    <div className="space-y-1 text-center">
      <h1 className="texto-titulo-1">Sumate a {invitacion.organizacion_nombre}</h1>
      <p className="texto-subtitulo text-muted-foreground">
        Te invitaron como {NOMBRE_ROL[invitacion.rol as Rol]} con el mail {invitacion.email}.
      </p>
    </div>
  );

  if (user && !sesionPropia) {
    return (
      <div className="flex flex-col gap-6">
        {encabezado}
        <p className="text-center text-sm">
          Ahora estás con {user.email}. Salí de esa sesión y volvé a abrir este enlace.
        </p>
        <form action={salir} className="flex flex-col">
          <Button type="submit" size="lg">
            Salir
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {encabezado}
      <FormularioInvitacion token={tokenOk.data} modo={sesionPropia ? "sesion" : invitacion.usuario_existe ? "existente" : "nueva"} email={invitacion.email} />
    </div>
  );
}
