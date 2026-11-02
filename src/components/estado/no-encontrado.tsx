import Link from "next/link";
import { SearchX } from "lucide-react";
import { PantallaEstado } from "@/components/estado/pantalla-estado";
import { Button } from "@/components/ui/button";

/** Página o registro que no existe (o que es de otra empresa: para el RLS es lo mismo). */
export function NoEncontrado() {
  return (
    <PantallaEstado
      icono={<SearchX />}
      titulo="No encontramos esa página"
      texto="Puede que el enlace esté viejo o que lo que buscás ya no exista."
    >
      <Button size="lg" className="w-full" asChild>
        <Link href="/inicio">Ir al inicio</Link>
      </Button>
    </PantallaEstado>
  );
}
