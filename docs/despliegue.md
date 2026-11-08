# Salida a producción en una VM de Oracle

Estado: **preparada, no desplegada ni probada en una VM**. Nada de esto se corrió contra un servidor real. Todo lo que no se sabe va como `[FALTA: ...]` y está repetido en "Pendientes abiertos" de `docs/estado.md`.

Referencia: `gym-crm/infra/` (docker-compose, Caddy, `backup-db.sh`) y su `README-despliegue.md`. Esa guía ya cubre crear la VM de Oracle, abrir puertos, instalar Docker y poner Caddy. Acá solo va lo que cambia para Ingenia PM.

## Piezas de este repo

| Archivo | Para qué |
|---|---|
| `next.config.ts` | `output: "standalone"`: servidor mínimo para la imagen |
| `Dockerfile` | Imagen de la app (Node 24, arm64 y amd64). Instala con `npm ci` |
| `.dockerignore` | Deja afuera `.env*`, `docs`, `e2e` y los respaldos |
| `infra/Caddyfile` | HTTPS automático y reparto por nombre |
| `infra/backup-db.sh` | Respaldo de la base y de Storage (solo Supabase self-hosted) |
| `infra/probar-restauracion.sh` | Prueba de restaurar en un Postgres descartable |

No hay `docker-compose.yml` de la app todavía. Si Supabase es self-hosted, el compose se arma partiendo del oficial de Supabase (como hizo `gym-crm`) y se le suma el servicio `app` del paso 3.

## 1. Decisión: dónde vive la base

[FALTA: decisión de una persona. La comparación de abajo es de partida; los datos marcados hay que confirmarlos.]

| | Supabase en la nube | Supabase self-hosted en la misma VM |
|---|---|---|
| Esfuerzo | Bajo: se crea el proyecto y se aplican las migraciones | Alto: hay que mantener ~10 contenedores y sus versiones |
| Respaldos | Los diarios vienen según el plan. [FALTA: confirmar plan, retención y precio.] | A cargo nuestro: `infra/backup-db.sh` y copias fuera de la VM |
| Actualizaciones | Las hace Supabase | A mano, con respaldo antes |
| Costo | [FALTA: precio del plan que alcance para el uso real.] | VM Always Free de Oracle si alcanza. [FALTA: confirmar tamaño de VM y límites.] |
| Memoria | No usa la de la VM | Postgres, Auth, Realtime y Storage compiten con la app por RAM |
| Riesgo | Depende de un tercero. [FALTA: región y dónde deben estar los datos.] | Oracle puede recuperar VMs Always Free ociosas (ver la guía de gym-crm) |
| `config.toml` | **No se aplica.** Auth, SMTP y hook se configuran en el panel de Supabase | **No se aplica** tampoco: se pasan como variables de Auth en el compose |

Lo que necesita la app de la base, en cualquiera de los dos casos:

- Esquemas `public` y `analitica` expuestos en la API (`[api] schemas` de `supabase/config.toml`).
- El hook `custom_access_token` activo y apuntando a `public.custom_access_token_hook`. Sin él, el RLS devuelve vacío. Self-hosted: `GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED=true` y `GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI=pg-functions://postgres/public/custom_access_token_hook`. En la nube: Authentication > Hooks.
- Registro público cerrado (`enable_signup = false` en `[auth]`) y mínimo de contraseña 10. El mail sí queda habilitado (`[auth.email] enable_signup = true`): ver "Desvíos" en `docs/estado.md`.
- Realtime activo. La migración 5 suma `comentarios` y `tareas` a la publicación `supabase_realtime`.
- `site_url` y redirecciones (`/auth/callback`) con el dominio real, con https.

## 2. Orden para aplicar las 8 migraciones

Siempre contra una base **vacía** y en este orden (es el orden de los nombres de archivo). Nunca se edita una ya aplicada.

1. `20261102022709_plataforma.sql`: organizaciones, perfiles, miembros, invitaciones, helpers `app.*` y el hook de token.
2. `20261102022713_dominio.sql`: proyectos, tareas, dependencias, historial, comentarios, registros de tiempo.
3. `20261102022717_rls.sql`: políticas de RLS.
4. `20261103120000_invitaciones_y_avatares.sql`: RPC de invitaciones y el bucket `avatares`.
5. `20261104120000_calendario_realtime.sql`: calendario, dependencias y Realtime.
6. `20261105120000_temporizador.sql`: temporizador.
7. `20261105130000_metricas.sql`: esquema `analitica` y sus 11 funciones.
8. `20261106120000_metricas_ajustes.sql`: ajuste de `consumo_presupuesto`.

