# Estado de Ingenia PM

Cada fase, al cerrar, actualiza este archivo. Es lo único que la sesión siguiente lee de la anterior: tiene que alcanzar.

**Fase siguiente:** 5 · `docs/fases/fase_5_analytics_time.md`

| Fase | Estado | Fecha | Notas para la que sigue |
|---|---|---|---|
| 1. Setup y auth | Terminada | 2026-11-01 | Supabase local en puertos 553xx (`npx.cmd supabase start`). El hook `custom_access_token` quedó comentado en `config.toml`: se prende cuando exista la función. `database.types.ts` tiene el esquema vacío: regeneralo con `npm run db:tipos`, que hoy solo pide `public`. `src/lib/data/comun.ts` solo tiene `Resultado` y `Ref`. La sesión se valida con `obtenerUsuario()` de `src/lib/auth/sesion.ts`. El marco todavía no recibe rol ni empresa |
| 2. Esquema y RLS | Terminada | 2026-11-01 | Ver "Disponible desde la fase 2". `obtenerContexto()` da usuario, empresa y rol; sin empresa activa manda a `/sin-empresa`. `navegacion.ts` todavía no filtra por rol. `src/lib/data/comun.ts` sigue con `Resultado` y `Ref`: sumá lo demás ahí, no lo pises. **Dependencias:** nunca `npm install`; ver `README.md` |
| 3. UI base y Bento | Terminada | 2026-11-02 | Ver "Disponible desde la fase 3". Comentarios: completá `SeccionComentarios` en `src/components/tareas/secciones-reservadas.tsx`. El tablero ya tiene `useOptimistic` en `vistas-proyecto.tsx`: realtime tiene que refrescar esos datos, no pisarlos. Sumá tarjetas solo en `TARJETAS_INICIO` |
| 4. Calendario y realtime | Terminada | 2026-11-04 | Ver "Disponible desde la fase 4". Horas: completá `SeccionTiempo` en `src/components/tareas/secciones-reservadas.tsx`, que es lo único que queda ahí. `analitica.carga_por_persona` ya existe en el esquema `analitica`: las métricas nuevas van al lado. Para escuchar una tabla en vivo usá `useCanalRealtime`, y sumá la tabla a la publicación `supabase_realtime` en una migración. `/horas` y `/analitica` siguen en `SIN_PANTALLA` de `navegacion.ts` |
| 5. Horas y analítica | Pendiente | | |

## Disponible desde la fase 2

**Helpers de `app`, para `authenticated`:** `org_actual()`, `rol_actual()`, `es_miembro(org)`, `tiene_rol(org, roles[])`, `usuario_es_miembro(usuario, org)`, `comparte_organizacion(usuario)`, `proyectos_visibles()`, `proyectos_gestionados()`, `tareas_visibles()`, `tareas_gestionadas()`.

**RPC:** ninguna todavía. `public.custom_access_token_hook` es solo para Auth, no se llama desde la API.

**Lo que hace la base sola (no lo mandes desde la app):** `completada_en`, `editado_en`, `actualizado_en`, `creado_por` de proyectos y tareas, `proyecto_id` de `registros_tiempo`, el historial de estados y agregar a responsable y creador como miembros.

**Trampas para las fases que siguen:**

