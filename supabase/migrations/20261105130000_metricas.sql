-- =====================================================================
-- Ingenia PM · Migración 7: métricas de analítica
--
-- Todas son security invoker: el RLS de quien llama sigue filtrando, y un
-- colaborador además recibe solo lo suyo (app.metricas_usuarios). Agrupan en
-- la zona de la empresa y devuelven n: cuántos datos hay detrás de cada número.
--
-- Criterios comunes:
-- - Parámetros: p_desde, p_hasta (fechas de la empresa, inclusive), p_proyectos y
--   p_usuarios (nulos = todos). Rango máximo 370 días, como la carga.
-- - Una tarea es de la persona que la tiene asignada.
-- - Se excluye lo borrado (tareas y proyectos con eliminado_en) y lo cancelado
--   (tareas canceladas y proyectos cancelados). Excepción: las horas registradas
--   (horas_por_periodo, utilizacion) cuentan aunque la tarea se haya cancelado
--   después, porque ese trabajo se hizo igual.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Ayudas
-- ---------------------------------------------------------------------

-- Zona horaria de la empresa activa.
create or replace function app.zona_empresa()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
    select coalesce(
        (select o.zona_horaria from public.organizaciones o where o.id = app.org_actual()),
        'America/Argentina/Buenos_Aires'
    )
$$;

-- Personas que puede pedir quien llama. Colaborador: solo él, pida lo que pida. Sin esto, por RPC
-- vería los números de sus compañeros de proyecto. Sin rol (no es miembro): nadie.
create or replace function app.metricas_usuarios(p_usuarios uuid[])
returns uuid[]
language sql
stable
security invoker
set search_path = ''
as $$
    select case
        when app.rol_actual() is null then array[]::uuid[]
        when app.rol_actual() = 'colaborador' then array[(select auth.uid())]
        else p_usuarios
    end
$$;

-- Inicio del día p_fecha en la zona de la empresa, como timestamptz. El período [p_desde, p_hasta]
-- es [app.inicio_del_dia(p_desde), app.inicio_del_dia(p_hasta + 1)): así un filtro sobre
-- completada_en o cambiado_en usa el índice, en vez de convertir cada fila a fecha.
create or replace function app.inicio_del_dia(p_fecha date, p_zona text)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
    select p_fecha::timestamp at time zone p_zona
$$;

create or replace function app.metricas_validar_rango(p_desde date, p_hasta date)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
    if p_desde is null or p_hasta is null or p_hasta < p_desde then
        raise exception 'El rango de fechas no es válido.';
    end if;
    if p_hasta - p_desde > 370 then
        raise exception 'El rango de fechas es demasiado largo.';
    end if;
end;
$$;

revoke execute on function app.zona_empresa(), app.metricas_usuarios(uuid[]), app.metricas_validar_rango(date, date),
    app.inicio_del_dia(date, text)
    from public, anon;
grant execute on function app.zona_empresa(), app.metricas_usuarios(uuid[]), app.metricas_validar_rango(date, date),
    app.inicio_del_dia(date, text)
    to authenticated;

-- Para las métricas sobre tareas hechas, que filtran por fecha de cierre.
create index tareas_completadas_idx on public.tareas (organizacion_id, completada_en)
    where estado = 'hecha' and eliminado_en is null;
-- tiempo_en_estado lee el historial por tarea y fecha (con id para desempatar): con este índice el
-- lead no tiene que ordenar nada, y estado_nuevo sale del índice mismo. Cubre al índice anterior
-- (organizacion_id, tarea_id, cambiado_en), que se reemplaza.
create index tarea_historial_pasos_idx on public.tarea_historial_estados (organizacion_id, tarea_id, cambiado_en, id)
    include (estado_nuevo);
drop index public.tarea_historial_tarea_idx;

-- ---------------------------------------------------------------------
-- Horas
-- ---------------------------------------------------------------------

-- Horas por semana (lunes), proyecto y persona, según la fecha del registro. Sin el temporizador
-- que está corriendo. n: cantidad de registros.
create or replace function analitica.horas_por_periodo(
    p_desde date, p_hasta date, p_proyectos uuid[] default null, p_usuarios uuid[] default null)
returns table (periodo date, proyecto_id uuid, usuario_id uuid, horas numeric, n int)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
    v_usuarios uuid[] := app.metricas_usuarios(p_usuarios);
