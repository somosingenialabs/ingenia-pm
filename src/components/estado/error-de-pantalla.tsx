"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { PantallaEstado } from "@/components/estado/pantalla-estado";
import { Button } from "@/components/ui/button";

type Props = {
  error: unknown;
  retry: () => void;
};

/** Cuerpo de los `error.tsx`: qué pasó, reintentar y volver al inicio. */
export function ErrorDePantalla({ error, retry }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PantallaEstado
      icono={<TriangleAlert />}
      titulo="Algo falló al mostrar esta pantalla"
      texto="Probá de nuevo. Si sigue pasando, volvé al inicio y avisá a soporte."
    >
      <Button size="lg" className="w-full" onClick={() => retry()}>
        <RefreshCw /> Reintentar
      </Button>
      <Button size="lg" variant="secondary" className="w-full" asChild>
        <Link href="/inicio">Volver al inicio</Link>
      </Button>
    </PantallaEstado>
  );
}
