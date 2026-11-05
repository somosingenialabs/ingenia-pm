-- =====================================================================
-- Ingenia PM · Migración 5: calendario, carga, dependencias y Realtime
--
-- Realtime respeta el RLS: cada evento pasa por la política de lectura con
-- el token de quien se suscribió. Por eso no hay políticas nuevas acá.
-- =====================================================================

-- Sin esto Realtime no emite nada.
alter publication supabase_realtime add table public.comentarios, public.tareas;

-- ---------------------------------------------------------------------
-- Comentarios
-- ---------------------------------------------------------------------

-- Igual que antes, y además: un comentario borrado ya no se edita ni se restaura. Sin esto, el
-- autor podía volver a poner eliminado_en en null un comentario que borró un Admin.
create or replace function app.comentario_proteger()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.tarea_id <> old.tarea_id or new.autor_id <> old.autor_id or new.organizacion_id <> old.organizacion_id then
        raise exception 'La tarea, el autor y la empresa de un comentario no se pueden cambiar.';
    end if;
    if old.eliminado_en is not null then
        raise exception 'Un comentario eliminado no se puede editar.';
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

-- El update de comentarios es solo del autor (RLS). Borrar uno ajeno pasa por acá:
-- Admin cualquiera, PM gestor del proyecto, y cada uno el propio.
-- "No existe" y "no lo ves" dan el mismo mensaje: no se confirma que exista.
create or replace function public.eliminar_comentario(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_com      public.comentarios;
    v_proyecto uuid;
    v_rol      text := app.rol_actual();
begin
    select * into v_com from public.comentarios c
    where c.id = p_id and c.organizacion_id = app.org_actual()
    for update;
    if not found or v_rol is null or v_com.tarea_id not in (select app.tareas_visibles()) then
        raise exception 'El comentario no existe.';
    end if;
    if v_com.eliminado_en is not null then
        return;
    end if;

    select t.proyecto_id into v_proyecto from public.tareas t where t.id = v_com.tarea_id;
    if not (
        v_com.autor_id = (select auth.uid())
        or v_rol = 'admin'
        or v_proyecto in (select app.proyectos_gestionados())
    ) then
        raise exception 'No podés borrar este comentario.';
    end if;

    update public.comentarios set eliminado_en = now() where id = v_com.id;
end;
$$;

revoke execute on function public.eliminar_comentario(uuid) from public, anon;
grant execute on function public.eliminar_comentario(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Dependencias en conflicto
-- ---------------------------------------------------------------------

-- Una sucesora arranca antes de que termine su predecesora (más el desfase). security invoker:
-- el RLS deja solo lo que quien llama puede ver. Con p_proyecto nulo, todos los visibles.
-- Además de lo que pide el plan, no cuentan una predecesora cancelada (ya no bloquea nada) ni una
-- sucesora cerrada (ya no tiene que arrancar).
create or replace function public.conflictos_dependencias(p_proyecto uuid default null)
returns table (tarea_id uuid, depende_de_id uuid, debe_arrancar_desde date, arranca_el date)
language sql
stable
security invoker
set search_path = ''
as $$
    select d.tarea_id,
           d.depende_de_id,
           p.fecha_limite + d.desfase_dias,
           coalesce(s.fecha_inicio, s.fecha_limite)
    from public.tarea_dependencias d
    join public.tareas s on s.id = d.tarea_id
    join public.tareas p on p.id = d.depende_de_id
    where (p_proyecto is null or s.proyecto_id = p_proyecto)
      and s.eliminado_en is null
      and p.eliminado_en is null
      and p.estado not in ('hecha', 'cancelada')
      and s.estado not in ('hecha', 'cancelada')
      and coalesce(s.fecha_inicio, s.fecha_limite) < p.fecha_limite + d.desfase_dias
$$;

revoke execute on function public.conflictos_dependencias(uuid) from public, anon;
grant execute on function public.conflictos_dependencias(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Carga por persona
-- ---------------------------------------------------------------------

-- Una fila por persona y semana (lunes). security invoker: el RLS de tareas y horas sigue
-- filtrando. Colaborador ve solo su fila (arquitectura, sección 2: métricas propias).
--
-- - Horas restantes de una tarea: estimadas - registradas, nunca negativas. Se reparten en partes
--   iguales de lunes a viernes, de coalesce(inicio, límite) a límite, pero nunca antes de hoy (de
--   la empresa): lo que falta no se puede hacer en el pasado. Si todo el rango cae en fin de
--   semana, van al viernes anterior, o a hoy si ese viernes ya pasó. Sin feriados.
-- - Atrasadas: una tarea vencida y abierta pone todo lo que le falta en hoy, y también se
--   informa aparte (horas_atrasadas), para que la pantalla diga cuánto es atraso.
-- - Sin estimar o sin fecha no se inventa nada: se cuenta aparte.
--   tareas_sin_fecha: abiertas sin fecha límite. tareas_sin_estimar: con fecha que toca el rango
--   pedido y sin horas estimadas. Las dos son por persona y se repiten en cada semana.
-- - Abiertas: por hacer, en curso o en revisión, de proyectos no borrados. Tampoco cuentan los
--   proyectos terminados o cancelados, igual que Mis tareas.
create or replace function analitica.carga_por_persona(p_desde date, p_hasta date, p_proyecto uuid default null)
returns table (
    usuario_id         uuid,
    semana             date,
    horas_asignadas    numeric,
    horas_atrasadas    numeric,
    capacidad          numeric,
    tareas_sin_estimar int,
    tareas_sin_fecha   int
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
    v_hoy date;
begin
    if p_desde is null or p_hasta is null or p_hasta < p_desde then
        raise exception 'El rango de fechas no es válido.';
    end if;
    if p_hasta - p_desde > 370 then
        raise exception 'El rango de fechas es demasiado largo.';
    end if;

    -- Hoy en la zona de la empresa: current_date está en UTC, y a la noche en Argentina ya es mañana.
    select (now() at time zone o.zona_horaria)::date into v_hoy
    from public.organizaciones o where o.id = app.org_actual();
    v_hoy := coalesce(v_hoy, current_date);

    return query
    with personas as (
        select m.usuario_id, m.horas_semanales
        from public.miembros m
        where m.organizacion_id = (select app.org_actual())
          and m.activo
          and ((select app.rol_actual()) in ('admin', 'pm') or m.usuario_id = (select auth.uid()))
          and (
              p_proyecto is null
              or exists (
                  select 1 from public.proyecto_miembros pm
                  where pm.proyecto_id = p_proyecto and pm.usuario_id = m.usuario_id
              )
          )
    ),
    semanas as (
        select s::date as semana
        from generate_series(date_trunc('week', p_desde)::date, date_trunc('week', p_hasta)::date, interval '1 week') s
    ),
    abiertas as (
        select t.id, t.asignado_id, t.horas_estimadas, t.fecha_limite,
               coalesce(t.fecha_inicio, t.fecha_limite) as desde
        from public.tareas t
        join public.proyectos p on p.id = t.proyecto_id
        where t.eliminado_en is null
          and p.eliminado_en is null
          and t.estado in ('por_hacer', 'en_curso', 'en_revision')
          and p.estado not in ('terminado', 'cancelado')
          and t.asignado_id in (select x.usuario_id from personas x)
          and (p_proyecto is null or t.proyecto_id = p_proyecto)
    ),
    restantes as (
        select a.id, a.asignado_id, a.fecha_limite,
               a.fecha_limite < v_hoy as atrasada,
               greatest(a.desde, v_hoy) as desde,
               greatest(
                   a.horas_estimadas - coalesce(
                       (select sum(r.minutos) from public.registros_tiempo r where r.tarea_id = a.id), 0
                   ) / 60.0,
                   0
               ) as horas
        from abiertas a
        where a.horas_estimadas is not null and a.fecha_limite is not null
    ),
    habiles as (
        select r.id, r.asignado_id, r.horas, d::date as dia
        from restantes r
        cross join lateral generate_series(r.desde, r.fecha_limite, interval '1 day') d
        where not r.atrasada and extract(isodow from d) < 6
    ),
    por_dia as (
        select h.asignado_id, h.dia, h.horas / count(*) over (partition by h.id) as horas, false as atrasada
        from habiles h
        union all
        -- Rango entero en sábado o domingo: al viernes anterior, o a hoy si ya pasó.
        select r.asignado_id, greatest(r.desde - (extract(isodow from r.desde)::int - 5), v_hoy), r.horas, false
        from restantes r
        where not r.atrasada and not exists (select 1 from habiles h where h.id = r.id)
        union all
        -- Vencidas y abiertas: todo lo que falta, hoy.
        select r.asignado_id, v_hoy, r.horas, true
        from restantes r
        where r.atrasada
    ),
    carga as (
        select d.asignado_id, date_trunc('week', d.dia)::date as semana, sum(d.horas) as horas,
               sum(d.horas) filter (where d.atrasada) as atrasadas
        from por_dia d
        where d.dia between p_desde and p_hasta
        group by 1, 2
    ),
    faltantes as (
        select a.asignado_id,
               count(*) filter (where a.fecha_limite is null) as sin_fecha,
               count(*) filter (
                   where a.horas_estimadas is null and a.fecha_limite is not null
                     and a.desde <= p_hasta and a.fecha_limite >= p_desde
               ) as sin_estimar
        from abiertas a
        group by 1
    )
    select x.usuario_id,
           s.semana,
           round(coalesce(c.horas, 0), 2),
           round(coalesce(c.atrasadas, 0), 2),
           x.horas_semanales::numeric,
           coalesce(f.sin_estimar, 0)::int,
           coalesce(f.sin_fecha, 0)::int
    from personas x
    cross join semanas s
    left join carga c on c.asignado_id = x.usuario_id and c.semana = s.semana
    left join faltantes f on f.asignado_id = x.usuario_id
    order by x.usuario_id, s.semana;
end;
$$;

revoke execute on function analitica.carga_por_persona(date, date, uuid) from public, anon;
grant execute on function analitica.carga_por_persona(date, date, uuid) to authenticated;