begin
    perform app.metricas_validar_rango(p_desde, p_hasta);
    return query
    select date_trunc('week', r.fecha)::date, r.proyecto_id, r.usuario_id,
           round(sum(r.minutos) / 60.0, 2), count(*)::int
    from public.registros_tiempo r
    join public.tareas t on t.id = r.tarea_id
    join public.proyectos p on p.id = r.proyecto_id
    where r.organizacion_id = (select app.org_actual())
      and r.minutos is not null
      and r.fecha between p_desde and p_hasta
      and t.eliminado_en is null and p.eliminado_en is null
      and (p_proyectos is null or r.proyecto_id = any (p_proyectos))
      and (v_usuarios is null or r.usuario_id = any (v_usuarios))
    group by 1, 2, 3
    order by 1, 2, 3;
end;
$$;

-- Horas registradas sobre capacidad: horas_semanales x días hábiles del período / 5.
-- SIN DESCONTAR FERIADOS NI LICENCIAS: la pantalla lo tiene que decir. Una fila por persona activa,
-- aunque no haya cargado nada (para ver también a quien está libre). Con filtro de proyecto: los
-- miembros de esos proyectos, y solo sus horas en esos proyectos. n: cantidad de registros.
create or replace function analitica.utilizacion(
    p_desde date, p_hasta date, p_proyectos uuid[] default null, p_usuarios uuid[] default null)
returns table (usuario_id uuid, horas numeric, capacidad numeric, porcentaje numeric, n int)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
    v_usuarios uuid[] := app.metricas_usuarios(p_usuarios);
    v_habiles  int;
begin
    perform app.metricas_validar_rango(p_desde, p_hasta);
    select count(*) into v_habiles
    from generate_series(p_desde, p_hasta, interval '1 day') d
    where extract(isodow from d) < 6;

    return query
    with personas as (
        select m.usuario_id, m.horas_semanales * v_habiles / 5.0 as capacidad
        from public.miembros m
        where m.organizacion_id = (select app.org_actual())
          and m.activo
          and (v_usuarios is null or m.usuario_id = any (v_usuarios))
          and (p_proyectos is null or exists (
              select 1 from public.proyecto_miembros pm
              where pm.usuario_id = m.usuario_id and pm.proyecto_id = any (p_proyectos)))
    ),
    registradas as (
        select r.usuario_id, sum(r.minutos) / 60.0 as horas, count(*) as cantidad
        from public.registros_tiempo r
        join public.tareas t on t.id = r.tarea_id
        join public.proyectos p on p.id = r.proyecto_id
        where r.organizacion_id = (select app.org_actual())
          and r.minutos is not null
          and r.fecha between p_desde and p_hasta
          and t.eliminado_en is null and p.eliminado_en is null
          and (p_proyectos is null or r.proyecto_id = any (p_proyectos))
        group by 1
    )
    select x.usuario_id,
           round(coalesce(g.horas, 0), 2),
           round(x.capacidad, 2),
           case when x.capacidad > 0 then round(coalesce(g.horas, 0) / x.capacidad * 100, 1) end,
           coalesce(g.cantidad, 0)::int
    from personas x
    left join registradas g on g.usuario_id = x.usuario_id
    order by x.usuario_id;
end;
$$;

comment on function analitica.utilizacion(date, date, uuid[], uuid[]) is
    'Horas registradas / (horas_semanales x días hábiles / 5). No descuenta feriados ni licencias.';

-- ---------------------------------------------------------------------
-- Estimación y tiempos de las tareas
-- ---------------------------------------------------------------------

-- Horas reales / estimadas, sobre tareas hechas en el período (fecha de cierre en la zona de la
-- empresa), con horas_estimadas > 0 y al menos un registro cerrado. Las horas son las de toda la
-- tarea, de cualquier persona y fecha. 1 = exacto, más de 1 = se subestimó. Mediana, para que un
-- caso extremo no la mueva.
-- p_por: 'usuario' (una fila por asignado; las sin asignar no entran), 'proyecto', o 'total' (una
-- sola fila, también con n = 0).
create or replace function analitica.precision_estimacion(
    p_desde date, p_hasta date, p_proyectos uuid[] default null, p_usuarios uuid[] default null,
    p_por text default 'usuario')