- **La fecha de hoy es la de la empresa.** `current_date` de la base está en UTC: a la noche en Argentina ya es mañana, y `registros_tiempo` lo rechaza por fecha futura. Usá `(now() at time zone zona_horaria)::date`.
- **`insert ... returning` pasa por la política de lectura**, y un helper `stable` no ve la fila que se está insertando. Por eso `proyectos` resuelve Admin y PM por rol. Tenelo en cuenta en cada tabla nueva.
- **Un cambio de empresa activa no rige hasta renovar el token.** El hook pone `org_id` al emitirlo: al aceptar una invitación (fase 3), refrescá la sesión o el RLS devuelve vacío. Una baja o un cambio de rol rigen enseguida, porque el rol se consulta en `miembros`.
- **Sacar a alguien de un proyecto no le desasigna las tareas.** Quedan a su nombre y no le bloquean a nadie la edición: la fase 3 decide qué mostrar.
- **Una empresa con tareas no se puede borrar:** `tareas` no tiene cascada desde `proyectos`, tal como pide el plan. Hoy nadie borra empresas.
- **Tablas nuevas:** `npm run test:sql` corta si una tabla de `public` nace sin RLS. Los permisos por defecto ya no dan nada a `anon` ni `TRUNCATE` a `authenticated`.
- **`supabase start` no aplica migraciones nuevas** sobre un volumen existente: corré `npx.cmd supabase db reset`. Si el arranque se cae porque falta un esquema, usá `npx.cmd supabase stop --no-backup`.

## Disponible desde la fase 3

**RPC, solo con la clave secreta:** `invitacion_por_token(hash)` y `aceptar_invitacion(hash, usuario)`.

**Piezas para reusar:** `src/lib/fechas.ts` (`fechaDesdeBase`, `hoyEnZona`, `diasLaborales`), `src/lib/data/errores.ts` (`errorDeBase`, `SIN_FILAS`), `EnlaceTarea` y `navegarSinRecargar` (`?tarea=` sin ir al servidor), `Selector` (lista de 44 px), TanStack Query en `providers.tsx`.

**Trampas para las fases que siguen:**

- **Un update o delete que el RLS bloquea no da error: afecta 0 filas.** Pedí la fila con `.select()` y devolvé `SIN_FILAS`.
- **Una tarea de un proyecto borrado sigue con `eliminado_en` nulo.** Filtrá también por el proyecto: usá `SELECT_TAREA` con `.is("proyecto.eliminado_en", null)`.
- **`miembros` deja ver todas las empresas de la persona:** filtrá siempre por `organizacion_id`.
- **La clave secreta no puede actualizar `tareas` ni `proyectos`:** `service_role` no tiene permiso sobre el esquema `app`, que usan sus triggers. Para preparar un test, usá un Admin con sesión.
- **Los errores de Supabase no son `Error`:** son objetos con `message`. `mensajeDeError` ya los entiende; un mensaje nuevo de un trigger se suma a `MENSAJES_DE_LA_BASE`.
- **Usuarios en e2e:** usá `crearPersona` de `e2e/ayudas.ts`. Los del seed los cambian otros tests en paralelo.

## Disponible desde la fase 4

**RPC, para `authenticated`:**

- `public.eliminar_comentario(p_id)`: `security definer`. Borra (marca `eliminado_en`) el autor, un Admin o quien gestiona el proyecto.
- `public.conflictos_dependencias(p_proyecto default null)`: `security invoker`, respeta el RLS. Devuelve `tarea_id, depende_de_id, debe_arrancar_desde, arranca_el`.
- `analitica.carga_por_persona(p_desde, p_hasta, p_proyecto default null)`: `security invoker`. Horas que faltan por persona y semana, `horas_atrasadas`, capacidad, tareas sin estimar y sin fecha. Un colaborador recibe solo su fila. Rango máximo 370 días. Desde la app: `db.schema("analitica").rpc(...)`.

**Realtime:** `comentarios` y `tareas` están en la publicación `supabase_realtime`. Hook `src/hooks/use-canal-realtime.ts` (`useCanalRealtime({ canal, tabla, filtro, alCambiar, alSincronizar, activo })`): vuelve a pedir todo al suscribirse, al volver a la pestaña y al volver la red, y devuelve el estado del canal para mostrar "Reconectando…".

**Piezas para reusar:** `src/lib/data/calendario/reglas.ts` (fechas de día completo, rango visible), `src/lib/data/carga/reglas.ts` (`lunesDe`, `semanasDesde`, `textoHoras`, umbrales de carga), `src/lib/data/comentarios/reglas.ts` (`aplicarEvento`, `tiempoRelativo`), `EtiquetaBloqueada` en `etiquetas.tsx`, `listarBloqueosDeProyecto`.

