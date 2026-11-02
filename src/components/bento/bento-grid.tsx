import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Grilla Bento: 12 columnas en escritorio, 6 en tablet y 1 en
 * celular. Las tarjetas (BentoCard) definen cuánto ocupan con `tamano`.
 */
export function BentoGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid auto-rows-[minmax(8.5rem,auto)] grid-cols-1 gap-4 md:grid-cols-6 xl:grid-cols-12", className)}>
      {children}
    </div>
  );
}