returns table (usuario_id uuid, proyecto_id uuid, mediana_ratio numeric, n int)
language plpgsql
stable
security invoker
set search_path = ''
-- Ordena muchos pasos o tareas: con los 4 MB por defecto, el orden se va a disco.
set work_mem = '32MB'
as $$
#variable_conflict use_column
declare
    v_usuarios uuid[] := app.metricas_usuarios(p_usuarios);
    v_zona     text := app.zona_empresa();
begin
    perform app.metricas_validar_rango(p_desde, p_hasta);
    if p_por is null or p_por not in ('usuario', 'proyecto', 'total') then
        raise exception 'p_por tiene que ser usuario, proyecto o total.';
    end if;

    return query
    with hechas as (
        select t.asignado_id, t.proyecto_id,
               (select sum(r.minutos) from public.registros_tiempo r
                where r.tarea_id = t.id and r.minutos is not null) / 60.0 / t.horas_estimadas as ratio
        from public.tareas t
        join public.proyectos p on p.id = t.proyecto_id
        where t.organizacion_id = (select app.org_actual())
          and t.estado = 'hecha' and t.eliminado_en is null
          and p.eliminado_en is null and p.estado <> 'cancelado'
          and t.horas_estimadas > 0
          and t.completada_en >= app.inicio_del_dia(p_desde, v_zona)
          and t.completada_en < app.inicio_del_dia(p_hasta + 1, v_zona)
          and (p_proyectos is null or t.proyecto_id = any (p_proyectos))
          and (v_usuarios is null or t.asignado_id = any (v_usuarios))
    ),
    validas as (
        select * from hechas h where h.ratio is not null
    )
    select case when p_por = 'usuario' then v.asignado_id end,
           case when p_por = 'proyecto' then v.proyecto_id end,
           round(percentile_cont(0.5) within group (order by v.ratio)::numeric, 2),
           count(*)::int
    from validas v
    where p_por <> 'usuario' or v.asignado_id is not null
    group by 1, 2
    having p_por <> 'total'
    union all
    select null::uuid, null::uuid,
           round(percentile_cont(0.5) within group (order by v.ratio)::numeric, 2),
           count(*)::int
    from validas v
    where p_por = 'total'
    having p_por = 'total';
end;
$$;

-- Lead: de creado_en a completada_en. Ciclo: de la primera entrada a en_curso a completada_en
-- (una tarea que nunca pasó por en_curso no tiene ciclo: n_ciclo la deja afuera). Sobre tareas
-- hechas en el período. Horas corridas, no laborales.
create or replace function analitica.tiempos_de_ciclo(
    p_desde date, p_hasta date, p_proyectos uuid[] default null, p_usuarios uuid[] default null)
returns table (mediana_lead_horas numeric, mediana_ciclo_horas numeric, n int, n_ciclo int)
language plpgsql
stable
security invoker
set search_path = ''
-- Ordena muchos pasos o tareas: con los 4 MB por defecto, el orden se va a disco.
set work_mem = '32MB'
as $$
#variable_conflict use_column
declare
    v_usuarios uuid[] := app.metricas_usuarios(p_usuarios);
    v_zona     text := app.zona_empresa();
begin
    perform app.metricas_validar_rango(p_desde, p_hasta);
    return query
    with hechas as (
        select t.creado_en, t.completada_en,
               (select min(h.cambiado_en) from public.tarea_historial_estados h
                where h.organizacion_id = t.organizacion_id and h.tarea_id = t.id
                  and h.estado_nuevo = 'en_curso' and h.cambiado_en <= t.completada_en) as entro_en_curso
        from public.tareas t
        join public.proyectos p on p.id = t.proyecto_id
        where t.organizacion_id = (select app.org_actual())
          and t.estado = 'hecha' and t.eliminado_en is null
          and p.eliminado_en is null and p.estado <> 'cancelado'
          and t.completada_en >= app.inicio_del_dia(p_desde, v_zona)
          and t.completada_en < app.inicio_del_dia(p_hasta + 1, v_zona)
          and (p_proyectos is null or t.proyecto_id = any (p_proyectos))
          and (v_usuarios is null or t.asignado_id = any (v_usuarios))
    )
    select round(percentile_cont(0.5) within group (
               order by extract(epoch from h.completada_en - h.creado_en) / 3600)::numeric, 2),
           round((percentile_cont(0.5) within group (
               order by extract(epoch from h.completada_en - h.entro_en_curso) / 3600)
               filter (where h.entro_en_curso is not null))::numeric, 2),
           count(*)::int,
           count(h.entro_en_curso)::int
    from hechas h;