**Peso del calendario:** el bloque de `react-big-calendar` mide 248,5 KB (70,5 KB con gzip) más 17,6 KB de CSS (3,5 KB con gzip). Solo lo carga `/calendario`.

**Trampas para las fases que siguen:**

- **Realtime no reenvía lo que se perdió.** Si el canal se corta, los eventos de ese rato no llegan nunca: hay que volver a pedir los datos al reconectar. `useCanalRealtime` ya lo hace.
- **Lo que cambia entre que se carga la página y que el canal queda suscripto también se pierde.** Por eso el tablero refresca en la primera suscripción, no solo en las siguientes.
- **`router.refresh()` sin conexión hace una navegación completa** y deja la página de error del navegador. Mirá `navigator.onLine` antes, y refrescá en el evento `online`.
- **Realtime filtra con el RLS del token de quien escucha.** Una tabla nueva en la publicación tiene que tener su test de fuga, como el de `e2e/comentarios.spec.ts`, con un control que sí reciba.
- **Un `next start` viejo en el puerto 3100** hace que Playwright lo reuse y los e2e fallen contra código viejo. En Windows: `Get-NetTCPConnection -LocalPort 3100 | ForEach-Object { Stop-Process -Id $_.OwningProcess }`.
- **Los e2e dejan personas y proyectos en la base local.** Antes de sacar capturas, `npx.cmd supabase db reset`.
- **Vitest corre en zona `America/Argentina/Buenos_Aires`** (`vitest.config.ts`): un test de fechas que pase solo ahí no prueba otra zona.
- **Git Bash convierte `/proyectos` en una ruta de Windows.** Usá `MSYS_NO_PATHCONV=1`.

## Desvíos respecto del plan

Lo que se hizo distinto a lo que dice la fase, y por qué.

**Fase 1**

- **`[auth.email] enable_signup = true`, la fase pedía `false`.** En `false` apaga todo el ingreso por mail (`email_provider_disabled`), no solo el registro. El registro público queda cerrado con `[auth] enable_signup = false`, y lo cubre el test "no hay registro público".
- **`package-lock.json` regenerado.** El de `crm-base` no traía el binario de Windows de `rolldown` y Vitest no arrancaba. `package.json` no cambió de rangos; `lucide-react` pasó de 1.63 a 1.66 y otras 37 dependencias quedaron en otra versión.
- **44 px también en escritorio.** La fase lo pide en los dos tamaños, así que botones, campos y barra lateral dejaron de achicarse con mouse. La barra lateral colapsada mide 4rem.
- **Menú de usuario en el encabezado**, en los dos tamaños, en vez del pie de la barra lateral: en celular la barra lateral no se muestra y hacía falta llegar a Salir.
- **Sin copiar:** `data-table` (pide `@tanstack`), `boton-acciones-rapidas` y el catálogo `/dev`. `providers.tsx` va sin TanStack Query. La paleta de comandos solo navega.
- **Sin neumorfismo:** la sección 4 no permite sombras decorativas. Se sacaron las utilidades `neu-*` y el segmentado usa borde.
- **Sin `output: "standalone"`** en `next.config.ts`, porque todavía no hay imagen Docker de la app.
- **`email_sent = 100` en `config.toml`, solo desarrollo:** con el límite de 2 por hora los e2e de recuperar contraseña fallaban sin aviso. **`minimum_password_length = 10`:** Auth exige lo mismo que el formulario.
- **Salir cierra solo este dispositivo** (`scope: "local"`), no todas las sesiones de la persona.
- **Tests de más:** recorrido real de recuperar contraseña con el mail de Mailpit, mismo error con un mail inexistente y registro público cerrado.

**Fase 2**

