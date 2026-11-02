import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { obtenerUsuario } from "@/lib/auth/sesion";
import { FormularioNuevaClave } from "./formulario-nueva-clave";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default async function NuevaClavePage() {
  const usuario = await obtenerUsuario();
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1 text-center">
        <h1 className="texto-titulo-1">Nueva contraseña</h1>
        <p className="texto-subtitulo text-muted-foreground">
          {usuario ? "Elegí una de 10 caracteres o más." : "Este enlace venció o ya se usó."}
        </p>
      </div>
      {usuario ? (
        <FormularioNuevaClave />
      ) : (
        <Button size="lg" asChild>
          <Link href="/recuperar">Pedir un enlace nuevo</Link>
        </Button>
      )}
    </div>
  );
}
