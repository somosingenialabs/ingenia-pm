"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const PESTANAS = [
  { href: "/configuracion/perfil", titulo: "Perfil", soloAdmin: false },
  { href: "/configuracion/miembros", titulo: "Miembros", soloAdmin: true },
  { href: "/configuracion/organizacion", titulo: "Empresa", soloAdmin: true },
];

export function NavegacionConfiguracion({ esAdmin }: { esAdmin: boolean }) {
  const pathname = usePathname();
  const visibles = PESTANAS.filter((p) => esAdmin || !p.soloAdmin);
  return (
    <nav aria-label="Secciones de configuración" className="flex gap-0.5 rounded-xl bg-secondary p-0.5 sm:w-fit">
      {visibles.map((p) => {
        const activa = pathname === p.href;
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={activa ? "page" : undefined}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center rounded-[10px] px-4 text-sm font-medium whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring",
              activa ? "border bg-card text-foreground" : "text-muted-foreground",
            )}
          >
            {p.titulo}
          </Link>
        );
      })}
    </nav>
  );
}
