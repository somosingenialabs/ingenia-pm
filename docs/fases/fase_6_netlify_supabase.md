# Fase 6 · Producción en Netlify + Supabase

**Rol:** desarrollador senior con criterio de operaciones. Ejecutá la sesión que te toque y frená al cerrarla.

**Antes de empezar, leé:** `docs/estado.md`, `docs/decisiones/0001-netlify-supabase.md` y, de `docs/despliegue.md`, los pasos 1 (lo que necesita la app de la base), 2 (orden de las migraciones), 5 (SMTP) y 6 (primer Admin). El resto de esa guía es de la VM de Oracle y se reemplaza en esta fase.

## Objetivo

Tener Ingenia PM andando en producción sin servidores propios. La app va en Netlify y la base en Supabase en la nube. Cada pull request tiene su preview contra una base de staging.

**Termina con:** la app en el dominio de producción, con HTTPS, contra el Supabase de producción y con el primer Admin real adentro. Además, previews andando contra staging, un respaldo propio probado y `docs/despliegue.md` reescrito.

## Fuera de esta fase

Cambios de funcionalidad, mails de invitación, feriados, aplicar migraciones desde el CI, Edge Functions de Supabase, monitoreo y alertas.

**Dependencias de esta fase:** ninguna. Netlify instala solo su adaptador de Next.js al construir. Si resulta que hay que sumarlo a `package.json`, pedilo antes.

## Tres sesiones

Esta fase toca servicios externos y necesita datos de personas, así que se ejecuta en tres sesiones. Cada una cierra actualizando `docs/estado.md` con lo que dejó y lo que falta.

| Sesión | Pasos | Necesita antes |
|---|---|---|
| A · Repo | 1 | Nada |
| B · Staging | 2 | Cuentas de Netlify y Supabase, y acceso de Netlify a la org `somosingenialabs` de GitHub |
| C · Producción | 3, 4 y 5 | Todos los datos de la tabla de abajo |

**Datos que tiene que dar una persona.** Ninguno se inventa: si falta, se deja `[FALTA: ...]` y se frena el paso que lo necesita.

| Dato | Para qué paso |
|---|---|
| [FALTA: quién crea y paga las cuentas de Netlify y Supabase, y con qué mail] | 2 |
| [FALTA: plan de Supabase para producción, con precio, retención de respaldos y región] | 3 |
| [FALTA: plan de Netlify, límite de tiempo de las funciones y si deja elegir región] | 2 |
| [FALTA: dominio y subdominio de la app] | 3 |
| [FALTA: proveedor de SMTP, cuenta y dominio remitente con SPF y DKIM] | 3 |
| [FALTA: nombre, mail y empresa del primer Admin] | 3 |
| [FALTA: dónde se guarda el respaldo propio y quién lo revisa] | 4 |

## Paso 1 · Adaptar el repo (sesión A)

Trabajá en la rama `deploy/netlify-supabase` o en otra nueva desde `main`.

- **`next.config.ts`:** sacá `output: "standalone"` y su comentario, que eran para la imagen Docker. No toques las cabeceras ni la CSP (la lista de orígenes a los que el navegador puede conectarse). Ya arman `https://` y `wss://` con `NEXT_PUBLIC_SUPABASE_URL`.
- **`netlify.toml` nuevo:**

```toml
[build]
  command = "npm run build"

[build.environment]
  NODE_VERSION = "24"
```

  No pongas `publish` ni el plugin a mano: el adaptador los resuelve. Si la documentación vigente de Netlify dice otra cosa, seguí la documentación y anotalo como desvío.
- **Borrá** `Dockerfile`, `.dockerignore`, `infra/Caddyfile`, `infra/backup-db.sh` e `infra/probar-restauracion.sh`. Quedan en el historial (commit `e4c93aa`). Revisá `.gitattributes`: si solo existía por los scripts de `infra/`, sacá esas líneas.
- **Buscá referencias que quedan colgadas:** `grep` de `standalone`, `Dockerfile`, `Caddy`, `infra/` y `Oracle` en `src`, `docs`, `README.md` y `.github`. Arreglá código y README. Los docs se reescriben en el paso 5.
- **El CI no se toca.**

