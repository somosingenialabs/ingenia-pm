import type { ReactNode } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar } from "./app-sidebar";
import { BarraPestanas } from "./barra-pestanas";
import { MenuUsuario } from "./menu-usuario";
import { PaletaComandos } from "./paleta-comandos";

/**
 * Marco de la aplicación. Escritorio: barra lateral colapsable (Ctrl/Cmd+B) y encabezado
 * translúcido. Celular: barra inferior. En los dos: paleta de comandos (Ctrl/Cmd+K) y menú
 * de usuario con el tema y la salida.
 */
export function AppShell({ email, children }: { email: string; children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="material-regular sticky top-0 z-20 flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-2 border-b px-4 pt-[env(safe-area-inset-top)]">
          <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
          <Separator orientation="vertical" className="mr-1 hidden data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center md:block" />
          <span className="truncate texto-subtitulo text-muted-foreground">Ingenia PM</span>
          <div className="ml-auto flex items-center gap-1">
            <PaletaComandos />
            <MenuUsuario email={email} />
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-6 p-4 pb-[calc(env(safe-area-inset-bottom)+88px)] md:p-6 md:pb-6 lg:p-8 lg:pb-8">
          {children}
        </main>
      </SidebarInset>
      <BarraPestanas />
    </SidebarProvider>
  );
}
