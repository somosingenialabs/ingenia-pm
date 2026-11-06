-- =====================================================================
-- Seed 40 · Historia de 12 semanas en la Empresa A, para Analítica.
-- Datos ficticios y deterministas (sin random): cada reset da los mismos
-- números. Fechas relativas al día de hoy en la zona de la empresa.
--
--   Proyecto 4 "Ampliación de depósito"     pm1, colab1, colab2, colab3
--   Proyecto 5 "Automatización de envasado" pm2, colab1, colab2
--   Tareas: 14000000-0000-4000-a000-00000000NNNN
--     1 a 60   hechas, con historial completo y horas. Cada 6, una vuelve de
--              revisión a en curso. Cada 10, sin estimar. Cada 13, sin horas.
--              Cada 4, cerrada 2 días después del plazo.
--     61 a 72  abiertas y una cancelada con horas.
--     68 a 70  en revisión hace 12 a 19 días en el proyecto 5: el cuello de
--              botella que tiene que verse en Analítica.
--     73 a 82  por hacer en el proyecto 5, recién creadas: bajan el avance
--              y el proyecto queda con mucho presupuesto consumido.
--
-- También arma el historial de las tareas hechas del seed 30, que nacen
-- con una sola fila "hecha" puesta por el trigger.
-- =====================================================================

do $$
declare
    c_zona   constant text := 'America/Argentina/Buenos_Aires';
    c_org    constant uuid := '10000000-0000-4000-a000-000000000000';
    c_pm1    constant uuid := '00000000-0000-4000-a000-000000000002';
    c_pm2    constant uuid := '00000000-0000-4000-a000-000000000003';
    c_colab1 constant uuid := '00000000-0000-4000-a000-000000000004';
    c_colab2 constant uuid := '00000000-0000-4000-a000-000000000005';
    c_colab3 constant uuid := '00000000-0000-4000-a000-000000000006';
    c_p4     constant uuid := '12000000-0000-4000-a000-000000000004';
    c_p5     constant uuid := '12000000-0000-4000-a000-000000000005';
    c_titulos constant text[] := array[
        'Relevar medidas de la nave', 'Plano de estanterías', 'Cálculo de carga del entrepiso',
        'Pedido de cotización de racks', 'Revisión del tablero eléctrico', 'Prueba de sensores',
        'Programar secuencia de arranque', 'Ajuste de velocidad de cinta', 'Instructivo de operación',
        'Capacitación de operarios', 'Informe de avance al cliente', 'Checklist de seguridad'];
    c_ratios constant numeric[] := array[0.8, 1.0, 1.2, 1.3, 1.5, 1.1, 0.9];
    v_hoy    date := (now() at time zone c_zona)::date;
    v_id     uuid;
    v_proy   uuid;
    v_pm     uuid;
    v_asig   uuid;
    v_creado timestamptz;
    v_curso  timestamptz;
    v_rev    timestamptz;
    v_vuelta timestamptz;
    v_rev2   timestamptz;
    v_hecha  timestamptz;
    v_desde  timestamptz;
    v_est    numeric;
    v_total  int;
    v_partes int;
    v_limite date;
    v_dfin   int;
    i int;
    j int;
    a record;
