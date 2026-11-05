import { Suspense, type ReactNode } from "react";
import { PanelTarea } from "@/components/tareas/panel-tarea";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import type { Contexto } from "@/lib/auth/tipos";
import { hoyEnZona } from "@/lib/fechas";
import { AcentoOrganizacion } from "./acento-organizacion";
import { AppSidebar } from "./app-sidebar";
import { BarraPestanas } from "./barra-pestanas";
import { MenuUsuario } from "./menu-usuario";
import { PaletaComandos } from "./paleta-comandos";

/**
 * Marco de la aplicación. Escritorio: barra lateral colapsable (Ctrl/Cmd+B) y encabezado
 * translúcido. Celular: barra inferior. En los dos: paleta de comandos (Ctrl/Cmd+K), menú de
 * usuario con el tema y la salida, y el detalle de tarea (`?tarea=<id>`) sobre cualquier pantalla.
 */
export function AppShell({ contexto, children }: { contexto: Contexto; children: ReactNode }) {
  return (
    <SidebarProvider>
      <AcentoOrganizacion color={contexto.organizacion.colorAcento} />
      <AppSidebar />
      <SidebarInset className="min-w-0 bg-background">
        <header className="material-regular sticky top-0 z-20 flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-2 border-b px-4 pt-[env(safe-area-inset-top)]">
          <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
          <Separator orientation="vertical" className="mr-1 hidden data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center md:block" />
          {contexto.organizacion.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- lo sube cada empresa; no pasa por el optimizador.
            <img src={contexto.organizacion.logoUrl} alt="" className="size-6 shrink-0 rounded object-contain" />
          )}
          <span className="truncate texto-subtitulo text-muted-foreground">{contexto.organizacion.nombre}</span>
          <div className="ml-auto flex items-center gap-1">
            <PaletaComandos usuarioId={contexto.usuario.id} rol={contexto.rol} />
            <MenuUsuario email={contexto.usuario.email ?? contexto.usuario.nombre} />
          </div>
        </header>
        <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 pb-[calc(env(safe-area-inset-bottom)+88px)] md:p-6 md:pb-6 lg:p-8 lg:pb-8">
          {children}
        </main>
      </SidebarInset>
      <BarraPestanas />
      <Suspense fallback={null}>
        <PanelTarea
          yo={{ id: contexto.usuario.id, nombre: contexto.usuario.nombre, avatarUrl: contexto.usuario.avatarUrl }}
          organizacionId={contexto.organizacion.id}
          rol={contexto.rol}
          hoy={hoyEnZona(contexto.organizacion.zonaHoraria)}
        />
      </Suspense>
    </SidebarProvider>
  );
}