Cómo aplicarlas:

```bash
# Desde una máquina con el repo, apuntando a la base nueva. La cadena es secreta: no la dejes en el historial.
npx supabase db push --db-url "$DATABASE_URL_PRODUCCION"
```

`db push` solo aplica las que faltan y las anota en `supabase_migrations.schema_migrations`. **No corre `supabase/seed/`**: es solo de desarrollo y trae usuarios `@prueba.test` con clave conocida. Nunca lo cargues en producción.

Después de aplicar:

1. `npx supabase migration list --db-url "$DATABASE_URL_PRODUCCION"` tiene que mostrar las 8 como aplicadas.
2. Los tests SQL cuentan filas del seed: **no los corras contra producción**. Corrélos contra una copia (una base nueva con las migraciones y el seed) con `DATABASE_URL=<copia> npm run test:sql`.
3. Mirá en el panel de la base que el bucket `avatares` existe y que `analitica` está expuesto.

[FALTA: probar este orden en una base real de producción. Hoy solo está probado con `supabase start` y en el CI.]

## 3. Variables de la app

| Variable | Cuándo | Qué es |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Build** y arranque | URL pública de la API. Queda dentro del JavaScript y de la CSP: si cambia, se reconstruye la imagen |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Build** y arranque | Clave publicable. La protege el RLS |
| `SUPABASE_SECRET_KEY` | Solo al arrancar | Clave secreta. Nunca en el build, ni en un log, ni en un componente de cliente |

Construir la imagen (con Docker abierto, solo cuando haga falta):

```bash
docker build --build-arg NEXT_PUBLIC_SUPABASE_URL=https://api.ejemplo.com --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<clave publicable> -t ingenia-pm .
```

Servicio para el compose, junto a Caddy:

```yaml
  app:
    build:
      context: ..
      args:
        NEXT_PUBLIC_SUPABASE_URL: https://api.${DOMINIO}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${ANON_KEY}
    environment:
      NEXT_PUBLIC_SUPABASE_URL: https://api.${DOMINIO}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${ANON_KEY}
      SUPABASE_SECRET_KEY: ${SERVICE_ROLE_KEY}
    restart: unless-stopped
    mem_limit: 1g
```

Con Supabase en la nube, la URL es la del proyecto y no hay `api.${DOMINIO}`.

[FALTA: nombre del dominio y de los subdominios. El `Caddyfile` usa `app.` y `api.` como ejemplo.]

## 4. VM de Oracle

Seguí la guía de `gym-crm/infra/README-despliegue.md`, pasos 1 a 4 y 6: crear la VM, abrir 80 y 443 en la Security List y en `iptables`, swap, Docker y DNS. Cambiá el nombre de la VM y los subdominios.

- [FALTA: tamaño de la VM. gym-crm usa 2 OCPU y 12 GB Ampere; con Supabase en la nube alcanza con menos.]
- Con Supabase self-hosted, los límites de memoria de gym-crm sirven de punto de partida: Postgres 3 GB, la app 1 GB.
- No abras 5432, 3000 ni 8000 a internet.

## 5. SMTP

Auth manda el mail de recuperar contraseña. Las invitaciones **no** mandan mail: la app copia el enlace y se envía por donde quieran (ver `README.md`).

- [FALTA: proveedor y cuenta de SMTP de producción (host, puerto, usuario, remitente).]
- [FALTA: dominio remitente con SPF y DKIM, para que no caiga en spam.]
- Nube: Authentication > SMTP Settings. Self-hosted: variables `GOTRUE_SMTP_*` del servicio Auth.
- Ajustá `email_sent` (límite de mails por hora) y `sign_in_sign_ups`. En desarrollo están en 100 y 1000 solo para que los e2e no se frenen. [FALTA: valores de producción.]
- Probalo: pedí recuperar contraseña con un mail real y verificá que llega y que el enlace vuelve a `https://<dominio>/auth/callback`.

## 6. Primer Admin

Sin seed, la base arranca vacía y nadie puede entrar: no hay registro público ni invitación sin un Admin. El primer Admin se crea una sola vez a mano.

[FALTA: nombre, mail y empresa del primer Admin, y qué proyectos se cargan al arrancar.]

1. Crear el usuario con la clave secreta (sale confirmado, sin mail). Nube: Authentication > Users > Add user. Self-hosted:

