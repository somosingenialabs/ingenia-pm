-- =====================================================================
-- Ingenia PM · Migración 8: ajuste de consumo_presupuesto
--
-- Las horas de una tarea borrada no cuentan, igual que en horas_por_periodo
-- y utilizacion. Las de una tarea cancelada sí: ese trabajo se hizo igual.
-- =====================================================================

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
           round(h.minutos / 60.0, 2),
           p.horas_presupuestadas,
           round(h.minutos / 60.0 / p.horas_presupuestadas * 100, 1),
           case when t.total > 0 then round(t.hechas * 100.0 / t.total, 1) end,
           coalesce(t.total, 0)::int
    from public.proyectos p
    cross join lateral (
        select coalesce(sum(r.minutos), 0) as minutos
        from public.registros_tiempo r
        join public.tareas x on x.id = r.tarea_id
        where r.proyecto_id = p.id and r.minutos is not null and x.eliminado_en is null
    ) h
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
