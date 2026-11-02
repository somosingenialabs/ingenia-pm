import type { Metadata } from "next";
import { FormularioRecuperar } from "./formulario-recuperar";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default async function RecuperarPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1 text-center">
        <h1 className="texto-titulo-1">Recuperar contraseña</h1>
        <p className="texto-subtitulo text-muted-foreground">Te mandamos un enlace para definir una nueva.</p>
      </div>
      {error === "enlace" && (
        <p role="alert" className="text-center text-sm text-destructive">
          Ese enlace venció o ya se usó. Pedí uno nuevo.
        </p>
      )}
      <FormularioRecuperar />
    </div>
  );
}