- **Política de lectura de `proyectos`:** Admin y PM van por rol, no por `proyectos_visibles()`. Con el helper, crear un proyecto y pedir la fila de vuelta fallaba por RLS. El permiso es el mismo.
- **`completada_en` también se calcula al crear**, y se ignora si alguien lo manda a mano en un update. La fase solo pedía el update, y así quedaba falsificable.
- **`creado_por` de proyectos lo pone la base** y no se puede cambiar: de ese dato depende que quien crea quede como miembro. En tareas tiene `auth.uid()` por defecto.
- **`tarea_validar_asignado` valida solo si cambia el asignado.** Si no, sacar a alguien del proyecto trababa sus tareas para todos.
- **`app.tareas_gestionadas()` es un helper de más**, para las políticas de `tarea_dependencias`.
- **`app.miembros_proteger`** además impide mover un miembro a otra empresa o persona, y deja pasar el borrado en cascada de una empresa entera.
- **Permisos revocados de más:** `TRUNCATE`, `REFERENCES` y `TRIGGER` a `authenticated`, porque Supabase los da por defecto y `TRUNCATE` saltea el RLS. Insert, update y delete del historial, además de no tener política.
- **Tests de más:** token real contra Auth y la API, y `debe_fallar` exige el motivo del error, para que un error de tipeo en un test no pase por bueno.
- **`/sin-empresa`** es una ruta nueva, y `/ingresar` manda ahí después de `/inicio` si no hay empresa activa.
- **`npm run lock:regenerar` y `npm ci`, corrige la fase 1.** Con estas dependencias, npm 11 no genera de una un lock estable con los binarios: el lock del commit de la fase 1 rechazaba `npm ci`, y un `npm install` borraba el binario de `rolldown` y dejaba a Vitest sin arrancar. El script no suma paquetes, y la regeneración no cambió ninguna versión salvo agregar `pg`.

**Fase 3**

- **`comun.ts` no se copió entero:** se sumaron `ClienteSupabase` y `PersonaRef`, como pedía la fase 2. No hay paginación por cursor porque nada la usa todavía.
- **`data-table.tsx` no se copió:** depende del módulo de vistas del CRM. `tabla-proyectos` y `lista-tareas` usan TanStack Table directo.
- **Firmas con un parámetro de más:** `listarMiembros(db, organizacionId)`, por la trampa de arriba. `listarProyectos` y `obtenerProyecto` reciben `hoy`, para la salud, y `listarMisTareas` recibe el usuario.
- **`moverTarea` acepta `posicion` opcional:** sin ella va al final de la columna. Lo usan el menú "Mover a..." y Mis tareas, que no tienen a las vecinas a mano.
- **Funciones de más:** `editarTareasEnLote`, `buscarTareas`, `listarPersonasDeProyecto`, `listarInvitacionesPendientes` y `configuracion/acciones.ts`.
- **Dos RPC nuevas para invitaciones:** alta, empresa activa y marca de usada van en una transacción, y dos pedidos con el mismo token no pasan los dos. El mail se compara con `auth.users`, porque `perfiles.email` lo edita su dueño.
- **Una invitación no le baja el rol a quien ya es miembro activo.** A quien estaba desactivado lo reactiva con el rol nuevo. Es la única forma de reactivar a alguien.
- **Mis tareas e inicio no muestran tareas abiertas de proyectos terminados o cancelados:** quedarían vencidas para siempre. Decisión propia, la fase no lo dice.
- **Salud:** un proyecto terminado o cancelado siempre da "Al día", y sin tareas cerca del objetivo da "En riesgo".
- **Sin asignar ocupa todo el ancho:** es la quinta chica y dejaba un hueco.
- **Mi semana, sábado y domingo:** muestra la semana que viene.
- **Cambio de estado en un toque:** avanza al paso siguiente (Empezar, A revisión, Terminar).
- **Panel de tarea sin `pie` fijo:** Guardar va al final del contenido, porque la fase 4 suma comentarios debajo.
- **Bucket `avatares`:** sin SVG, porque puede traer scripts. La lectura pública es por URL, sin política de listado, para que nadie enumere los ids. El logo de la empresa va en la carpeta del Admin que lo sube: la fase no pedía otro bucket.
- **Color de acento:** se rechaza si no llega a AA contra el blanco.
- **Control de estados a 375 px en 2×2:** en una fila, "Hecha" quedaba cortada.
- **`sign_in_sign_ups = 1000` en `config.toml`, solo desarrollo:** con 30 cada 5 minutos, los e2e se quedaban sin ingresos.
- **Sin e2e a 375 px:** teclado y paleta (el tablero a 375 no arrastra) y el aviso de movimiento fallido, porque usa el mismo camino que en escritorio.
- **Corrige la fase 1:** el e2e de recuperar contraseña usa una persona propia, porque le cambiaba la clave a `colab3` mientras otro test ingresaba. `DialogContent` pasó a `z-[51]`: al reabrir un diálogo enseguida, el fondo podía quedar encima y bloquear los clics.
- **Precisión de `posicion`:** pasa por un número de JS. Tras unas 50 inserciones seguidas en el mismo hueco, dos tareas empatan; se desempata por id.

