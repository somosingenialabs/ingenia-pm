import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { salir } from "@/lib/auth/acciones";

export const metadata: Metadata = { title: "Sin empresa activa" };

export default function SinEmpresaPage() {
  return (
    <div className="flex flex-col gap-6 text-center">
      <div className="space-y-1">
        <h1 className="texto-titulo-1">Sin empresa activa</h1>
        <p className="texto-subtitulo text-muted-foreground">
          Tu usuario no tiene una empresa activa. Pedile acceso a un administrador.
        </p>
      </div>
      <form action={salir} className="flex flex-col">
        <Button type="submit" size="lg">
          Salir
        </Button>
      </form>
    </div>
  );
}