```bash
read -s -p "Contraseña (mínimo 10): " PASS; echo
curl -sS -X POST "https://api.<dominio>/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"<mail>\",\"password\":\"$PASS\",\"email_confirm\":true,\"user_metadata\":{\"nombre_completo\":\"<Nombre Apellido>\"}}"
unset PASS
```

El trigger `app.crear_perfil` crea el perfil solo.

2. En el editor SQL de la base (rol `postgres`), crear la empresa y hacerlo Admin:

```sql
with org as (
  insert into public.organizaciones (nombre) values ('<Nombre de la empresa>') returning id
), alta as (
  insert into public.miembros (organizacion_id, usuario_id, rol)
  select org.id, p.id, 'admin' from org, public.perfiles p where p.email = '<mail>'
  returning organizacion_id, usuario_id
)
update public.perfiles p set organizacion_activa_id = alta.organizacion_id
from alta where p.id = alta.usuario_id;
```

3. Entrá a la app con ese mail. Si cae en `/sin-empresa`, cerrá sesión y volvé a entrar: el token se renueva y recién ahí el hook agrega la empresa.
4. Desde ahí, el resto del equipo entra por invitación (Configuración > Miembros).

[FALTA: verificar este SQL contra una base real. Está escrito leyendo `20261102022709_plataforma.sql` y no se corrió.]

## 7. Levantar la app

1. Aplicar las migraciones (paso 2) y crear el primer Admin (paso 6).
2. `docker compose up -d --build app caddy`.
3. Abrir `https://app.<dominio>/ingresar`. Tiene que salir el formulario con candado.
4. La CSP viene del build, con la URL de `NEXT_PUBLIC_SUPABASE_URL`. Si la pantalla no puede hablar con la API, revisá la consola del navegador.
5. Probar a mano: ingresar, crear un proyecto y una tarea, invitar a alguien con el enlace, recuperar contraseña, y que el tablero se actualice en vivo en dos pestañas (Realtime por `wss://`).

[FALTA: probar la imagen en la VM real, también en arm64.]

## 8. Respaldos y prueba de restaurar

[FALTA: frecuencia, dónde se guardan fuera de la VM y quién los revisa.] Propuesta de partida: diario de madrugada, 14 días en la VM, y una copia semanal fuera de Oracle.

**Nube:** [FALTA: qué incluye el plan (copias diarias, restauración a un punto en el tiempo).] Además, un `pg_dump` por la cadena de conexión, una vez por semana, a un lugar propio.

**Self-hosted:**

```bash
sh infra/backup-db.sh
ls -lh infra/backups/
```

Por cron, todos los días a las 3:30:

```
30 3 * * * cd /home/ubuntu/ingenia-pm/infra && sh backup-db.sh >> /home/ubuntu/backup-pm.log 2>&1
```

`pg_dumpall` no incluye los archivos de Storage (avatares): por eso el script también comprime `volumes/storage`.

**Una copia en la misma VM no alcanza.** Bajala fuera de Oracle una vez por semana.

**La prueba de restaurar.** Hacela antes de salir y después cada tanto: un respaldo que nunca se restauró no es un respaldo.

```bash
IMAGEN_POSTGRES=<imagen del servicio db del compose> sh infra/probar-restauracion.sh
```

Levanta un Postgres descartable, carga el respaldo más nuevo y cuenta filas de `organizaciones`, `miembros`, `proyectos`, `tareas`, `registros_tiempo` y `auth.users`. Esos números tienen que coincidir con los de producción.

Para restaurar de verdad en una instalación nueva, con los mismos secretos: `gunzip -c backups/db_<fecha>.sql.gz | docker compose exec -T db psql -U supabase_admin -d postgres`, y descomprimir `storage_<fecha>.tar.gz` dentro de `volumes/`.

[FALTA: correr la prueba de restaurar una vez con datos reales y anotar acá la fecha y el resultado.]

## 9. Actualizar

- **Código:** `git pull` y `docker compose up -d --build app`. Si cambió `NEXT_PUBLIC_*`, se reconstruye sí o sí.
- **Migraciones nuevas:** respaldo primero, después `db push` (paso 2). Nunca se edita una migración aplicada.
- Un cambio de empresa activa rige al renovar el token: la persona tiene que volver a entrar.

## Qué no se pudo verificar

- Nada de esta guía se corrió en una VM de Oracle ni en arm64.
- El `Dockerfile` no se construyó (esta PC no usa Docker por la memoria compartida).
- `next build` con `output: "standalone"` lo verifica el CI de este PR.
- Los scripts de `infra/` y el SQL del primer Admin no se ejecutaron.
