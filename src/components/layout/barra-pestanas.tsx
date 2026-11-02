"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { esSeccionActiva, seccionesVisibles } from "./navegacion";

// Apple HIG: en el celular la navegación principal es una barra de pestañas abajo, a
// pulgar, con 5 lugares como máximo. Lo que sobra va en "Más". Desde "md", barra lateral.
export function BarraPestanas() {
  const pathname = usePathname();
  const [masAbierto, setMasAbierto] = useState(false);
  const secciones = seccionesVisibles();
  const principales = secciones.filter((s) => s.enBarraInferior);
  const secundarias = secciones.filter((s) => !s.enBarraInferior);
  const masActivo = secundarias.some((s) => esSeccionActiva(s.href, pathname));

  const clase = (activo: boolean) =>
    cn(
      "flex min-h-[49px] w-full flex-col items-center justify-center gap-0.5 pt-1 text-[10px] font-medium active:opacity-60",
      activo ? "text-link" : "text-muted-foreground",
    );

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className="material-regular fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="mx-auto flex max-w-lg">
          {principales.map(({ href, titulo, icono: Icono }) => {
            const activo = esSeccionActiva(href, pathname);
            return (
              <li key={href} className="flex-1">
                <Link href={href} aria-current={activo ? "page" : undefined} className={clase(activo)}>
                  <Icono className="size-6" strokeWidth={activo ? 2.25 : 1.75} aria-hidden />
                  {titulo}
                </Link>
              </li>
            );
          })}
          {secundarias.length > 0 && (
            <li className="flex-1">
              <button type="button" onClick={() => setMasAbierto(true)} aria-haspopup="dialog" className={clase(masActivo)}>
                <Ellipsis className="size-6" strokeWidth={masActivo ? 2.25 : 1.75} aria-hidden />
                Más
              </button>
            </li>
          )}
        </ul>
      </nav>

      <Sheet open={masAbierto} onOpenChange={setMasAbierto}>
        <SheetContent side="bottom" className="gap-0 rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+12px)] md:hidden">
          <div className="mx-auto mt-2 h-1.5 w-9 rounded-full bg-muted-foreground/40" aria-hidden />
          <SheetTitle className="px-5 pt-3 text-[20px] font-bold">Más</SheetTitle>
          <SheetDescription className="sr-only">Otras secciones.</SheetDescription>
          <ul className="mt-2 divide-y px-2">
            {secundarias.map(({ href, titulo, icono: Icono }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setMasAbierto(false)}
                  className="flex min-h-14 items-center gap-3 rounded-xl px-3 text-[17px] active:bg-accent"
                >
                  <Icono className="size-6 text-link" aria-hidden />
                  {titulo}
                </Link>
              </li>
            ))}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
