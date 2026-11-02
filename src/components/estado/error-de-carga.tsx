"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { esSesionVencida, mensajeDeError } from "./mensaje-de-error";

type Props = {
  /** Qué no se pudo cargar, en una frase: "No pudimos cargar los proyectos". */
  titulo: string;
  error: unknown;
  onReintentar: () => void;
  className?: string;
};

/** Error de carga de una pantalla o de un bloque: frase clara, "Reintentar" y, si venció la sesión, ir al ingreso. */
export function ErrorDeCarga({ titulo, error, onReintentar, className }: Props) {
  useEffect(() => {
    console.error(titulo, error);
  }, [titulo, error]);

  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center gap-3 py-8 text-center text-sm", className)}
    >
      <p className="font-medium">{titulo}</p>
      <p className="text-muted-foreground">{mensajeDeError(error)}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="outline" onClick={onReintentar}>
          <RefreshCw /> Reintentar
        </Button>
        {esSesionVencida(error) && (
          <Button asChild>
            <Link href="/ingresar">Ingresar de nuevo</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