**Cierre de la sesión A, en verde y mostrando la salida:** `npm run test:sql`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e`.

## Paso 2 · Staging y previews (sesión B)

### Supabase de staging

1. Crear el proyecto `ingenia-pm-staging` en la región más cercana a Argentina disponible.
2. Aplicar las 8 migraciones con el seed. La cadena de conexión es secreta: no la dejes en el historial de la terminal ni en un archivo del repo.

```bash
npx supabase db push --db-url "$DATABASE_URL_STAGING" --include-seed
npx supabase migration list --db-url "$DATABASE_URL_STAGING"
```

   Verificá que `--include-seed` tome los archivos de `supabase/seed/` según `[db.seed]` de `config.toml`. Si no los toma, cargalos con `psql` en el orden que define `config.toml`.
3. Configurar en el panel lo que en local hace `config.toml`:

| Qué | Dónde | Valor |
|---|---|---|
| Hook de token | Authentication > Hooks | Custom Access Token → `public.custom_access_token_hook`. Sin esto, el RLS devuelve todo vacío |
| Esquemas expuestos | Settings > API | `public` y `analitica` |
| Registro público | Authentication > Providers / Sign In | Cerrado. El proveedor de mail queda habilitado (ver "Desvíos" de la fase 1 en `docs/estado.md`) |
| Contraseña mínima | Authentication | 10 |
| URL del sitio y redirecciones | Authentication > URL Configuration | La URL de Netlify del sitio, más un comodín para previews y ramas, terminado en `/**`. Tiene que cubrir `/auth/callback` |
| Realtime | - | Lo agrega la migración 5. Verificá que `tareas` y `comentarios` estén en la publicación `supabase_realtime` |
| Bucket `avatares` | Storage | Lo crea la migración 4. Verificá que exista |

   Los nombres del menú pueden haber cambiado: buscá el equivalente y anotá el camino real para el paso 5.

### Sitio de Netlify

1. Crear el sitio desde el repo `somosingenialabs/ingenia-pm`, con `main` como rama de producción y previews para cada pull request.
2. Cargar las variables por contexto:

| Variable | Alcance | Producción | Previews y ramas |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Build y funciones | Staging hasta el paso 3 | Staging |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build y funciones | Staging hasta el paso 3 | Staging |
| `SUPABASE_SECRET_KEY` | **Solo funciones**, marcada como secreta | Staging hasta el paso 3 | Staging |

   Las `NEXT_PUBLIC_*` quedan dentro del JavaScript y de la CSP al construir: si cambian, hay que volver a construir. Si el build falla porque pide `SUPABASE_SECRET_KEY`, es un error del código, porque la clave secreta no se lee al construir. Arreglalo en el código: no le des la clave al build.
3. Mirá el log del primer build: tiene que instalar respetando `package-lock.json`, como `npm ci` (ver `README.md`, "nunca `npm install`").

### Probar en un preview

Abrí un pull request de prueba y, en su preview, con escritorio y 375 px:

- [ ] `/ingresar` con un usuario del seed. La sesión sobrevive a recargar y a dejar la pestaña 1 hora (lo maneja `proxy.ts`).
- [ ] Consola del navegador sin errores de CSP.
- [ ] `curl -I` a la URL del preview muestra `Content-Security-Policy`, `X-Frame-Options` y las demás cabeceras de `next.config.ts`.
- [ ] Crear un proyecto y una tarea, moverla en el tablero y verla moverse en vivo en otra pestaña (Realtime por `wss://`).
- [ ] Invitar con el enlace y aceptar con otro usuario.
- [ ] Iniciar y detener el temporizador.
- [ ] `/analitica` con 26 semanas: anotá cuánto tarda la respuesta del servidor. Si se acerca al límite de las funciones, frená y avisá.
- [ ] Subir un avatar.
- [ ] Un usuario sin rol de Admin no ve `/configuracion`, y una llamada directa a la API con su token no trae datos de otra empresa.

**Cierre de la sesión B:** la lista de arriba completa, con capturas. Lo que no anduvo va a `docs/estado.md`.

## Paso 3 · Producción (sesión C)

1. **Supabase de producción:** crear el proyecto `ingenia-pm` en el plan y la región decididos. Aplicar las migraciones **sin seed**:

```bash
npx supabase db push --db-url "$DATABASE_URL_PRODUCCION"
npx supabase migration list --db-url "$DATABASE_URL_PRODUCCION"
```

   Los tests SQL cuentan filas del seed: **nunca se corren contra producción.**
2. **Panel:** repetir la tabla del paso 2. La URL del sitio es el dominio de producción, con `https`, y las redirecciones solo aceptan ese dominio (sin comodines de previews).
3. **SMTP:** cargar el proveedor en Authentication > SMTP y ajustar el límite de mails por hora a un valor de producción. Probar recuperar contraseña con un mail real: el mail llega, no cae en spam y el enlace vuelve a `https://<dominio>/auth/callback`.
4. **Netlify:** cambiar las tres variables del contexto de producción a los valores de producción, agregar el dominio con HTTPS y volver a desplegar `main`.
5. **Primer Admin:** seguir `docs/despliegue.md`, paso 6. Ese SQL nunca se corrió: si falla, corregilo leyendo `20261102022709_plataforma.sql` y anotá el desvío.
6. **Registro cerrado:** un `signUp` con la clave publicable contra producción tiene que fallar.
7. **Repetir la lista del paso 2** contra producción, con el primer Admin y una cuenta de prueba que se borra al terminar.

## Paso 4 · Respaldos (sesión C)

- Anotá qué incluye el plan de Supabase: frecuencia, retención y si permite restaurar a un momento puntual.
- Respaldo propio semanal con `pg_dump` sobre la cadena de conexión, guardado donde se haya decidido. Avatares: [FALTA: decidir si se respaldan los archivos de Storage y cómo.]
- **Prueba de restaurar:** cargar el respaldo en un Postgres descartable que se borra al terminar, y contar filas de `organizaciones`, `miembros`, `proyectos`, `tareas`, `registros_tiempo` y `auth.users`. Nunca en staging ni en la base de desarrollo: son datos reales.
- Anotá la fecha y el resultado de la prueba.

## Paso 5 · Documentación (sesión C)

- **Reescribir `docs/despliegue.md`** para Netlify + Supabase: piezas, variables, los caminos reales del panel, orden de migraciones, primer Admin, SMTP, respaldos, cómo actualizar (migración en staging, después en producción, después merge) y cómo volver atrás un despliegue en Netlify.
- **`docs/estado.md`:** fila de la fase 6, desvíos y "Pendientes abiertos" sin lo que ya se resolvió.
- **`docs/decisiones/0001-netlify-supabase.md`:** completar los `[FALTA]` que se hayan respondido.

## Cierre

**En verde y mostrando la salida:** `npm run test:sql`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e`, y el último build de Netlify en `main`.

Mostrá capturas de `/ingresar`, `/inicio` y `/analitica` en producción, en claro, oscuro y 375 px. Proponé el commit; no lo hagas sin un sí. Crear cuentas, cargar secretos en un panel, apuntar el dominio y cualquier gasto también se piden antes, uno por uno.