**Fase 4**

- **Conflictos de dependencias:** no cuentan si la tarea previa está cancelada ni si la que espera ya está cerrada. Una tarea hecha tampoco muestra "Bloqueada por".
- **`conflictos_dependencias` tiene el proyecto opcional** (`default null`): sin él revisa todo lo que la persona ve.
- **Un comentario borrado no se puede editar ni restaurar.** Se cambió el trigger `app.comentario_proteger`. El cuerpo sigue en la base y el RLS lo deja leer a quien ve la tarea: la pantalla muestra "Comentario eliminado".
- **Reintentar un comentario con el mismo id** devuelve el que ya estaba, en vez de error, para que un reintento después de un corte no duplique.
- **Dependencias solo para quien gestiona**, como dice la fase. El colaborador ve "Bloqueada por" en el tablero, pero no la sección. Si querés que la vea en solo lectura, es un cambio chico.
- **Calendario:** una tarea con fecha de inicio pero sin fecha límite no aparece. La vista Semana no tiene grilla de horas, porque las tareas son de día completo.
- **Carga:**
  - No cuenta proyectos terminados ni cancelados.
  - Con filtro de proyecto, muestra solo a los miembros de ese proyecto.
  - Lo que falta se reparte de lunes a viernes desde hoy hasta el límite, no desde el inicio. Una tarea vencida y abierta carga todo lo que falta en la semana actual y se informa aparte como `horas_atrasadas` (aprobado por el usuario).
  - En escritorio necesita scroll horizontal por debajo de unos 1440 px: la columna de personas queda fija.
  - No descuenta feriados: lo dice la leyenda.
- **Tablero en vivo:** junta los cambios en 500 ms, espera si hay un arrastre en curso y no refresca sin conexión.
- **`package-lock.json`:** `npm run lock:regenerar` perdió los binarios de Linux y Mac. Se partió del lock del commit anterior, se sumaron los paquetes nuevos con `--package-lock-only` y se recuperaron los 27 binarios. Revisá el lock después de usar el script.

## Pendientes abiertos

- Producción sería en una VM de Oracle. [FALTA: definir la base de datos de producción.] No entra en las 5 fases.
- `docs/fases/fase_1_setup_auth.md` sigue diciendo `[auth.email] enable_signup = false`. No sirve: ver "Desvíos".
- [FALTA: SMTP de producción, para recuperar contraseña.]
- La tarjeta "Proyectos" del inicio muestra hasta 8 activos, sin enlace a "ver todos" adentro. Lo mismo "Próximos plazos": 8 tareas.
- [FALTA: quién es el primer Admin real y qué proyectos se cargan al arrancar.]
- `npm run lock:regenerar` pierde los binarios opcionales de otras plataformas: hay que arreglar el script antes de la próxima dependencia.
- La carga no sabe de feriados ni de licencias. [FALTA: decidir si se cargan feriados por empresa.]
- Decidir si el colaborador ve las dependencias de su tarea en solo lectura.