end;
$$;

-- Cuánto dura cada paso por un estado abierto: de una entrada en el historial a la siguiente de la
-- misma tarea (lead). Una tarea que vuelve a un estado suma pasos separados. Horas corridas, no
-- laborales. Un paso cuenta en el período en que terminó; los pasos abiertos (todavía en ese
-- estado) no entran: se miden contra now() en tareas_trabadas. Siempre una fila por estado abierto.
create or replace function analitica.tiempo_en_estado(
    p_desde date, p_hasta date, p_proyectos uuid[] default null, p_usuarios uuid[] default null)
returns table (estado text, mediana_horas numeric, p85_horas numeric, n int)
language plpgsql
stable
security invoker
set search_path = ''
-- Ordena muchos pasos o tareas: con los 4 MB por defecto, el orden se va a disco.
set work_mem = '32MB'
as $$
#variable_conflict use_column
declare
    v_usuarios uuid[] := app.metricas_usuarios(p_usuarios);
    v_zona     text := app.zona_empresa();
    v_inicio   timestamptz;
    v_fin      timestamptz;
begin
    perform app.metricas_validar_rango(p_desde, p_hasta);
    v_inicio := app.inicio_del_dia(p_desde, v_zona);
    v_fin := app.inicio_del_dia(p_hasta + 1, v_zona);
    return query
    -- Los pasos salen del historial solo, en el orden de tarea_historial_pasos_idx: así el lead no
    -- obliga a ordenar todo de nuevo. Lo posterior al período no hace falta. Las tareas válidas se
    -- calculan una vez y se cruzan después: el filtro es por tarea, no corta ningún paso a la mitad.
    with tareas_ok as materialized (
        select t.id
        from public.tareas t
        join public.proyectos p on p.id = t.proyecto_id
        where t.organizacion_id = (select app.org_actual())
          and t.eliminado_en is null and t.estado <> 'cancelada'
          and p.eliminado_en is null and p.estado <> 'cancelado'
          and (p_proyectos is null or t.proyecto_id = any (p_proyectos))
          and (v_usuarios is null or t.asignado_id = any (v_usuarios))
    ),
    pasos as (
        select h.tarea_id, h.estado_nuevo as estado, h.cambiado_en as desde,
               lead(h.cambiado_en) over (partition by h.tarea_id order by h.cambiado_en, h.id) as hasta
        from public.tarea_historial_estados h
        where h.organizacion_id = (select app.org_actual())
          and h.cambiado_en < v_fin
    ),
    medidos as (
        -- Mediana y p85 en un solo orden.
        select x.estado,
               percentile_cont(array[0.5, 0.85]) within group (order by extract(epoch from x.hasta - x.desde) / 3600) as ps,
               count(*) as cantidad
        from pasos x
        join tareas_ok t on t.id = x.tarea_id
        where x.hasta >= v_inicio and x.hasta < v_fin
          and x.estado in ('por_hacer', 'en_curso', 'en_revision')
        group by x.estado
    )
    select e.estado, round(m.ps[1]::numeric, 2), round(m.ps[2]::numeric, 2), coalesce(m.cantidad, 0)::int
    from (values ('por_hacer', 1), ('en_curso', 2), ('en_revision', 3)) as e (estado, orden)
    left join medidos m on m.estado = e.estado
    order by e.orden;
end;
$$;

-- Tareas abiertas (de proyectos vivos) y cuántas horas llevan en su estado actual, contra now().
-- La usan tareas_trabadas y cuellos_de_botella. Recibe los usuarios ya filtrados por rol.
create or replace function app.metricas_abiertas(p_proyectos uuid[], p_usuarios uuid[])
returns table (tarea_id uuid, proyecto_id uuid, asignado_id uuid, estado text, horas numeric)
language sql
stable
security invoker
set search_path = ''
as $$
    select t.id, t.proyecto_id, t.asignado_id, t.estado,
           (extract(epoch from now() - coalesce(
               (select max(h.cambiado_en) from public.tarea_historial_estados h
                where h.organizacion_id = t.organizacion_id and h.tarea_id = t.id),
               t.creado_en)) / 3600)::numeric
    from public.tareas t
    join public.proyectos p on p.id = t.proyecto_id
    where t.organizacion_id = (select app.org_actual())
      and t.estado in ('por_hacer', 'en_curso', 'en_revision')
      and t.eliminado_en is null
      and p.eliminado_en is null and p.estado not in ('terminado', 'cancelado')
      and (p_proyectos is null or t.proyecto_id = any (p_proyectos))
      and (p_usuarios is null or t.asignado_id = any (p_usuarios))
