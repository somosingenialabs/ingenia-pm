-- =====================================================================
-- Ingenia PM · Migración 2: dominio
-- Proyectos, tareas, dependencias, historial, comentarios y horas.
--
-- Las FK compuestas (organizacion_id, x) impiden que una fila apunte a otra
-- empresa, aunque se adivine un id. Las personas no se borran: se desactivan
-- con miembros.activo = false.
--
-- Los triggers BEFORE de una tabla corren por orden alfabético de nombre: por
-- eso llevan número. Los helpers app.proyectos_* nacen en la migración de RLS;
-- plpgsql los resuelve al ejecutar.
-- auth.uid() nulo = no viene de un usuario (seed, tareas internas).
-- =====================================================================

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
    creado_por      uuid default auth.uid() references public.perfiles (id) on delete set null,
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

-- ---------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------
create index proyectos_org_estado_idx on public.proyectos (organizacion_id, estado) where eliminado_en is null;
create index proyecto_miembros_usuario_idx on public.proyecto_miembros (usuario_id, proyecto_id);
create index tareas_tablero_idx on public.tareas (organizacion_id, proyecto_id, estado, posicion) where eliminado_en is null;
create index tareas_asignado_idx on public.tareas (organizacion_id, asignado_id, estado) where eliminado_en is null;
create index tareas_fecha_limite_idx on public.tareas (organizacion_id, fecha_limite) where eliminado_en is null;
create index tarea_dependencias_depende_idx on public.tarea_dependencias (depende_de_id);
create index tarea_historial_tarea_idx on public.tarea_historial_estados (organizacion_id, tarea_id, cambiado_en);
create index comentarios_tarea_idx on public.comentarios (tarea_id, creado_en, id);
create index registros_tiempo_usuario_idx on public.registros_tiempo (organizacion_id, usuario_id, fecha);
create index registros_tiempo_proyecto_idx on public.registros_tiempo (organizacion_id, proyecto_id, fecha);
create index registros_tiempo_tarea_idx on public.registros_tiempo (tarea_id);

-- ---------------------------------------------------------------------
-- Proyectos
-- ---------------------------------------------------------------------

-- Cambiar eliminado_en exige Admin. La empresa y quién lo creó no cambian, y creado_por
-- lo pone la base: de ese dato depende que quien crea quede como miembro.
create or replace function app.proteger_proyecto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' then
        if (select auth.uid()) is not null then
            new.creado_por := (select auth.uid());
        end if;
        return new;
    end if;

    if new.organizacion_id <> old.organizacion_id then
        raise exception 'La empresa de un proyecto no se puede cambiar.';
    end if;
    if (select auth.uid()) is not null then
        if new.creado_por is distinct from old.creado_por then
            raise exception 'Quién creó el proyecto no se puede cambiar.';
        end if;
        if new.eliminado_en is distinct from old.eliminado_en and app.rol_actual() is distinct from 'admin' then
            raise exception 'Solo un Admin puede borrar o restaurar un proyecto.';
        end if;
    end if;
    return new;
end;
$$;

create trigger proyectos_10_proteger before insert or update on public.proyectos
    for each row execute function app.proteger_proyecto();
create trigger proyectos_90_actualizado before update on public.proyectos
    for each row execute function app.marcar_actualizado();

-- El responsable y quien crea el proyecto quedan como miembros.
create or replace function app.proyecto_agregar_miembros()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.proyecto_miembros (organizacion_id, proyecto_id, usuario_id)
    select new.organizacion_id, new.id, u.id
    from unnest(array[new.responsable_id, case when tg_op = 'INSERT' then new.creado_por end]) as u (id)
    where u.id is not null
    on conflict do nothing;
    return null;
end;
$$;

create trigger proyectos_agregar_miembros_alta after insert on public.proyectos
    for each row execute function app.proyecto_agregar_miembros();
create trigger proyectos_agregar_miembros_responsable after update of responsable_id on public.proyectos
    for each row when (new.responsable_id is distinct from old.responsable_id)
    execute function app.proyecto_agregar_miembros();

-- ---------------------------------------------------------------------
-- Tareas
-- ---------------------------------------------------------------------

-- El RLS filtra filas, no columnas: quien no es gestor solo cambia estado, posicion y
-- descripcion. Se listan las columnas protegidas porque completada_en y actualizado_en
-- las calculan otros triggers.
create or replace function app.proteger_tarea()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.proyecto_id <> old.proyecto_id or new.organizacion_id <> old.organizacion_id then
        raise exception 'El proyecto y la empresa de una tarea no se pueden cambiar.';
    end if;

    if (select auth.uid()) is null or new.proyecto_id in (select app.proyectos_gestionados()) then
        return new;
    end if;

    if (new.titulo, new.prioridad, new.asignado_id, new.fecha_inicio, new.fecha_limite,
        new.horas_estimadas, new.creado_en, new.creado_por, new.eliminado_en)
       is distinct from
       (old.titulo, old.prioridad, old.asignado_id, old.fecha_inicio, old.fecha_limite,
        old.horas_estimadas, old.creado_en, old.creado_por, old.eliminado_en) then
        raise exception 'Solo podés cambiar el estado, la posición y la descripción de esta tarea.';
    end if;
    return new;
end;
$$;

-- Solo se valida si cambia: sacar a alguien del proyecto no puede trabar las tareas
-- que ya tenía asignadas.
create or replace function app.tarea_validar_asignado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if new.asignado_id is null
       or (tg_op = 'UPDATE' and new.asignado_id is not distinct from old.asignado_id) then
        return new;
    end if;

    if not exists (
        select 1 from public.proyecto_miembros pm
        where pm.proyecto_id = new.proyecto_id and pm.usuario_id = new.asignado_id
    ) then
        raise exception 'La persona asignada no es miembro del proyecto.';
    end if;
    return new;
