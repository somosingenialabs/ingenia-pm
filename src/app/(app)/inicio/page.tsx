import type { Metadata } from "next";
import { BentoGrid } from "@/components/bento/bento-grid";
import { TarjetasInicio } from "@/components/bento/tarjetas-inicio";
import { PageHeader } from "@/components/layout/page-header";
import { obtenerContexto } from "@/lib/auth/contexto";
import { NOMBRE_ROL } from "@/lib/auth/permisos";
import { hoyEnZona } from "@/lib/fechas";

export const metadata: Metadata = { title: "Inicio" };

export default async function InicioPage() {
  const { usuario, organizacion, rol } = await obtenerContexto();
  return (
    <>
      <PageHeader titulo={`Hola, ${usuario.nombre}`} descripcion={`${organizacion.nombre} · ${NOMBRE_ROL[rol]}`} />
      <BentoGrid>
        <TarjetasInicio usuarioId={usuario.id} hoy={hoyEnZona(organizacion.zonaHoraria)} rol={rol} />
      </BentoGrid>
    </>
  );
}
