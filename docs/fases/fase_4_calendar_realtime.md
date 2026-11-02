# Fase 4 · Calendario interactivo, carga, dependencias y comentarios en tiempo real

**Rol:** desarrollador senior de interfaces con tiempo real. Ejecutá esta fase completa y frená al cerrarla.

**Antes de empezar, leé:** `docs/estado.md` y `docs/arquitectura.md`, secciones 2 y 4. Reusá `src/lib/fechas.ts`, los lugares que dejó la fase 3 en el detalle de tarea, y la capa de datos existente.

## Objetivo

**Termina con:**
- Plazos en calendario, movibles por quien gestiona.
- Grilla de carga por persona.
- Dependencias con aviso de conflicto.
- Comentarios que le llegan a otra persona sin recargar, sin fugas entre empresas.

## Fuera de esta fase

Reprogramar en cadena las sucesoras, flechas de Gantt, sincronizar con Google u Outlook, "está escribiendo", menciones, feriados.

**Dependencias de esta fase:** `react-big-calendar@1.20`, `@types/react-big-calendar` (desarrollo).

## Paso 1 · Migración

```sql
-- Sin esto Realtime no emite nada.
alter publication supabase_realtime add table public.comentarios, public.tareas;
```

Para llamar funciones de `analitica` por RPC, el esquema tiene que estar expuesto: sumalo en `config.toml`, `[api] schemas`, si no está, y otorgá `execute` a `authenticated` en cada función. Desde el código: `db.schema("analitica").rpc(...)`.

Funciones nuevas (y sus tests SQL en `supabase/tests/calendario.test.sql`):

| Función | Tipo | Qué hace |
|---|---|---|
| `public.eliminar_comentario(p_id uuid)` | `security definer`, valida a mano | Autor, Admin o gestor del proyecto. Marca `eliminado_en`. Hace falta porque el `update` de comentarios es solo del autor |
| `public.conflictos_dependencias(p_proyecto uuid)` | `security invoker` | Filas `tarea_id, depende_de_id, debe_arrancar_desde, arranca_el`. Hay conflicto si la predecesora no está `hecha` y `coalesce(s.fecha_inicio, s.fecha_limite) < p.fecha_limite + desfase_dias` |
| `analitica.carga_por_persona(p_desde date, p_hasta date, p_proyecto uuid default null)` | `security invoker`, para que siga filtrando el RLS | Ver abajo |

**Contrato de `carga_por_persona`.** Devuelve una fila por persona y semana: `usuario_id, semana (lunes), horas_asignadas, capacidad, tareas_sin_estimar, tareas_sin_fecha`.

- Cuenta tareas no eliminadas, en estados abiertos, de proyectos no eliminados.
- Horas restantes de una tarea: `greatest(horas_estimadas - horas_registradas, 0)`.
- Se reparten en partes iguales entre lunes y viernes, de `coalesce(fecha_inicio, fecha_limite)` a `fecha_limite`. Si todo el rango cae en fin de semana, van al día hábil anterior.
- `capacidad = miembros.horas_semanales`.
- Tarea sin estimar o sin fecha: **no se inventa un valor**. Se cuenta en su columna y la pantalla lo muestra.
- Semanas con lunes en la zona de la empresa. Sin contar feriados: decilo en la pantalla.

## Paso 2 · Calendario (`/calendario`)

Archivos: `src/components/calendario/{calendario.tsx, evento.tsx, filtros.tsx, calendario.css}`, `src/lib/data/calendario/`.

**Puesta en marcha de `react-big-calendar`:**
- `dateFnsLocalizer` con locale `es` y semana que arranca el lunes. `culture="es"` y `messages` en castellano con voseo.
- Cargalo con `next/dynamic` y `ssr: false` desde un componente de cliente: arrastra mucho peso (moment, luxon, globalize van en sus dependencias) y no debe entrar en otras rutas. Medí el tamaño del bloque en el build y anotalo en `docs/estado.md`.
- Drag and drop: `withDragAndDrop` de `react-big-calendar/lib/addons/dragAndDrop`, con su CSS.
- Pisá los estilos en `calendario.css`, con los tokens de la sección 4 y modo oscuro. Tiene que verse como el resto de la app, no como la librería.

**Comportamiento:**
- **Vistas en escritorio:** Mes (por defecto), Semana, Agenda. **En celular:** Agenda por defecto, y Mes solo como vista general. Sin arrastrar: la fecha se cambia desde la hoja de la tarea.
- **Datos:** pedí solo el rango visible. Clave de TanStack Query con `[desde, hasta, filtros]`.
- **Eventos:** tareas no canceladas, y objetivos de proyecto como evento diferenciado (ícono y texto).
- **Modo:** segmentado "Plazos" (un evento el día de `fecha_limite`, por defecto) o "Duración" (de `fecha_inicio` a `fecha_limite`).
- **Fin exclusivo:** los eventos de día completo terminan a las 00:00 del día siguiente. Pasalos por una función con test, o la barra queda un día corta.
- **Evento:** color por proyecto, título, ícono de prioridad. Vencida y conflicto con ícono y texto accesible, no solo color.
- **Filtros:** proyecto, persona y "Solo mías", en la URL.
- **Mover:** `draggableAccessor` solo para tareas donde es gestor. En Plazos cambia `fecha_limite`. En Duración desplaza las dos fechas, y permite estirar. Optimista, y vuelve atrás con aviso si falla.
- **Si el movimiento crea un conflicto:** se guarda igual y avisa "Esta tarea arranca antes de que termine X". No mueve otras tareas.
- **Clic:** abre `?tarea=<id>`.
- **Teclado:** el arrastre de esta librería no es accesible por teclado. Por eso la fecha siempre se puede cambiar desde el detalle.

