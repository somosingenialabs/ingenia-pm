"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: ReactNode }) {
  // Lo que se lee desde el navegador: el panel de una tarea y la búsqueda de la paleta.
  const [clienteConsultas] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1 } } }));
  return (
    <QueryClientProvider client={clienteConsultas}>
      {/* Claro, oscuro o sistema: se elige en el menú de usuario. */}
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        {/* Apple HIG: los avisos pasajeros salen arriba, como los banners de iOS, y no tapan la barra de pestañas. */}
        <Toaster position="top-center" richColors mobileOffset={{ top: "calc(env(safe-area-inset-top) + 8px)" }} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
