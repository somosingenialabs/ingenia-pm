# 0001 · Producción en Netlify + Supabase en la nube

**Estado:** aceptada, 2026-11-24.
**Reemplaza a:** el plan de una VM de Oracle de `docs/despliegue.md` (preparado el 2026-11-08, nunca desplegado).

## Contexto

Las 5 fases del plan están terminadas y falta salir a producción. Lo preparado hasta ahora era una VM de Oracle con la app en Docker detrás de Caddy, y una decisión abierta sobre la base: Supabase en la nube o self-hosted en la misma VM.

Nada de eso llegó a correr: el `Dockerfile` no se construyó, los scripts de `infra/` no se ejecutaron y no hay datos reales en ningún lado. Cambiar de rumbo ahora no implica migrar nada.

## Decisión

1. **La app corre en Netlify**, con su adaptador de Next.js: las rutas del servidor, las Server Actions y `proxy.ts` se convierten en funciones serverless. Netlify construye y publica solo al mergear a `main`.
2. **La base, Auth, Realtime y Storage van en Supabase en la nube**, con un proyecto propio para Ingenia PM.
3. **Hay dos proyectos de Supabase:**
   - **Producción:** solo migraciones, sin seed, con datos reales.
   - **Staging:** migraciones y seed de `supabase/seed/`. Es la base de los deploy previews de Netlify (la versión de prueba que se arma por cada pull request).
4. **Un deploy preview nunca apunta a producción.** Código sin revisar no toca datos reales.
5. **El CI no cambia:** sigue usando Supabase local en el runner y no necesita secretos de producción.
6. **Las migraciones se aplican a mano** con `supabase db push`, primero en staging y después en producción. Automatizarlo queda para otra decisión.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| VM de Oracle + Supabase self-hosted | Hay que mantener unos 10 contenedores, sus versiones y los respaldos. Postgres y la app compiten por la memoria de la VM, y Oracle puede recuperar VMs Always Free ociosas |
| VM de Oracle + Supabase en la nube | Resuelve la base, pero sigue habiendo que mantener la VM, Docker, Caddy, certificados y actualizaciones del sistema para servir una sola app |

## Consecuencias

**A favor**

- Sin servidores propios: Netlify y Supabase se encargan de HTTPS, actualizaciones y escalado.
- Un preview por pull request, para probar contra staging antes de mergear.
- Los respaldos diarios de la base los da el plan de Supabase. [FALTA: confirmar plan, retención y precio.]

**En contra, y qué se hace**

- **Dependemos de dos terceros.** Si hace falta volver a una VM, el `Dockerfile` y `infra/` quedan en el historial de git (commit `e4c93aa`).
- **Las funciones de Netlify tienen un tiempo máximo.** [FALTA: confirmar el límite del plan.] Hay que medir las pantallas de Analítica en staging antes de salir.
- **La latencia entre la función y la base suma en cada pantalla.** Las dos tienen que estar en la región más cercana posible. [FALTA: confirmar si el plan de Netlify deja elegir la región de las funciones.]
- **`supabase/config.toml` no se aplica a la nube.** Auth, el hook `custom_access_token`, los esquemas expuestos, SMTP y las redirecciones se configuran a mano en el panel de cada proyecto, con la lista de la fase 6.
- **Staging es público y tiene los usuarios del seed con contraseña conocida.** Lo acepta porque no tiene ni va a tener datos reales. Nunca se carga ahí un respaldo de producción.
- **Costo:** [FALTA: precios actuales de Netlify y Supabase para el uso esperado.] Staging puede ir en el plan gratis. Producción pasa a un plan pago antes de cargar datos reales, porque el plan gratis pausa el proyecto tras una semana sin uso y no trae respaldos.

## Qué se ejecuta

`docs/fases/fase_6_netlify_supabase.md`.
