import type { ReactNode } from "react";

/**
 * Encabezado de cada pantalla. Apple HIG: título grande (34 pt en el celular) y una sola
 * acción principal a la derecha; en el celular la acción ocupa el ancho para tocarla fácil.
 */
export function PageHeader({
  titulo,
  descripcion,
  acciones,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-4">
      <div className="space-y-1">
        <h1 className="texto-titulo-grande">{titulo}</h1>
        {descripcion && <p className="texto-subtitulo text-muted-foreground">{descripcion}</p>}
      </div>
      {acciones && <div className="flex gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">{acciones}</div>}
    </div>
  );
}
