"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { esSeccionActiva, seccionesVisibles, type Seccion } from "./navegacion";

/** Barra lateral de escritorio: colapsable a íconos (Ctrl/Cmd+B), material translúcido. */
export function AppSidebar() {
  const pathname = usePathname();
  const secciones = seccionesVisibles();
  const principales = secciones.filter((s) => !s.alPie);
  const alPie = secciones.filter((s) => s.alPie);

  const item = ({ href, titulo, icono: Icono }: Seccion) => (
    <SidebarMenuItem key={href}>
      <SidebarMenuButton asChild isActive={esSeccionActiva(href, pathname)} tooltip={titulo}>
        <Link href={href}>
          <Icono />
          <span>{titulo}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon" className="material-regular">
      <SidebarHeader className="px-2 py-3">
        <div className="flex h-11 items-center gap-2 overflow-hidden px-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- ícono SVG local, no necesita optimización */}
          <img src="/icon.svg" alt="" className="size-6 shrink-0" />
          <span className="truncate texto-titular group-data-[collapsible=icon]:hidden">Ingenia PM</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{principales.map(item)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {alPie.length > 0 && (
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <SidebarMenu>{alPie.map(item)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
