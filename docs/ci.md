# CI

Corre en cada pull request a `main` y en cada push a `main`. No usa secretos.

| Job | Qué corre | Para qué |
|---|---|---|
| `calidad` | `npm ci`, lint y tipos | Avisa rápido de un error de estilo o de tipos |
| `base` | Supabase local, `npm run test:sql`, `npm test`, `npm run build` y `npm run e2e` | Lo mismo que "Verificar" del README, pero en el runner |

## Cómo leer una falla

- **Tests SQL:** el nombre del archivo y el motivo salen en el log. Se reproduce con `npx supabase db reset` y `npm run test:sql`.
- **Vitest:** parte necesita Supabase local (`src/lib/data/integracion.test.ts`). Si falla ahí, revisá que el `.env.local` armado por el job tenga claves.
- **e2e:** al fallar, el job sube el artefacto `reporte-playwright` (7 días) con el reporte y las trazas. Se abre con `npx playwright show-report`.

## Reglas

- Las dependencias entran con `npm ci`. Nunca `npm install`: ver `README.md` y `scripts/regenerar-lock.mjs`.
- Para una acción nueva, fijá la versión exacta, como las que ya están.
- El job `base` levanta Supabase sin Studio, imgproxy, edge runtime, logs, vector ni pooler. Si una fase nueva usa alguno, sacalo de `-x` en `.github/workflows/ci.yml`.