## Paso 3 · Dependencias

En el detalle de tarea, sección "Dependencias", solo para gestor:
- "Depende de" y "Bloquea", con combobox de tareas del mismo proyecto y desfase en días.
- Ciclo rechazado: mensaje claro, no el error de Postgres.

En el calendario, al seleccionar una tarea, se resaltan sus predecesoras y sucesoras, y se atenúan las demás, con leyenda en texto. Esa es la vista de "dependencias temporales" de esta versión.

En el tablero y la lista: ícono "Bloqueada por X" si tiene una predecesora abierta. Es informativo: no impide mover.

## Paso 4 · Carga (`/carga`)

- Grilla propia: personas en filas, semanas en columnas (8 semanas). Celda con horas asignadas / capacidad y porcentaje.
- Tres niveles, con ícono y texto: Libre (menos de 70 %), Normal (hasta 100 %), Sobrecargada (más de 100 %). Umbrales en una constante con test.
- Al lado del nombre: "3 sin estimar", "2 sin fecha". Son la razón de que el número pueda estar subestimado.
- Clic en una celda: tareas de esa persona esa semana, en una hoja.
- A 375 px: lista por persona con una semana elegida, no una tabla ancha.
- Admin y PM ven a todos. Colaborador ve solo su fila.

Prendé Calendario y Carga en la navegación.

## Paso 5 · Comentarios en tiempo real

Archivos: `src/components/comentarios/{seccion.tsx, lista.tsx, caja.tsx, item.tsx}`, `src/lib/data/comentarios/`, `src/hooks/use-canal-realtime.ts`.

```ts
supabase.channel(`comentarios:tarea:${tareaId}`).on(
  "postgres_changes",
  { event: "*", schema: "public", table: "comentarios", filter: `tarea_id=eq.${tareaId}` },
  manejar,
);
```

Puntos que no se pueden omitir:

1. **Solo el navegador se suscribe,** con el cliente que trae la sesión. Sin eso, el RLS de Realtime no reconoce al usuario.
2. **Optimista sin duplicar:** el navegador genera el `id` con `crypto.randomUUID()`, pinta el comentario "enviando", y el evento que llega con ese id reemplaza al provisorio. Si falla, queda marcado con "Reintentar" y el texto no se pierde.
3. **Realtime no reenvía lo perdido.** Cada vez que el canal pasa a `SUBSCRIBED`, también después de reconectar, y al volver a la pestaña, se invalida la consulta para traer lo que faltó.
4. **El payload no trae al autor.** Resolvé nombre y avatar desde la lista de miembros en caché. Si no está, refrescá esa lista.
5. **Borrado lógico:** llega como `UPDATE` con `eliminado_en`. Se muestra "Comentario eliminado" para no romper el hilo.
6. **Limpieza:** `removeChannel` al desmontar. Un solo canal por tarea abierta.
7. **Texto plano** con saltos de línea. Sin `dangerouslySetInnerHTML`: evita inyección de código.
8. **Estado de conexión:** si el canal cae, un aviso discreto "Reconectando". La caja de texto sigue usable.

**UI:** lista en orden cronológico, autor, tiempo relativo con fecha completa en el `title`, "(editado)". Enter inserta salto en celular. En escritorio Ctrl/Cmd+Enter envía. Autoscroll solo si ya estaba abajo; si no, botón "Comentarios nuevos". Región `aria-live="polite"`.

### Tareas en vivo

Canal `tareas:proyecto:${id}` en `/proyectos/[id]`. Al recibir un evento, invalidá las consultas de ese proyecto con una espera de 500 ms, para agrupar ráfagas. No mezcles el payload con el estado: la consulta es la única fuente. **Durante un arrastre, pausá la invalidación** para que la tarjeta no salte de la mano.

## Cierre

**E2E (dos contextos de navegador):**
- A escribe y B lo ve sin recargar. A edita y borra, y B lo ve.
- **Fuga entre empresas:** un usuario de la empresa B, y un colaborador que no es miembro del proyecto, se suscriben a ese `tarea_id` y **no reciben nada**. Es el test más importante de la fase.
- Tras cortar la red y reconectar, aparece lo que faltó.
- Arrastrar en el calendario cambia la fecha. Colaborador no puede. A 375 px abre en Agenda.
- Un día cerca de la medianoche no se corre de fecha (test en zona `America/Argentina/Buenos_Aires`).
- Cambio de tarea en otra sesión se ve en el tablero.

**En verde y mostrando la salida:** `npm run test:sql`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e`.

Mostrá capturas de calendario y carga en claro, oscuro y 375 px. Actualizá `docs/estado.md`. Proponé el commit, no lo hagas sin un sí.
