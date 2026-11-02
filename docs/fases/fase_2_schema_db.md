# Fase 2 · Esquema relacional y RLS

**Rol:** especialista en PostgreSQL y seguridad multi-empresa. Ejecutá esta fase completa y frená al cerrarla.

**Antes de empezar, leé:** `docs/estado.md` y `docs/arquitectura.md`, secciones 1 y 2.

**Referencia de patrón (solo lectura), en `<crm-base>`:** `supabase/migrations/20261101000100_plataforma.sql` y `20261101000300_rls.sql`, `supabase/tests/aislamiento.test.sql`, `src/lib/auth/`.

## Objetivo

Esquema completo con RLS, seed y tests que prueban que nadie ve ni toca lo que no le corresponde. Es la base de todo lo demás: lo que quede flojo acá se paga en cada pantalla.

**Termina con:** `supabase db reset` limpio, tests SQL en verde, tipos generados y `obtenerContexto()` andando en `/inicio` con el rol real.

## Fuera de esta fase

Pantallas y funciones de negocio: `mover`, temporizador, analítica, `eliminar_comentario` y publicación de Realtime nacen en sus fases.

## Migraciones

Usá `npx.cmd supabase migration new <nombre>`. Tres archivos:

1. `plataforma`: copiá de `crm-base` y adaptá.
2. `dominio`: tablas, índices y triggers.
3. `rls`: políticas.

### 1. Plataforma

Copiá `organizaciones`, `perfiles`, `miembros`, `invitaciones`, `app.marcar_actualizado`, `app.org_actual`, `app.rol_actual`, `app.es_miembro`, `app.tiene_rol`, `app.usuario_es_miembro`, `app.comparte_organizacion`, `app.crear_perfil` y `public.custom_access_token_hook`.

Cambios respecto de `crm-base`:

- `perfiles`: sin `token_calendario`.
- `organizaciones`: sin `moneda`.
- `miembros.rol`: `check (rol in ('admin', 'pm', 'colaborador'))`, default `colaborador`.
- `miembros`: sumá `horas_semanales numeric(4,1) not null default 40 check (horas_semanales between 0 and 80)`. Es la capacidad que usan las fases 4 y 5.
- `invitaciones.rol`: mismos tres roles.
- Esquemas: `app` y `analitica`, igual que `crm-base`.
- Trigger en `miembros`: no se puede dejar una empresa sin Admin activo.
- `config.toml`: activá el hook. Sin esto `org_id` no llega al token y **todo** el RLS devuelve vacío:

```toml
[auth.hook.custom_access_token]
enabled = true
uri = "pg-functions://postgres/public/custom_access_token_hook"
```

### 2. Dominio

Las FK compuestas `(organizacion_id, x)` impiden que una fila apunte a otra empresa, aunque se adivine un id. Por eso los padres llevan `unique (organizacion_id, id)`. Las personas no se borran: se desactivan con `miembros.activo = false`.