$$;

revoke execute on function app.metricas_abiertas(uuid[], uuid[]) from public, anon;
grant execute on function app.metricas_abiertas(uuid[], uuid[]) to authenticated;

-- Tareas abiertas que llevan en su estado más que el p85 de ese estado (si hay al menos 5 pasos
-- medidos en el período), o más de 7 días si no alcanza. Se miden contra now(): es una foto de
-- ahora. De mayor a menor. Sin proyectos terminados ni cancelados, como Mis tareas.
create or replace function analitica.tareas_trabadas(
    p_desde date, p_hasta date, p_proyectos uuid[] default null, p_usuarios uuid[] default null)
returns table (tarea_id uuid, proyecto_id uuid, asignado_id uuid, estado text, horas_en_estado numeric, umbral_horas numeric)
language plpgsql
stable
security invoker
set search_path = ''
-- Ordena muchos pasos o tareas: con los 4 MB por defecto, el orden se va a disco.
set work_mem = '32MB'
as $$
#variable_conflict use_column
declare
    v_usuarios uuid[] := app.metricas_usuarios(p_usuarios);
begin
    perform app.metricas_validar_rango(p_desde, p_hasta);
    return query
    with umbrales as materialized (
        select e.estado, case when e.n >= 5 then e.p85_horas else 168 end as umbral
        from analitica.tiempo_en_estado(p_desde, p_hasta, p_proyectos, v_usuarios) e
    ),
    abiertas as materialized (
        select * from app.metricas_abiertas(p_proyectos, v_usuarios)
    )
    select a.tarea_id, a.proyecto_id, a.asignado_id, a.estado, round(a.horas, 2), u.umbral
    from abiertas a
    join umbrales u on u.estado = a.estado
    where a.horas > u.umbral
    order by a.horas desc, a.tarea_id;
end;
$$;

-- Por estado abierto: cuántas tareas hay ahora, cuántas trabadas (mismo criterio que
-- tareas_trabadas), y la mediana de tiempo_en_estado con su n.
create or replace function analitica.cuellos_de_botella(
    p_desde date, p_hasta date, p_proyectos uuid[] default null, p_usuarios uuid[] default null)
returns table (estado text, tareas_ahora int, trabadas int, mediana_horas numeric, n int)
language plpgsql
stable
security invoker
set search_path = ''
-- Ordena muchos pasos o tareas: con los 4 MB por defecto, el orden se va a disco.
set work_mem = '32MB'
as $$
#variable_conflict use_column
declare
    v_usuarios uuid[] := app.metricas_usuarios(p_usuarios);
begin
    perform app.metricas_validar_rango(p_desde, p_hasta);
    return query
    with medidos as (
        select e.*, case when e.n >= 5 then e.p85_horas else 168 end as umbral
        from analitica.tiempo_en_estado(p_desde, p_hasta, p_proyectos, v_usuarios) e
    ),
    -- materialized: una sola pasada por las tareas abiertas, no una por estado.
    abiertas as materialized (
        select * from app.metricas_abiertas(p_proyectos, v_usuarios)
    ),
    ahora as (
        select a.estado, count(*) as cantidad, count(*) filter (where a.horas > m.umbral) as trabadas
        from abiertas a
        join medidos m on m.estado = a.estado
        group by 1
    )
    select m.estado, coalesce(a.cantidad, 0)::int, coalesce(a.trabadas, 0)::int, m.mediana_horas, m.n
    from medidos m
    left join ahora a on a.estado = m.estado
    order by array_position(array['por_hacer', 'en_curso', 'en_revision'], m.estado);
end;
$$;

-- ---------------------------------------------------------------------
-- Flujo
-- ---------------------------------------------------------------------

-- Tareas hechas por semana (lunes, en la zona de la empresa), con las semanas en cero.
create or replace function analitica.rendimiento(
    p_desde date, p_hasta date, p_proyectos uuid[] default null, p_usuarios uuid[] default null)
