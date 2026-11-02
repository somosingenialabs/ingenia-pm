# Estado de Ingenia PM

Cada fase, al cerrar, actualiza este archivo. Es lo único que la sesión siguiente lee de la anterior: tiene que alcanzar.

**Fase siguiente:** 2 · `docs/fases/fase_2_schema_db.md`

| Fase | Estado | Fecha | Notas para la que sigue |
|---|---|---|---|
| 1. Setup y auth | Terminada | 2026-11-01 | Supabase local en puertos 553xx (`npx.cmd supabase start`). El hook `custom_access_token` quedó comentado en `config.toml`: se prende cuando exista la función. `database.types.ts` tiene el esquema vacío: regeneralo con `npm run db:tipos`, que hoy solo pide `public`. `src/lib/data/comun.ts` solo tiene `Resultado` y `Ref`. La sesión se valida con `obtenerUsuario()` de `src/lib/auth/sesion.ts`. El marco todavía no recibe rol ni empresa |
| 2. Esquema y RLS | Pendiente | | |
| 3. UI base y Bento | Pendiente | | |
| 4. Calendario y realtime | Pendiente | | |
| 5. Horas y analítica | Pendiente | | |

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

## Pendientes abiertos

- [FALTA: ejecutar por primera vez el SQL de la fase 2. Se escribió sin base disponible, así que todavía no corrió.]
- Producción sería en una VM de Oracle. [FALTA: definir la base de datos de producción.] No entra en las 5 fases.
- [FALTA: crear el repo remoto `somosingenialabs/ingenia-pm`. Espera un sí explícito.]
- `docs/fases/fase_1_setup_auth.md` sigue diciendo `[auth.email] enable_signup = false`. No sirve: ver "Desvíos".
- [FALTA: SMTP de producción, para recuperar contraseña.]
- [FALTA: quién es el primer Admin real y qué proyectos se cargan al arrancar.]