```sql
create table public.proyectos (
    id                   uuid primary key default gen_random_uuid(),
    organizacion_id      uuid not null references public.organizaciones (id) on delete cascade,
    nombre               text not null check (char_length(trim(nombre)) between 2 and 120),
    descripcion          text check (char_length(descripcion) <= 5000),
    cliente              text check (char_length(cliente) <= 120),
    estado               text not null default 'activo'
                         check (estado in ('planificado', 'activo', 'en_pausa', 'terminado', 'cancelado')),
    responsable_id       uuid not null,
    fecha_inicio         date,
    fecha_fin_objetivo   date,
    horas_presupuestadas numeric(8,2) check (horas_presupuestadas >= 0),
    creado_en            timestamptz not null default now(),
    creado_por           uuid references public.perfiles (id) on delete set null,
    actualizado_en       timestamptz not null default now(),
    eliminado_en         timestamptz,
    unique (organizacion_id, id),
    foreign key (organizacion_id, responsable_id) references public.miembros (organizacion_id, usuario_id),
    check (fecha_fin_objetivo is null or fecha_inicio is null or fecha_fin_objetivo >= fecha_inicio)
);

create table public.proyecto_miembros (
    organizacion_id uuid not null,
    proyecto_id     uuid not null,
    usuario_id      uuid not null,
    creado_en       timestamptz not null default now(),
    primary key (proyecto_id, usuario_id),
    foreign key (organizacion_id, proyecto_id) references public.proyectos (organizacion_id, id) on delete cascade,
    foreign key (organizacion_id, usuario_id) references public.miembros (organizacion_id, usuario_id)
);

create table public.tareas (
    id              uuid primary key default gen_random_uuid(),
    organizacion_id uuid not null,
    proyecto_id     uuid not null,
    titulo          text not null check (char_length(trim(titulo)) between 2 and 200),
    descripcion     text check (char_length(descripcion) <= 10000),
    estado          text not null default 'por_hacer'
                    check (estado in ('por_hacer', 'en_curso', 'en_revision', 'hecha', 'cancelada')),
    prioridad       text not null default 'media' check (prioridad in ('baja', 'media', 'alta', 'urgente')),
    asignado_id     uuid,
    fecha_inicio    date,
    fecha_limite    date,
    horas_estimadas numeric(7,2) check (horas_estimadas >= 0),
    -- Orden en la columna del tablero: al mover se usa el punto medio entre vecinas.
    -- numeric, y no double, para no quedarse sin precisión.
    posicion        numeric not null default 1000,
    completada_en   timestamptz,
    creado_en       timestamptz not null default now(),
    creado_por      uuid references public.perfiles (id) on delete set null,
    actualizado_en  timestamptz not null default now(),
    eliminado_en    timestamptz,
    unique (organizacion_id, id),
    foreign key (organizacion_id, proyecto_id) references public.proyectos (organizacion_id, id),
    foreign key (organizacion_id, asignado_id) references public.miembros (organizacion_id, usuario_id),
    check (fecha_limite is null or fecha_inicio is null or fecha_limite >= fecha_inicio)
);

-- Una sola fila por par: la tarea_id no arranca hasta que termina depende_de_id.
create table public.tarea_dependencias (
    organizacion_id uuid not null,
    tarea_id        uuid not null,
    depende_de_id   uuid not null,
    desfase_dias    int not null default 0 check (desfase_dias between 0 and 365),
    creado_en       timestamptz not null default now(),
    primary key (tarea_id, depende_de_id),
    check (tarea_id <> depende_de_id),
    foreign key (organizacion_id, tarea_id) references public.tareas (organizacion_id, id) on delete cascade,
    foreign key (organizacion_id, depende_de_id) references public.tareas (organizacion_id, id) on delete cascade
);

-- Inmutable. Es la base de las métricas de flujo: sin esto no hay cuellos de botella.
create table public.tarea_historial_estados (
    id              bigint generated always as identity primary key,
    organizacion_id uuid not null,
    proyecto_id     uuid not null,
    tarea_id        uuid not null,
    estado_anterior text,
    estado_nuevo    text not null,
    cambiado_por    uuid references public.perfiles (id) on delete set null,
    cambiado_en     timestamptz not null default now(),
    foreign key (organizacion_id, tarea_id) references public.tareas (organizacion_id, id) on delete cascade
);

create table public.comentarios (
    -- El id lo puede generar el navegador: así la fase 4 reconcilia el comentario
    -- optimista con el evento de Realtime sin duplicarlo.
    id              uuid primary key default gen_random_uuid(),
    organizacion_id uuid not null,
    tarea_id        uuid not null,
    autor_id        uuid not null references public.perfiles (id),
    cuerpo          text not null check (char_length(trim(cuerpo)) between 1 and 5000),
    editado_en      timestamptz,
    creado_en       timestamptz not null default now(),
    eliminado_en    timestamptz,
    foreign key (organizacion_id, tarea_id) references public.tareas (organizacion_id, id) on delete cascade
);

create table public.registros_tiempo (
    id              uuid primary key default gen_random_uuid(),
    organizacion_id uuid not null,
    proyecto_id     uuid not null,   -- lo copia el trigger desde la tarea
    tarea_id        uuid not null,
    usuario_id      uuid not null,
    origen          text not null check (origen in ('temporizador', 'manual')),
    inicio          timestamptz,     -- solo temporizador
    fin             timestamptz,     -- solo temporizador; nulo = corriendo
    minutos         int check (minutos between 1 and 1440),   -- nulo solo si está corriendo
    fecha           date not null,   -- día de la empresa al que imputa
    nota            text check (char_length(nota) <= 500),
    creado_en       timestamptz not null default now(),
    actualizado_en  timestamptz not null default now(),
    foreign key (organizacion_id, tarea_id) references public.tareas (organizacion_id, id),
    foreign key (organizacion_id, usuario_id) references public.miembros (organizacion_id, usuario_id),
    check (
        (origen = 'manual' and inicio is null and fin is null and minutos is not null)
        or (origen = 'temporizador' and inicio is not null and (
            (fin is null and minutos is null) or (fin > inicio and minutos is not null)
        ))
    )
);

-- Un solo temporizador corriendo por persona y empresa.
create unique index registros_tiempo_un_temporizador
    on public.registros_tiempo (organizacion_id, usuario_id) where origen = 'temporizador' and fin is null;
```