returns table (semana date, tareas_hechas int, n int)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
    v_usuarios uuid[] := app.metricas_usuarios(p_usuarios);
    v_zona     text := app.zona_empresa();
begin
    perform app.metricas_validar_rango(p_desde, p_hasta);
    return query
    with hechas as (
        select date_trunc('week', (t.completada_en at time zone v_zona)::date)::date as semana, count(*) as cantidad
        from public.tareas t
        join public.proyectos p on p.id = t.proyecto_id
        where t.organizacion_id = (select app.org_actual())
          and t.estado = 'hecha' and t.eliminado_en is null
          and p.eliminado_en is null and p.estado <> 'cancelado'
          and t.completada_en >= app.inicio_del_dia(p_desde, v_zona)
          and t.completada_en < app.inicio_del_dia(p_hasta + 1, v_zona)
          and (p_proyectos is null or t.proyecto_id = any (p_proyectos))
          and (v_usuarios is null or t.asignado_id = any (v_usuarios))
        group by 1
    )
    select s::date, coalesce(h.cantidad, 0)::int, coalesce(h.cantidad, 0)::int
    from generate_series(date_trunc('week', p_desde)::date, date_trunc('week', p_hasta)::date, interval '1 week') s
    left join hechas h on h.semana = s::date
    order by 1;
end;
$$;

-- Foto de ahora: tareas en curso y en revisión por persona activa, también las que tienen cero.
-- Las fechas no cambian el resultado (se validan igual, por ser los parámetros comunes).
create or replace function analitica.trabajo_en_curso(
    p_desde date, p_hasta date, p_proyectos uuid[] default null, p_usuarios uuid[] default null)
returns table (usuario_id uuid, en_curso int, en_revision int, n int)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
    v_usuarios uuid[] := app.metricas_usuarios(p_usuarios);
begin
    perform app.metricas_validar_rango(p_desde, p_hasta);
    return query
    with personas as (
        select m.usuario_id
        from public.miembros m
        where m.organizacion_id = (select app.org_actual())
          and m.activo
          and (v_usuarios is null or m.usuario_id = any (v_usuarios))
          and (p_proyectos is null or exists (
              select 1 from public.proyecto_miembros pm
              where pm.usuario_id = m.usuario_id and pm.proyecto_id = any (p_proyectos)))
    ),
    abiertas as (
        select t.asignado_id,
               count(*) filter (where t.estado = 'en_curso') as en_curso,
               count(*) filter (where t.estado = 'en_revision') as en_revision
        from public.tareas t
        join public.proyectos p on p.id = t.proyecto_id
        where t.organizacion_id = (select app.org_actual())
          and t.estado in ('en_curso', 'en_revision')
          and t.eliminado_en is null
          and p.eliminado_en is null and p.estado not in ('terminado', 'cancelado')
          and (p_proyectos is null or t.proyecto_id = any (p_proyectos))
        group by 1
    )
    select x.usuario_id, coalesce(a.en_curso, 0)::int, coalesce(a.en_revision, 0)::int,
           (coalesce(a.en_curso, 0) + coalesce(a.en_revision, 0))::int
    from personas x
    left join abiertas a on a.asignado_id = x.usuario_id
    order by x.usuario_id;
end;
$$;

-- Tareas hechas en el período con fecha límite: a tiempo si se cerraron (día de la empresa) en o
-- antes del plazo. Siempre una fila; porcentaje nulo si n = 0.
create or replace function analitica.cumplimiento_plazos(
    p_desde date, p_hasta date, p_proyectos uuid[] default null, p_usuarios uuid[] default null)
returns table (a_tiempo int, tarde int, porcentaje numeric, n int)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
    v_usuarios uuid[] := app.metricas_usuarios(p_usuarios);
    v_zona     text := app.zona_empresa();
begin
    perform app.metricas_validar_rango(p_desde, p_hasta);
    return query
    with hechas as (
        select (t.completada_en at time zone v_zona)::date <= t.fecha_limite as a_tiempo
        from public.tareas t
        join public.proyectos p on p.id = t.proyecto_id
        where t.organizacion_id = (select app.org_actual())
          and t.estado = 'hecha' and t.eliminado_en is null
          and p.eliminado_en is null and p.estado <> 'cancelado'
          and t.fecha_limite is not null
          and t.completada_en >= app.inicio_del_dia(p_desde, v_zona)
          and t.completada_en < app.inicio_del_dia(p_hasta + 1, v_zona)
          and (p_proyectos is null or t.proyecto_id = any (p_proyectos))
          and (v_usuarios is null or t.asignado_id = any (v_usuarios))
    )
    select count(*) filter (where h.a_tiempo)::int,
           count(*) filter (where not h.a_tiempo)::int,
           case when count(*) > 0 then round(count(*) filter (where h.a_tiempo) * 100.0 / count(*), 1) end,
           count(*)::int
    from hechas h;
