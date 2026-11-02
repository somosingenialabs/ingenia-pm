# Estado de Ingenia PM

Cada fase, al cerrar, actualiza este archivo. Es lo único que la sesión siguiente lee de la anterior: tiene que alcanzar.

**Fase siguiente:** 4 · `docs/fases/fase_4_calendar_realtime.md`

| Fase | Estado | Fecha | Notas para la que sigue |
|---|---|---|---|
| 1. Setup y auth | Terminada | 2026-11-01 | Supabase local en puertos 553xx (`npx.cmd supabase start`). El hook `custom_access_token` quedó comentado en `config.toml`: se prende cuando exista la función. `database.types.ts` tiene el esquema vacío: regeneralo con `npm run db:tipos`, que hoy solo pide `public`. `src/lib/data/comun.ts` solo tiene `Resultado` y `Ref`. La sesión se valida con `obtenerUsuario()` de `src/lib/auth/sesion.ts`. El marco todavía no recibe rol ni empresa |
| 2. Esquema y RLS | Terminada | 2026-11-01 | Ver "Disponible desde la fase 2". `obtenerContexto()` da usuario, empresa y rol; sin empresa activa manda a `/sin-empresa`. `navegacion.ts` todavía no filtra por rol. `src/lib/data/comun.ts` sigue con `Resultado` y `Ref`: sumá lo demás ahí, no lo pises. **Dependencias:** nunca `npm install`; ver `README.md` |
| 3. UI base y Bento | Terminada | 2026-11-02 | Ver "Disponible desde la fase 3". Comentarios: completá `SeccionComentarios` en `src/components/tareas/secciones-reservadas.tsx`. El tablero ya tiene `useOptimistic` en `vistas-proyecto.tsx`: realtime tiene que refrescar esos datos, no pisarlos. Sumá tarjetas solo en `TARJETAS_INICIO` |
| 4. Calendario y realtime | Pendiente | | |
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

## Pendientes abiertos

- Producción sería en una VM de Oracle. [FALTA: definir la base de datos de producción.] No entra en las 5 fases.
- `docs/fases/fase_1_setup_auth.md` sigue diciendo `[auth.email] enable_signup = false`. No sirve: ver "Desvíos".
- [FALTA: SMTP de producción, para recuperar contraseña.]
- La tarjeta "Proyectos" del inicio muestra hasta 8 activos, sin enlace a "ver todos" adentro. Lo mismo "Próximos plazos": 8 tareas.
- [FALTA: quién es el primer Admin real y qué proyectos se cargan al arrancar.]
