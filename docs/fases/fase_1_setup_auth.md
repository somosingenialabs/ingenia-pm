# Fase 1 · Setup, diseño base y Supabase Auth

**Rol:** desarrollador senior de Next.js + Supabase. Ejecutá esta fase completa y frená al cerrarla.

**Antes de empezar, leé:** `docs/estado.md` y `docs/arquitectura.md`, secciones 3 y 4.

## Objetivo

Proyecto andando con marco visual, login por mail y contraseña, y rutas protegidas. Todavía no hay tablas de negocio ni roles: eso es la fase 2.

**Termina con:** una persona de prueba entra, ve `/inicio` con el marco en claro y oscuro, a 375 px y en escritorio, sale, y sin sesión no puede ver ninguna pantalla interna.

## Fuera de esta fase

Tablas propias (ni siquiera `perfiles`), roles, invitaciones, registro público, pantallas de negocio.

## Paso 0 · Verificaciones. Si algo falla, frená y preguntá

1. **Repo.** Corré `git rev-parse --show-toplevel`. Si falla o devuelve una carpeta de arriba, todavía no hay repo propio: pedí el sí, y hacé `git init -b main` en esta carpeta. Verificá que ahora devuelva esta carpeta. No crees el remoto: el nombre propuesto es `somosingenialabs/ingenia-pm`, y se crea solo con un sí explícito.
2. **Docker.** `docker --version` y `docker info`.
   - **Recomendado:** que el usuario instale Docker Desktop, que usa WSL2 y puede pedir reiniciar. Dale los pasos y esperá. No lo instales vos.
   - **Si no puede:** proyecto de desarrollo en Supabase nube, creado por el usuario. Usá `supabase link` y `supabase db push`, cargá el seed desde el SQL Editor y anotá el desvío en `docs/estado.md`. Es solo para desarrollo, nunca con datos reales.
3. **Node.** `node --version`, 22.12 o más.
4. **crm-base.** Ubicalo según "Ruta a crm-base" en `CLAUDE.md` y verificá que exista `src/proxy.ts`.

## Paso 1 · Proyecto

**No uses `create-next-app`:** se niega a correr con `CLAUDE.md` en la carpeta, y además te traería otras versiones. Copiá de `<crm-base>` y adaptá.