**Índices.** Todos empiezan por `organizacion_id`, salvo los que van por una clave ya selectiva:

- `proyectos (organizacion_id, estado) where eliminado_en is null`
- `proyecto_miembros (usuario_id, proyecto_id)`
- `tareas (organizacion_id, proyecto_id, estado, posicion) where eliminado_en is null`
- `tareas (organizacion_id, asignado_id, estado) where eliminado_en is null`
- `tareas (organizacion_id, fecha_limite) where eliminado_en is null`
- `tarea_dependencias (depende_de_id)`
- `tarea_historial_estados (organizacion_id, tarea_id, cambiado_en)`
- `comentarios (tarea_id, creado_en, id)`
- `registros_tiempo (organizacion_id, usuario_id, fecha)`
- `registros_tiempo (organizacion_id, proyecto_id, fecha)`
- `registros_tiempo (tarea_id)`

**Triggers.** Todos con `set search_path = ''` y nombres calificados.

| Trigger | Tabla | Qué hace |
|---|---|---|
| `app.marcar_actualizado` | proyectos, tareas, registros_tiempo | `actualizado_en` |
| `app.proyecto_agregar_miembros` | proyectos, after insert/update de responsable | Agrega a `responsable_id` y `creado_por` a `proyecto_miembros` (`security definer`, `on conflict do nothing`) |
| `app.proteger_proyecto` | proyectos | Cambiar `eliminado_en` exige Admin. `organizacion_id` inmutable |
| `app.proteger_tarea` | tareas, before update | **El RLS filtra filas, no columnas.** Si quien edita no es gestor, rechaza cualquier cambio fuera de `estado`, `posicion`, `descripcion`. `proyecto_id` y `organizacion_id` inmutables para todos |
| `app.tarea_validar_asignado` | tareas, before insert/update | `asignado_id` debe estar en `proyecto_miembros` de ese proyecto |
| `app.tarea_cambio_estado` | tareas, before update | Pone `completada_en = now()` al pasar a `hecha`, y null al salir |
| `app.tarea_registrar_estado` | tareas, after insert/update de estado | Inserta en el historial (`security definer`) con `auth.uid()` |
| `app.dependencia_validar` | tarea_dependencias, before insert | Mismo proyecto en ambas tareas. Rechaza ciclos con CTE recursiva, con `lock` por proyecto para que dos inserciones simultáneas no armen uno |
| `app.comentario_proteger` | comentarios, before update | `tarea_id`, `autor_id` y `organizacion_id` inmutables. Si cambia `cuerpo`, pone `editado_en` |
| `app.registro_completar` | registros_tiempo, before insert/update | Copia `proyecto_id` de la tarea. Rechaza `fecha` futura respecto de la zona de la empresa |

### 3. RLS

Helpers en `app`, `stable`, `security definer`, con `set search_path = ''`, y devueltos como conjunto para que Postgres los calcule una vez por consulta y no una vez por fila:

```sql
-- Proyectos que quien llama puede ver en la empresa activa.
create function app.proyectos_visibles() returns setof uuid ...
    -- admin o pm: todos los de org_actual(). colaborador: los de proyecto_miembros.
-- Proyectos donde quien llama es gestor: admin, o pm que es miembro.
create function app.proyectos_gestionados() returns setof uuid ...
```

Uso en políticas: `proyecto_id in (select app.proyectos_visibles())`. Otorgá `execute` a `authenticated`, y revocá a `public` y `anon`.

**Condición común de todas las tablas de negocio:** `organizacion_id = (select app.org_actual()) and (select app.rol_actual()) is not null`.

**No filtres `eliminado_en` en ninguna política de lectura.** Hacerlo rompe el borrado lógico: Postgres exige que la fila nueva pase la política de lectura, y Realtime no avisaría a los demás. Filtra la capa de datos en la fase 3.