begin
    -- ===== Proyectos =====
    insert into public.proyectos
        (id, organizacion_id, nombre, descripcion, cliente, estado, responsable_id, fecha_inicio, fecha_fin_objetivo, horas_presupuestadas, creado_por)
    values
        (c_p4, c_org, 'Ampliación de depósito', 'Proyecto con historia de ejemplo.', 'Cliente Ficticio Cuatro', 'activo', c_pm1,
         v_hoy - 95, v_hoy + 30, 900, c_pm1),
        (c_p5, c_org, 'Automatización de envasado', 'Proyecto con historia de ejemplo y revisiones trabadas.', 'Cliente Ficticio Cinco', 'activo', c_pm2,
         v_hoy - 95, v_hoy + 20, 320, c_pm2);
    insert into public.proyecto_miembros (organizacion_id, proyecto_id, usuario_id) values
        (c_org, c_p4, c_colab1), (c_org, c_p4, c_colab2), (c_org, c_p4, c_colab3),
        (c_org, c_p5, c_colab1), (c_org, c_p5, c_colab2);

    -- ===== 60 tareas hechas =====
    for i in 1..60 loop
        v_id := format('14000000-0000-4000-a000-%s', lpad(i::text, 12, '0'))::uuid;
        if i % 3 = 0 then
            v_proy := c_p5; v_pm := c_pm2;
            v_asig := (array[c_colab1, c_colab2])[(i % 2) + 1];
        else
            v_proy := c_p4; v_pm := c_pm1;
            v_asig := (array[c_colab1, c_colab2, c_colab3, c_colab1])[(i % 4) + 1];
        end if;

        -- Se cierran desde hace unas 11 semanas hasta hace pocos días.
        v_dfin := 82 - (i * 4) / 3;
        v_creado := ((v_hoy - v_dfin - 12)::timestamp + make_interval(hours => 9 + i % 3)) at time zone c_zona;
        v_curso := v_creado + make_interval(hours => 24 + (i % 5) * 24);
        v_rev := v_curso + make_interval(hours => 24 + (i % 7) * 12);
        if i % 6 = 0 then
            v_vuelta := v_rev + make_interval(hours => 4 + (i % 6) * 3);
            v_rev2 := v_vuelta + interval '10 hours';
            v_hecha := v_rev2 + interval '6 hours';
        else
            v_vuelta := null;
            v_rev2 := null;
            v_hecha := v_rev + make_interval(hours => 4 + (i % 6) * 3);
        end if;

        v_est := case when i % 10 = 0 then null else 6 + (i % 5) * 3 end;
        v_total := case when i % 13 = 0 then 0 else round(coalesce(v_est, 5) * c_ratios[(i % 7) + 1] * 60) end;
        v_limite := (v_hecha at time zone c_zona)::date + case when i % 4 = 0 then -2 else 1 end;

        insert into public.tareas (
            id, organizacion_id, proyecto_id, titulo, estado, prioridad, asignado_id,
            fecha_inicio, fecha_limite, horas_estimadas, posicion, completada_en, creado_en, creado_por
        ) values (
            v_id, c_org, v_proy, format('%s %s', c_titulos[(i % 12) + 1], i), 'hecha',
            (array['baja', 'media', 'alta', 'media'])[(i % 4) + 1], v_asig,
            least((v_curso at time zone c_zona)::date, v_limite), v_limite, v_est, i * 1000,
            v_hecha, v_creado, v_pm
        );

        delete from public.tarea_historial_estados where tarea_id = v_id;
        insert into public.tarea_historial_estados
            (organizacion_id, proyecto_id, tarea_id, estado_anterior, estado_nuevo, cambiado_por, cambiado_en)
        values
            (c_org, v_proy, v_id, null, 'por_hacer', v_pm, v_creado),
            (c_org, v_proy, v_id, 'por_hacer', 'en_curso', v_asig, v_curso),
            (c_org, v_proy, v_id, 'en_curso', 'en_revision', v_asig, v_rev);
        if v_vuelta is not null then
            insert into public.tarea_historial_estados
                (organizacion_id, proyecto_id, tarea_id, estado_anterior, estado_nuevo, cambiado_por, cambiado_en)
            values
                (c_org, v_proy, v_id, 'en_revision', 'en_curso', v_pm, v_vuelta),
                (c_org, v_proy, v_id, 'en_curso', 'en_revision', v_asig, v_rev2);
        end if;
        insert into public.tarea_historial_estados
            (organizacion_id, proyecto_id, tarea_id, estado_anterior, estado_nuevo, cambiado_por, cambiado_en)
        values (c_org, v_proy, v_id, 'en_revision', 'hecha', v_pm, v_hecha);

        -- Horas: partes de hasta 6 h, en días seguidos desde que empezó, sin pasar el cierre.
        if v_total > 0 then
            v_partes := ceil(v_total / 360.0);
            for j in 0..v_partes - 1 loop
                insert into public.registros_tiempo (organizacion_id, tarea_id, usuario_id, origen, minutos, fecha)
                values (
                    c_org, v_id, v_asig, 'manual',
                    case when j = v_partes - 1 then v_total - (v_total / v_partes) * (v_partes - 1) else v_total / v_partes end,
                    least((v_curso at time zone c_zona)::date + j, (v_hecha at time zone c_zona)::date)
                );
            end loop;
        end if;
    end loop;

    -- ===== Abiertas (y una cancelada), con cuántas horas llevan en su estado =====
    for a in
        select * from (values
            (61, c_p4, c_colab1, 'en_curso',     24,  10, 240),
            (62, c_p4, c_colab2, 'en_curso',     48,   8, 300),
            (63, c_p4, c_colab3, 'en_curso',     72,  12, 420),
            (64, c_p4, c_colab1, 'por_hacer',    96,   6,   0),
            (65, c_p4, c_colab2, 'por_hacer',    48, null,  0),
            (66, c_p4, c_colab3, 'por_hacer',   144,   8,   0),
            (67, c_p4, c_colab1, 'en_revision',  12,   6, 360),
            (68, c_p5, c_colab1, 'en_revision', 456,   8, 600),
            (69, c_p5, c_colab2, 'en_revision', 360,  10, 540),
            (70, c_p5, c_colab1, 'en_revision', 288,   6, 480),
            (71, c_p5, c_colab2, 'en_curso',     24,  12, 180),
            (72, c_p4, c_colab3, 'cancelada',   240,   8, 240)
        ) as x (n, proyecto, asignado, estado, horas, estimadas, minutos)
    loop
        v_id := format('14000000-0000-4000-a000-%s', lpad(a.n::text, 12, '0'))::uuid;
        v_pm := case when a.proyecto = c_p4 then c_pm1 else c_pm2 end;
        v_desde := now() - make_interval(hours => a.horas);
        v_creado := case when a.estado = 'por_hacer' then v_desde else v_desde - interval '3 days' end;
        v_curso := case when a.estado = 'en_curso' then v_desde else v_creado + interval '1 day' end;

        insert into public.tareas (
            id, organizacion_id, proyecto_id, titulo, estado, prioridad, asignado_id,
            fecha_inicio, fecha_limite, horas_estimadas, posicion, creado_en, creado_por
        ) values (
            v_id, c_org, a.proyecto, format('%s %s', c_titulos[(a.n % 12) + 1], a.n), a.estado,
            case when a.n between 68 and 70 then 'alta' else 'media' end, a.asignado,
            (v_creado at time zone c_zona)::date,
            -- Las trabadas ya se pasaron del plazo; las otras vencen en los próximos días.
            case when a.n between 68 and 70 then v_hoy - 5 else v_hoy + 3 + a.n % 8 end,
            a.estimadas, a.n * 1000, v_creado, v_pm
        );

        delete from public.tarea_historial_estados where tarea_id = v_id;
        insert into public.tarea_historial_estados
            (organizacion_id, proyecto_id, tarea_id, estado_anterior, estado_nuevo, cambiado_por, cambiado_en)
        values (c_org, a.proyecto, v_id, null, 'por_hacer', v_pm, v_creado);
        if a.estado <> 'por_hacer' then
            insert into public.tarea_historial_estados
                (organizacion_id, proyecto_id, tarea_id, estado_anterior, estado_nuevo, cambiado_por, cambiado_en)
            values (c_org, a.proyecto, v_id, 'por_hacer', 'en_curso', a.asignado, v_curso);
        end if;
        if a.estado in ('en_revision', 'cancelada') then
            insert into public.tarea_historial_estados
                (organizacion_id, proyecto_id, tarea_id, estado_anterior, estado_nuevo, cambiado_por, cambiado_en)
            values (c_org, a.proyecto, v_id, 'en_curso', a.estado,
                    case when a.estado = 'cancelada' then v_pm else a.asignado end, v_desde);
        end if;

        if a.minutos > 0 then
            v_partes := ceil(a.minutos / 360.0);
            for j in 0..v_partes - 1 loop
                insert into public.registros_tiempo (organizacion_id, tarea_id, usuario_id, origen, minutos, fecha)
                values (
                    c_org, v_id, a.asignado, 'manual',
                    case when j = v_partes - 1 then a.minutos - (a.minutos / v_partes) * (v_partes - 1) else a.minutos / v_partes end,
                    least((v_curso at time zone c_zona)::date + j, v_hoy)
                );
            end loop;
        end if;
    end loop;

    -- ===== Por hacer recién creadas en el proyecto 5 =====
    for i in 73..82 loop
        insert into public.tareas (
            id, organizacion_id, proyecto_id, titulo, estado, asignado_id,
            fecha_inicio, fecha_limite, horas_estimadas, posicion, creado_en, creado_por
        ) values (
            format('14000000-0000-4000-a000-%s', lpad(i::text, 12, '0'))::uuid, c_org, c_p5,
            format('%s %s', c_titulos[(i % 12) + 1], i), 'por_hacer',
            (array[c_colab1, c_colab2])[(i % 2) + 1],
            v_hoy + (i - 73), v_hoy + (i - 73) + 4, 4 + i % 4, i * 1000,
            now() - interval '2 days', c_pm2
        );
    end loop;
    update public.tarea_historial_estados h set cambiado_en = t.creado_en
    from public.tareas t
    where t.id = h.tarea_id and t.proyecto_id = c_p5 and t.estado = 'por_hacer'
      and t.id >= '14000000-0000-4000-a000-000000000073';

    -- ===== Historial de las tareas hechas del seed 30: por hacer, en curso y hecha =====
    for a in
        select t.id, t.proyecto_id, t.asignado_id, t.creado_en, t.completada_en, t.creado_por
        from public.tareas t
        where t.organizacion_id = c_org and t.estado = 'hecha'
          and t.id::text like '13000000-%'
    loop
        delete from public.tarea_historial_estados where tarea_id = a.id;
        insert into public.tarea_historial_estados
            (organizacion_id, proyecto_id, tarea_id, estado_anterior, estado_nuevo, cambiado_por, cambiado_en)
        values
            (c_org, a.proyecto_id, a.id, null, 'por_hacer', a.creado_por, a.creado_en),
            (c_org, a.proyecto_id, a.id, 'por_hacer', 'en_curso', a.asignado_id, a.creado_en + interval '3 days'),
            (c_org, a.proyecto_id, a.id, 'en_curso', 'hecha', a.asignado_id, a.completada_en);
    end loop;
end;
$$;
