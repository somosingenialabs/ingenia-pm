/** Los errores de Supabase son objetos con `message`, no instancias de Error. */
function textoDeError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "";
}

const MENSAJES_DE_LA_BASE: readonly (readonly [RegExp, string])[] = [
  [/arma un ciclo/i, "Esa dependencia arma un ciclo entre tareas. Sacá una de las dos."],
  [/no es miembro del proyecto/i, "Esa persona no es miembro del proyecto. Sumala antes de asignarle la tarea."],
  [/sin un Admin activo/i, "La empresa no puede quedarse sin un Admin activo. Nombrá a otra persona antes."],
  [/Solo pod[eé]s cambiar el estado/i, "Solo podés cambiar el estado, la posición y la descripción de esta tarea."],
  [/Solo un Admin puede/i, "Solo un Admin puede borrar o restaurar un proyecto."],
  [/La invitaci[oó]n no es v[aá]lida/i, "Este enlace no es válido. Revisá que esté completo o pedí uno nuevo."],
  [/La invitaci[oó]n venci[oó]/i, "Este enlace venció. Pedile uno nuevo a quien te invitó."],
  [/La invitaci[oó]n fue revocada/i, "Esta invitación se canceló. Pedile una nueva a quien te invitó."],
  [/La invitaci[oó]n ya se us[oó]/i, "Esta invitación ya se usó. Si es tuya, ingresá con tu mail y contraseña."],
  [/La invitaci[oó]n es para otro mail/i, "Esta invitación es para otro mail."],
  [/proyectos_organizacion_id_responsable_id_fkey/i, "El responsable tiene que ser parte de la empresa."],
  [/proyecto_miembros_pkey/i, "Esa persona ya es miembro del proyecto."],
];

/**
 * Traduce un error técnico (red, sesión vencida, permisos, Postgres) a una frase que entienda
 * quien usa la app. El detalle crudo se deja en la consola, no en pantalla.
 */
export function mensajeDeError(error: unknown): string {
  const texto = textoDeError(error);
  const t = texto.toLowerCase();
  // Los mensajes que escribimos en los triggers de la base ya están pensados para mostrarse.
  const propio = MENSAJES_DE_LA_BASE.find(([patron]) => patron.test(texto));
  if (propio) return propio[1];
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "Parece que no hay conexión. Revisá tu internet y probá de nuevo.";
  }
  if (/failed to fetch|networkerror|load failed|network request failed|fetch failed|timeout|timed out/.test(t)) {
    return "No pudimos conectarnos. Revisá tu internet y probá de nuevo.";
  }
  if (/jwt|refresh token|not authenticated|sesi[oó]n/.test(t)) {
    return "Tu sesión venció. Ingresá de nuevo para seguir.";
  }
  if (/row-level security|permission denied|not allowed|no autorizado|forbidden/.test(t)) {
    return "No tenés permiso para hacer esto.";
  }
  if (/duplicate key|unique constraint|ya existe|already/.test(t)) {
    return "Eso ya estaba registrado. Actualizá la pantalla para verlo.";
  }
  return "Algo salió mal de nuestro lado. Probá de nuevo; si sigue, avisá a soporte.";
}

/** ¿Es un error de sesión vencida? Las pantallas pueden ofrecer ir a /ingresar. */
export function esSesionVencida(error: unknown): boolean {
  const texto = textoDeError(error);
  return /jwt|refresh token|not authenticated/i.test(texto);
}
