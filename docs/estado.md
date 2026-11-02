# Estado de Ingenia PM

Cada fase, al cerrar, actualiza este archivo. Es lo único que la sesión siguiente lee de la anterior: tiene que alcanzar.

**Fase siguiente:** 3 · `docs/fases/fase_3_core_ui_bento.md`

| Fase | Estado | Fecha | Notas para la que sigue |
|---|---|---|---|
| 1. Setup y auth | Terminada | 2026-11-01 | Supabase local en puertos 553xx (`npx.cmd supabase start`). El hook `custom_access_token` quedó comentado en `config.toml`: se prende cuando exista la función. `database.types.ts` tiene el esquema vacío: regeneralo con `npm run db:tipos`, que hoy solo pide `public`. `src/lib/data/comun.ts` solo tiene `Resultado` y `Ref`. La sesión se valida con `obtenerUsuario()` de `src/lib/auth/sesion.ts`. El marco todavía no recibe rol ni empresa |
| 2. Esquema y RLS | Terminada | 2026-11-01 | Ver "Disponible desde la fase 2". `obtenerContexto()` da usuario, empresa y rol; sin empresa activa manda a `/sin-empresa`. `navegacion.ts` todavía no filtra por rol. `src/lib/data/comun.ts` sigue con `Resultado` y `Ref`: sumá lo demás ahí, no lo pises. **Dependencias:** nunca `npm install`; ver `README.md` |
| 3. UI base y Bento | Pendiente | | |
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

## Pendientes abiertos

- Producción sería en una VM de Oracle. [FALTA: definir la base de datos de producción.] No entra en las 5 fases.
- `docs/fases/fase_1_setup_auth.md` sigue diciendo `[auth.email] enable_signup = false`. No sirve: ver "Desvíos".
- [FALTA: SMTP de producción, para recuperar contraseña.]
- [FALTA: quién es el primer Admin real y qué proyectos se cargan al arrancar.]
