"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** Vuelve a pedir la pantalla. La tarjeta se arma en el servidor y no puede pasar una función. */
export function ReintentarTarjeta() {
  const router = useRouter();
  return (
    <Button size="sm" variant="outline" onClick={() => router.refresh()}>
      <RefreshCw aria-hidden /> Reintentar
    </Button>
  );
}
