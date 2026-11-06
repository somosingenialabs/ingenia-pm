# Ingenia PM

Gestión de proyectos B2B: tareas, calendario, horas y métricas. Next.js + Supabase.

## Requisitos

- Node.js 22.12 o más
- Docker Desktop abierto (Supabase local corre en contenedores)

## Levantarlo

```bash
npm ci
npx supabase start
```

En Windows con PowerShell usá `npm.cmd` y `npx.cmd`. Usá `npm ci` y no `npm install`: con estas dependencias, npm 11 borra el binario de Windows de `rolldown` y Vitest deja de arrancar. Para agregar una dependencia: sumala a `package.json`, corré `npm run lock:regenerar` (conserva los binarios de Linux y Mac) y después `npm ci`.

Copiá `.env.example` a `.env.local` y completalo con lo que muestra `npx supabase status`:

| Variable | Dato de `supabase status` |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (`http://127.0.0.1:55321`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key |
| `SUPABASE_SECRET_KEY` | Secret key. Solo servidor, nunca en un componente de cliente |
| `DATABASE_URL` | Ya viene en `.env.example`. Solo para `npm run test:sql` |

```bash
npm run dev
```

La app queda en <http://localhost:3100>. Los puertos de Supabase son 553xx para convivir con `crm-base`: Studio en <http://127.0.0.1:55323>, y los mails de desarrollo (por ejemplo, el de recuperar contraseña) en <http://127.0.0.1:55324>.

## Usuarios de prueba

Son personas ficticias. Contraseña de desarrollo de todos: `prueba1234`. Para volver al estado inicial: `npx supabase db reset`.

| Mail | Nombre | Rol desde la fase 2 |
|---|---|---|
| `admin.a@prueba.test` | Lucía Fernández | Admin, empresa A |
| `pm1.a@prueba.test` | Martín Gómez | PM, A |
| `pm2.a@prueba.test` | Carla Ruiz | PM, A |
| `colab1.a@prueba.test` | Diego Paz | Colaborador, A |
| `colab2.a@prueba.test` | Sofía Ledesma | Colaborador, A |
| `colab3.a@prueba.test` | Tomás Aguirre | Colaborador, A |
| `admin.b@prueba.test` | Ramiro Ortiz | Admin, empresa B |
| `colab1.b@prueba.test` | Paula Medina | Colaborador, B |

No hay registro público: las personas entran por invitación, desde Configuración > Miembros. El enlace se copia y se manda por donde quieran, sin SMTP.

## Verificar

```bash
npx supabase db reset
npm run test:sql
npm run lint
npm run typecheck
npm test
npm run build
npm run e2e
```

`npm run e2e` usa el build y Supabase local, y la primera vez pide `npx playwright install chromium`. `npm test` también necesita Supabase local: una parte corre las consultas contra el seed. Los e2e dejan datos de prueba, y los tests SQL cuentan filas del seed: por eso el orden de arriba arranca con `db reset`.
