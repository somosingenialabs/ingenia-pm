"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * react-big-calendar pesa mucho y solo anda en el navegador: se carga aparte, sin render en el
 * servidor, para que no entre en el paquete de ninguna otra pantalla.
 */
export const CargadorCalendario = dynamic(() => import("@/components/calendario/calendario").then((m) => m.Calendario), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando calendario">
      <Skeleton className="h-11" />
      <Skeleton className="h-11 w-64" />
      <Skeleton className="h-[480px] rounded-[14px] md:h-[640px]" />
    </div>
  ),
});
