import type { Metadata } from "next";
import { FormularioIngreso } from "./formulario-ingreso";

export const metadata: Metadata = { title: "Ingresar" };

export default function IngresarPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1 text-center">
        <h1 className="texto-titulo-1">Ingresar</h1>
        <p className="texto-subtitulo text-muted-foreground">Entrá con tu mail y tu contraseña.</p>
      </div>
      <FormularioIngreso />
    </div>
  );
}
