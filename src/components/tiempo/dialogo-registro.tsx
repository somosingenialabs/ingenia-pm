"use client";

import { useState } from "react";
import { toast } from "sonner";
import { mensajeDeError } from "@/components/estado/mensaje-de-error";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Ref } from "@/lib/data/comun";
import { crearRegistro, editarRegistro } from "@/lib/data/tiempo/acciones";
import { buscarTareasParaHoras, type RegistroFila } from "@/lib/data/tiempo/consultas";
import { AYUDA_DURACION, duracionParaCampo } from "@/lib/data/tiempo/reglas";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { erroresPorCampo } from "@/lib/validaciones/comun";
import { esquemaEdicionRegistro, esquemaRegistroManual } from "@/lib/validaciones/tiempo";
import { useTiempo } from "./proveedor-tiempo";

export type PedidoRegistro =
  | { modo: "crear"; tarea?: Ref; fijarTarea?: boolean; fecha?: string }
  | { modo: "editar"; registro: RegistroFila };

/** Carga manual y edición: tarea, fecha (hoy por defecto), duración y nota. */
export function DialogoRegistro({ pedido, onCerrar }: { pedido: PedidoRegistro | null; onCerrar: () => void }) {
  return (
    <Dialog open={!!pedido} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        {pedido && <Formulario key={pedido.modo === "editar" ? pedido.registro.id : "nuevo"} pedido={pedido} onListo={onCerrar} />}
      </DialogContent>
    </Dialog>
  );
}

function Formulario({ pedido, onListo }: { pedido: PedidoRegistro; onListo: () => void }) {
  const { hoy, refrescar, usuarioId } = useTiempo();
  const db = crearClienteNavegador();
  const editando = pedido.modo === "editar" ? pedido.registro : null;
  const fija = pedido.modo === "crear" && pedido.fijarTarea && pedido.tarea;

  const [tarea, setTarea] = useState<Ref | null>(
    editando ? { id: editando.tareaId, nombre: editando.tareaTitulo } : pedido.modo === "crear" ? (pedido.tarea ?? null) : null,
  );
  const [fecha, setFecha] = useState(editando?.fecha ?? (pedido.modo === "crear" ? pedido.fecha : undefined) ?? hoy);
  const [duracion, setDuracion] = useState(editando?.minutos ? duracionParaCampo(editando.minutos) : "");
  const [nota, setNota] = useState(editando?.nota ?? "");
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const datos = { ...(editando ? { id: editando.id } : {}), tarea_id: tarea?.id ?? "", fecha, duracion, nota };
    const validado = (editando ? esquemaEdicionRegistro : esquemaRegistroManual).safeParse(datos);
    if (!validado.success) {
      setCampos(erroresPorCampo(validado.error));
      setError(null);
      return;
    }
    setCampos({});
    setError(null);
    setEnviando(true);
    try {
      const resultado = editando ? await editarRegistro(datos) : await crearRegistro(datos);
      if (!resultado.ok) {
        setError(resultado.error);
        setCampos(resultado.campos ?? {});
        return;
      }
      toast.success(editando ? "Registro corregido." : "Horas cargadas.");
      await refrescar();
      onListo();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{editando ? "Corregir registro" : "Cargar horas"}</DialogTitle>
        <DialogDescription>
          {!editando
            ? "Se cargan a tu nombre."
            : editando.usuarioId === usuarioId
              ? "Tu registro."
              : `Registro de ${editando.persona?.nombre ?? "otra persona"}.`}
        </DialogDescription>
      </DialogHeader>

      {fija ? (
        <p className="text-sm">
          <span className="text-muted-foreground">Tarea: </span>
          {fija.nombre}
        </p>
      ) : (
        <Field data-invalid={!!campos.tarea_id || undefined}>
          <FieldLabel htmlFor="registro-tarea">Tarea</FieldLabel>
          <Combobox
            id="registro-tarea"
            valor={tarea}
            onCambiar={setTarea}
            buscar={(texto) => buscarTareasParaHoras(db, texto)}
            placeholder="Elegí una tarea"
            etiquetaBusqueda="Buscar tarea…"
            permitirVacio={false}
            invalido={!!campos.tarea_id}
          />
          {campos.tarea_id && <FieldError>{campos.tarea_id}</FieldError>}
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={!!campos.fecha || undefined}>
          <FieldLabel htmlFor="registro-fecha">Fecha</FieldLabel>
          <Input id="registro-fecha" type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} aria-invalid={!!campos.fecha || undefined} />
          {campos.fecha && <FieldError>{campos.fecha}</FieldError>}
        </Field>
        <Field data-invalid={!!campos.duracion || undefined}>
          <FieldLabel htmlFor="registro-duracion">Duración</FieldLabel>
          <Input
            id="registro-duracion"
            value={duracion}
            onChange={(e) => setDuracion(e.target.value)}
            placeholder="1:30"
            autoComplete="off"
            autoFocus={!!fija || !!tarea}
            aria-invalid={!!campos.duracion || undefined}
            aria-describedby="registro-duracion-ayuda"
          />
          <FieldDescription id="registro-duracion-ayuda">{AYUDA_DURACION}</FieldDescription>
          {campos.duracion && <FieldError>{campos.duracion}</FieldError>}
        </Field>
      </div>

      <Field data-invalid={!!campos.nota || undefined}>
        <FieldLabel htmlFor="registro-nota">Nota (opcional)</FieldLabel>
        <Textarea id="registro-nota" value={nota} onChange={(e) => setNota(e.target.value)} rows={2} maxLength={500} />
        {campos.nota && <FieldError>{campos.nota}</FieldError>}
      </Field>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="submit" disabled={enviando}>
          {enviando ? "Guardando…" : editando ? "Guardar cambios" : "Cargar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