| Tabla | select | insert | update | delete |
|---|---|---|---|---|
| organizaciones | miembro | nadie | admin | nadie |
| perfiles | propio o comparte empresa | trigger | propio | nadie |
| miembros | miembro | admin | admin | nadie |
| invitaciones | admin | admin | admin | nadie |
| proyectos | `id` en visibles | admin o pm | `id` en gestionados | nadie |
| proyecto_miembros | proyecto en visibles | proyecto en gestionados | nadie | proyecto en gestionados |
| tareas | proyecto en visibles | proyecto en gestionados | gestionados o `asignado_id = auth.uid()` | nadie |
| tarea_dependencias | visibles | gestionados | nadie | gestionados |
| tarea_historial_estados | visibles | nadie (trigger) | nadie | nadie |
| comentarios | tarea de proyecto visible | ídem y `autor_id = auth.uid()` | `autor_id = auth.uid()` | nadie (RPC en F4) |
| registros_tiempo | proyecto en visibles | ídem y `usuario_id = auth.uid()` | propio, o admin | propio, o admin |

Una tarea con `proyecto en visibles` se resuelve con subconsulta a `tareas` dentro de un helper `app.tareas_visibles()`. Revisá que no se forme una recursión de RLS.

`revoke all on all tables in schema public from anon;`

## Seed

- `20_organizaciones.sql`: Empresa A y Empresa B (ficticias), miembros según la tabla de la fase 1, `organizacion_activa_id` en cada perfil.
- `30_proyectos.sql`: en A, 3 proyectos (uno activo con `pm1`, uno activo con `pm2`, uno terminado), 30 tareas repartidas en todos los estados, con fechas relativas a `current_date`, para que nunca queden viejas. Sumá 3 dependencias, comentarios y horas manuales. `colab3` queda fuera de un proyecto para probar visibilidad. En B, 1 proyecto con tareas.
- Ids fijos para lo que usen los tests.

## Tests SQL

Node y `pg` (dependencia de desarrollo de esta fase), no `docker exec psql`: así corre igual en local y en nube.

`scripts/test-sql.mjs` lee `DATABASE_URL`, ejecuta cada `supabase/tests/*.test.sql` y sale con error si alguno falla. `npm run test:sql`. Sin metacomandos de `psql` en los archivos.

Patrón de `crm-base`: `begin`, `pg_temp.como(usuario, org)`, comprobaciones en bloques `do`, `rollback`. Mínimo:

**`aislamiento.test.sql`, por cada tabla de negocio:** usuario de A no ve, no edita y no borra nada de B, ni adivinando ids. Insertar con `organizacion_id` de B falla. Una FK cruzada falla.

**`roles.test.sql`, la matriz de la sección 2:**
- Colaborador no ve el proyecto donde no es miembro, ni sus tareas, comentarios u horas.
- Colaborador cambia `estado` de su tarea, pero no `titulo`, `fecha_limite` ni `asignado_id` (trigger). No toca tareas ajenas.
- PM ve todo. Edita solo donde es miembro.
- Colaborador no crea proyectos ni tareas. PM crea un proyecto y queda como miembro.
- Solo Admin marca `eliminado_en` en un proyecto.
- Un usuario no comenta ni carga horas a nombre de otro.
- Miembro desactivado no ve nada, aunque su token siga vigente.

**`dominio.test.sql`:**
- Mover una tarea a `hecha` pone `completada_en` y agrega fila al historial. Reabrirla lo limpia.
- Nadie modifica el historial.
- Una dependencia en ciclo A→B→C→A falla. Entre proyectos falla.
- Asignar a alguien que no es miembro del proyecto falla.
- Segundo temporizador corriendo falla. Horas con fecha futura fallan.
- No se puede dejar la empresa sin Admin.
- Hook: el token sale con `org_id` para miembro activo, y sin él para miembro inactivo.

## Next.js

- `npm run db:tipos` (como `crm-base`, con `public,analitica`).
- `src/lib/auth/tipos.ts`, `contexto.ts`, `permisos.ts`: adaptá de `crm-base` a los tres roles. Funciones: `puedeCrearProyecto`, `puedeGestionarProyecto(rol, esMiembro)`, `puedeEditarCamposTarea`, `puedeConfigurar`, `veMetricasDeEquipo`. Test unitario de la matriz.
- `src/app/(app)/inicio`: usá `obtenerContexto()` y mostrá nombre, empresa y rol.
- Sin empresa activa: pantalla simple que dice "Tu usuario no tiene una empresa activa. Pedile acceso a un administrador", con botón de salir. Selector de empresa, más adelante.

## Cierre

**En verde y mostrando la salida:** `supabase db reset`, `npm run test:sql`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e`.

Actualizá `docs/estado.md` con la lista de helpers y RPC disponibles. Proponé el commit, no lo hagas sin un sí.
