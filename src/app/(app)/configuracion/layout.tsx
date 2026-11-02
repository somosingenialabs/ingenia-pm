import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { obtenerContexto } from "@/lib/auth/contexto";
import { puedeConfigurar } from "@/lib/auth/permisos";
import { NavegacionConfiguracion } from "./navegacion-configuracion";

export default async function ConfiguracionLayout({ children }: { children: ReactNode }) {
  const { rol } = await obtenerContexto();
  return (
    <>
      <PageHeader titulo="Configuración" />
      <NavegacionConfiguracion esAdmin={puedeConfigurar(rol)} />
      {children}
    </>
  );
}