end;
$$;

-- Horas registradas contra horas_presupuestadas, junto al avance (tareas hechas / tareas del
-- proyecto, sin canceladas). El presupuesto es de todo el proyecto: las horas son de toda su vida,
-- no del período. Solo proyectos vivos (no terminados ni cancelados) con presupuesto.
-- n: tareas detrás del avance. Es una tarjeta de gestión: un colaborador recibe vacío.
create or replace function analitica.consumo_presupuesto(
    p_desde date, p_hasta date, p_proyectos uuid[] default null, p_usuarios uuid[] default null)
returns table (proyecto_id uuid, horas numeric, presupuestadas numeric, porcentaje numeric, avance numeric, n int)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
begin
    perform app.metricas_validar_rango(p_desde, p_hasta);
    if app.rol_actual() is distinct from 'admin' and app.rol_actual() is distinct from 'pm' then
        return;
    end if;
    return query
    select p.id,
           round(coalesce((select sum(r.minutos) from public.registros_tiempo r
                           where r.proyecto_id = p.id and r.minutos is not null), 0) / 60.0, 2) as horas,
           p.horas_presupuestadas,
           round(coalesce((select sum(r.minutos) from public.registros_tiempo r
                           where r.proyecto_id = p.id and r.minutos is not null), 0) / 60.0
                 / p.horas_presupuestadas * 100, 1),
           case when t.total > 0 then round(t.hechas * 100.0 / t.total, 1) end,
           coalesce(t.total, 0)::int
    from public.proyectos p
    left join lateral (
        select count(*) as total, count(*) filter (where x.estado = 'hecha') as hechas
        from public.tareas x
        where x.proyecto_id = p.id and x.eliminado_en is null and x.estado <> 'cancelada'
    ) t on true
    where p.organizacion_id = (select app.org_actual())
      and p.eliminado_en is null
      and p.estado not in ('terminado', 'cancelado')
      and p.horas_presupuestadas > 0
      and (p_proyectos is null or p.id = any (p_proyectos))
    order by p.nombre, p.id;
end;
$$;

revoke execute on function
    analitica.horas_por_periodo(date, date, uuid[], uuid[]),
    analitica.utilizacion(date, date, uuid[], uuid[]),
    analitica.precision_estimacion(date, date, uuid[], uuid[], text),
    analitica.tiempos_de_ciclo(date, date, uuid[], uuid[]),
    analitica.tiempo_en_estado(date, date, uuid[], uuid[]),
    analitica.tareas_trabadas(date, date, uuid[], uuid[]),
    analitica.cuellos_de_botella(date, date, uuid[], uuid[]),
    analitica.rendimiento(date, date, uuid[], uuid[]),
    analitica.trabajo_en_curso(date, date, uuid[], uuid[]),
    analitica.cumplimiento_plazos(date, date, uuid[], uuid[]),
    analitica.consumo_presupuesto(date, date, uuid[], uuid[])
    from public, anon;
grant execute on function
    analitica.horas_por_periodo(date, date, uuid[], uuid[]),
    analitica.utilizacion(date, date, uuid[], uuid[]),
    analitica.precision_estimacion(date, date, uuid[], uuid[], text),
    analitica.tiempos_de_ciclo(date, date, uuid[], uuid[]),
    analitica.tiempo_en_estado(date, date, uuid[], uuid[]),
    analitica.tareas_trabadas(date, date, uuid[], uuid[]),
    analitica.cuellos_de_botella(date, date, uuid[], uuid[]),
    analitica.rendimiento(date, date, uuid[], uuid[]),
    analitica.trabajo_en_curso(date, date, uuid[], uuid[]),
    analitica.cumplimiento_plazos(date, date, uuid[], uuid[]),
    analitica.consumo_presupuesto(date, date, uuid[], uuid[])
    to authenticated;