end;
$$;

-- completada_en lo calcula siempre la base: nadie lo escribe a mano. Al crear una tarea ya
-- hecha se respeta la fecha que traiga (el seed carga historia con fechas pasadas).
create or replace function app.tarea_cambio_estado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if tg_op = 'INSERT' then
        if new.estado = 'hecha' then
            new.completada_en := coalesce(new.completada_en, now());
        else
            new.completada_en := null;
        end if;
    elsif new.estado = old.estado then
        new.completada_en := old.completada_en;
    elsif new.estado = 'hecha' then
        new.completada_en := now();
    else
        new.completada_en := null;
    end if;
    return new;
end;
$$;

create or replace function app.tarea_registrar_estado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.tarea_historial_estados
        (organizacion_id, proyecto_id, tarea_id, estado_anterior, estado_nuevo, cambiado_por)
    values (
        new.organizacion_id, new.proyecto_id, new.id,
        case when tg_op = 'UPDATE' then old.estado end,
        new.estado,
        (select auth.uid())
    );
    return null;
end;
$$;

create trigger tareas_10_proteger before update on public.tareas
    for each row execute function app.proteger_tarea();
create trigger tareas_20_validar_asignado before insert or update on public.tareas
    for each row execute function app.tarea_validar_asignado();
create trigger tareas_30_cambio_estado before insert or update on public.tareas
    for each row execute function app.tarea_cambio_estado();
create trigger tareas_90_actualizado before update on public.tareas
    for each row execute function app.marcar_actualizado();
create trigger tareas_registrar_estado_alta after insert on public.tareas
    for each row execute function app.tarea_registrar_estado();
create trigger tareas_registrar_estado_cambio after update of estado on public.tareas
    for each row when (new.estado is distinct from old.estado)
    execute function app.tarea_registrar_estado();

-- ---------------------------------------------------------------------
-- Dependencias
-- ---------------------------------------------------------------------

-- Mismo proyecto y sin ciclos. El lock por proyecto evita que dos inserciones simultáneas,
-- válidas cada una por su lado, armen un ciclo entre las dos.
create or replace function app.dependencia_validar()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
    v_proyecto       uuid;
    v_proyecto_otra  uuid;
begin
    select t.proyecto_id into v_proyecto from public.tareas t where t.id = new.tarea_id;
    select t.proyecto_id into v_proyecto_otra from public.tareas t where t.id = new.depende_de_id;
    if v_proyecto is null or v_proyecto_otra is null then
        raise exception 'La tarea de la dependencia no existe.';
    end if;
    if v_proyecto <> v_proyecto_otra then
        raise exception 'Las dos tareas de una dependencia tienen que ser del mismo proyecto.';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(v_proyecto::text, 0));

    if exists (
        with recursive previas (id) as (
            select new.depende_de_id
            union
            select d.depende_de_id
            from public.tarea_dependencias d
            join previas p on d.tarea_id = p.id
        )
        select 1 from previas where id = new.tarea_id
    ) then
        raise exception 'Esa dependencia arma un ciclo entre tareas.';
    end if;
    return new;
end;
$$;

create trigger tarea_dependencias_validar before insert on public.tarea_dependencias
    for each row execute function app.dependencia_validar();

-- ---------------------------------------------------------------------
-- Comentarios
-- ---------------------------------------------------------------------
create or replace function app.comentario_proteger()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.tarea_id <> old.tarea_id or new.autor_id <> old.autor_id or new.organizacion_id <> old.organizacion_id then
        raise exception 'La tarea, el autor y la empresa de un comentario no se pueden cambiar.';
    end if;
    new.creado_en := old.creado_en;
    if new.cuerpo <> old.cuerpo then
        new.editado_en := now();
    else
        new.editado_en := old.editado_en;
    end if;
    return new;
end;
$$;

create trigger comentarios_proteger before update on public.comentarios
    for each row execute function app.comentario_proteger();

-- ---------------------------------------------------------------------
-- Horas
-- ---------------------------------------------------------------------

-- proyecto_id sale siempre de la tarea. El RLS corre después de este trigger, así que
-- también valida el proyecto copiado y no uno que venga del pedido.
create or replace function app.registro_completar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_zona text;
begin
    select t.proyecto_id, o.zona_horaria into new.proyecto_id, v_zona
    from public.tareas t
    join public.organizaciones o on o.id = t.organizacion_id
    where t.id = new.tarea_id and t.organizacion_id = new.organizacion_id;
    if not found then
        raise exception 'La tarea no existe en esta empresa.';
    end if;

    if (tg_op = 'INSERT' or new.fecha <> old.fecha)
       and new.fecha > (now() at time zone v_zona)::date then
        raise exception 'No se pueden cargar horas con fecha futura.';
    end if;
    return new;
end;
$$;

create trigger registros_tiempo_10_completar before insert or update on public.registros_tiempo
    for each row execute function app.registro_completar();
create trigger registros_tiempo_90_actualizado before update on public.registros_tiempo
    for each row execute function app.marcar_actualizado();

-- Los triggers no necesitan execute de quien dispara: nadie los llama a mano.
revoke execute on all functions in schema app from public, anon;
revoke execute on function
    app.miembros_proteger(), app.crear_perfil(), app.proteger_proyecto(), app.proyecto_agregar_miembros(),
    app.proteger_tarea(), app.tarea_validar_asignado(), app.tarea_cambio_estado(), app.tarea_registrar_estado(),
    app.dependencia_validar(), app.comentario_proteger(), app.registro_completar()
    from authenticated;