| Copiar | Adaptar |
|---|---|
| `package.json` | `name: ingenia-pm`, `dev: next dev -p 3100`. Dejá las versiones como están. Sacá las dependencias que no aparecen en la lista de abajo |
| `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `components.json`, `vitest.config.ts`, `playwright.config.ts` | Puerto 3100 en Playwright |
| `.gitignore`, `.env.example` | Puerto de la URL local (paso 2) |
| `src/lib/config.ts`, `src/lib/utils.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts` | Tal cual. `database.types.ts` arranca vacío hasta la fase 2 |
| `src/proxy.ts` | `PUBLICAS = ["/ingresar", "/recuperar", "/nueva-clave", "/invitacion", "/auth"]`. Sacá la rama `/dev/` si no copiás el catálogo |
| `src/components/ui/*`, `estado/*`, `layout/*`, `bento/*`, `src/hooks/use-mobile.ts` | Sacá toda referencia al CRM: oportunidades, cuentas, pipeline, acciones rápidas de venta |
| `src/app/globals.css`, `providers.tsx`, `layout.tsx`, `manifest.ts`, `global-error.tsx`, `not-found.tsx` | Tokens de la sección 4. Título "Ingenia PM" |

Antes de copiar un componente, revisá sus imports. Lo que dependa de un módulo del CRM se adapta o no se copia.

**Dependencias de esta fase:** `next`, `react`, `react-dom`, `@supabase/ssr`, `@supabase/supabase-js`, `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `lucide-react`, `next-themes`, `sonner`, `cmdk`, `zod`, `react-hook-form`, `@hookform/resolvers`. De desarrollo, las de `crm-base`.

Las otras se instalan en la fase que las usa. Si un componente copiado pide una que no está, no la agregues: decidí si ese componente hace falta ahora.

**Íconos:** copiá `docs/assets/ingenia-favicon.svg` como `src/app/icon.svg`. No redibujes el logo.

## Paso 2 · Supabase local

`npx supabase init` (`npx.cmd` en PowerShell; o copiá `config.toml` de `crm-base` y adaptá):

- `project_id = "ingenia-pm"`, explícito: la ruta tiene espacios.
- **Mové todos los puertos 543xx a 553xx** (API 55321, DB 55322, Studio 55323, mails 55324, etc.). `crm-base` usa los de fábrica y los dos deben poder convivir.
- `[auth]`: `site_url = "http://localhost:3100"`, `additional_redirect_urls = ["http://localhost:3100/auth/callback"]`.
- `[auth] enable_signup = false` y `[auth.email] enable_signup = false`: no hay registro público. Las personas entran por invitación (fase 3).
- `[auth.email] enable_confirmations = false`.
- `[db.seed] sql_paths = ["./seed/*.sql"]`.

`supabase/seed/10_usuarios.sql`: copiá el patrón de `crm-base` (ids fijos y `extensions.crypt`), con estos usuarios. `pgcrypto` ya viene en `extensions`.

| Id | Mail | Nombre | Rol que tendrá en F2 |
|---|---|---|---|
| `00000000-0000-4000-a000-000000000001` | `admin.a@prueba.test` | Lucía Fernández | Admin, empresa A |
| `...a000-000000000002` | `pm1.a@prueba.test` | Martín Gómez | PM, A |
| `...a000-000000000003` | `pm2.a@prueba.test` | Carla Ruiz | PM, A |
| `...a000-000000000004` | `colab1.a@prueba.test` | Diego Paz | Colaborador, A |
| `...a000-000000000005` | `colab2.a@prueba.test` | Sofía Ledesma | Colaborador, A |
| `...a000-000000000006` | `colab3.a@prueba.test` | Tomás Aguirre | Colaborador, A |
| `00000000-0000-4000-b000-000000000001` | `admin.b@prueba.test` | Ramiro Ortiz | Admin, empresa B |
| `...b000-000000000002` | `colab1.b@prueba.test` | Paula Medina | Colaborador, B |

Son personas ficticias. La contraseña de desarrollo va en el README.

Completá `.env.local` con lo que muestra `npx.cmd supabase status`. No lo imprimas en la conversación.

## Paso 3 · Auth

| Ruta | Qué hace |
|---|---|
| `(auth)/ingresar` | Mail y contraseña con React Hook Form + Zod. Error genérico: no revela si el mail existe |
| `(auth)/recuperar` | Pide el mail y llama a `resetPasswordForEmail`. Siempre responde lo mismo |
| `auth/callback/route.ts` | Canjea el `code` por sesión y redirige a un destino **relativo y validado**. Nunca una URL externa recibida por parámetro |
| `(auth)/nueva-clave` | Define la contraseña nueva, 10 caracteres o más |
| `(app)/layout.tsx` | Marco de `crm-base` con navegación: Inicio, Proyectos, Mis tareas, Calendario, Carga, Horas, Analítica, Configuración |
| `(app)/inicio` | Solo saludo con el mail y estado vacío. Se reemplaza en la fase 3 |

- Para validar la sesión en el servidor usá siempre `getUser()`, nunca `getSession()`: el primero verifica con Auth, el segundo confía en la cookie.
- Las entradas de navegación sin pantalla todavía quedan ocultas por una lista en `navegacion.ts`. Cada fase prende las suyas.
- Salir: Server Action con `signOut()` que redirige a `/ingresar`.
- Tema: claro, oscuro y sistema con `next-themes`.

## Paso 4 · Tests y cierre

**E2E (`e2e/auth.spec.ts`, escritorio y 375 px):**
- Sin sesión, `/inicio` redirige a `/ingresar`.
- Contraseña incorrecta muestra el error genérico.
- Ingreso correcto llega a `/inicio`, y salir vuelve a `/ingresar`.
- Con sesión, `/ingresar` redirige a `/inicio`.
- `/auth/callback?next=https://ejemplo.test` no sale del sitio.
- Todo control interactivo mide 44 px o más.

**README:** requisitos, `npm install`, `supabase start`, `npm run dev`, usuarios de prueba.

**Para cerrar, en verde y mostrando la salida:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e`.

Mostrá capturas de `/ingresar` e `/inicio` en claro, oscuro y 375 px. Actualizá `docs/estado.md`. Proponé el commit, no lo hagas sin un sí.
