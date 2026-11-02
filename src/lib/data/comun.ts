/** Respuesta de una Server Action. `campos` trae el error de cada campo del formulario. */
export type Resultado<T = void> =
  | { ok: true; datos: T }
  | { ok: false; error: string; campos?: Record<string, string> };

/** Referencia corta para combos, chips y tarjetas. */
export type Ref = { id: string; nombre: string };
