-- =====================================================================
-- Seed 30 · Proyectos y tareas. Datos ficticios, con fechas relativas a
-- current_date para que nunca queden viejos. Ids fijos para los tests:
--
--   Empresa A: proyectos 12000000-...-a000-00000000000{1,2,3}
--     1 activo     pm1, colab1, colab2, colab3    tareas 1 a 14
--     2 activo     pm2, colab1, colab2            tareas 15 a 26 (colab3 queda fuera)
--     3 terminado  pm1, colab2, colab3            tareas 27 a 30 (colab1 queda fuera)
--   Tareas: 13000000-0000-4000-a000-00000000000N. Cada 9 tareas, una sin asignar.
--   Empresa B: proyecto 22000000-...-b000-000000000001, tareas 23000000-...-b000-00000000000N
-- =====================================================================

do $$
declare
    c_org_a  constant uuid := '10000000-0000-4000-a000-000000000000';
    c_org_b  constant uuid := '20000000-0000-4000-b000-000000000000';
    c_admin  constant uuid := '00000000-0000-4000-a000-000000000001';
    c_pm1    constant uuid := '00000000-0000-4000-a000-000000000002';
    c_pm2    constant uuid := '00000000-0000-4000-a000-000000000003';
    c_colab1 constant uuid := '00000000-0000-4000-a000-000000000004';
    c_colab2 constant uuid := '00000000-0000-4000-a000-000000000005';
    c_colab3 constant uuid := '00000000-0000-4000-a000-000000000006';
    c_admin_b constant uuid := '00000000-0000-4000-b000-000000000001';
    c_colab_b constant uuid := '00000000-0000-4000-b000-000000000002';
    c_p1     constant uuid := '12000000-0000-4000-a000-000000000001';
    c_p2     constant uuid := '12000000-0000-4000-a000-000000000002';
    c_p3     constant uuid := '12000000-0000-4000-a000-000000000003';
    c_pb     constant uuid := '22000000-0000-4000-b000-000000000001';
    c_estados constant text[] := array['por_hacer', 'en_curso', 'en_revision', 'hecha', 'cancelada'];
    c_prioridades constant text[] := array['baja', 'media', 'alta', 'urgente'];
    v_proyecto uuid;
    v_equipo   uuid[];
    v_estado   text;
    v_inicio   date;
    i int;
begin
    -- ===== Proyectos. El trigger agrega al responsable y a quien lo creó como miembros =====
    insert into public.proyectos
        (id, organizacion_id, nombre, descripcion, cliente, estado, responsable_id, fecha_inicio, fecha_fin_objetivo, horas_presupuestadas, creado_por)
    values
        (c_p1, c_org_a, 'Puesta en marcha línea 2', 'Proyecto activo de ejemplo.', 'Cliente Ficticio Uno', 'activo', c_pm1,
         current_date - 30, current_date + 45, 400, c_pm1),
        (c_p2, c_org_a, 'Tablero de mantenimiento', 'Proyecto activo de ejemplo.', 'Cliente Ficticio Dos', 'activo', c_pm2,
         current_date - 15, current_date + 60, 250, c_pm2),
        (c_p3, c_org_a, 'Relevamiento de planta', 'Proyecto terminado de ejemplo.', 'Cliente Ficticio Uno', 'terminado', c_pm1,
         current_date - 120, current_date - 20, 80, c_admin),
        (c_pb, c_org_b, 'Proyecto de la Empresa B', 'Solo lo ve la Empresa B.', 'Cliente Ficticio Tres', 'activo', c_admin_b,
         current_date - 10, current_date + 30, 100, c_admin_b);

    insert into public.proyecto_miembros (organizacion_id, proyecto_id, usuario_id) values
        (c_org_a, c_p1, c_colab1), (c_org_a, c_p1, c_colab2), (c_org_a, c_p1, c_colab3),
        (c_org_a, c_p2, c_colab1), (c_org_a, c_p2, c_colab2),
        (c_org_a, c_p3, c_colab2), (c_org_a, c_p3, c_colab3),
        (c_org_b, c_pb, c_colab_b);

    -- ===== 30 tareas en A, repartidas en todos los estados =====
    for i in 1..30 loop
        if i <= 14 then
            v_proyecto := c_p1;
            v_equipo := array[c_pm1, c_colab1, c_colab2, c_colab3];
        elsif i <= 26 then
            v_proyecto := c_p2;
            v_equipo := array[c_pm2, c_colab1, c_colab2];
        else
            v_proyecto := c_p3;
            v_equipo := array[c_pm1, c_colab2, c_colab3];
        end if;

        -- El proyecto terminado solo tiene tareas cerradas.
        v_estado := case
            when v_proyecto = c_p3 then case when i = 30 then 'cancelada' else 'hecha' end
            else c_estados[(i % 5) + 1]
        end;
        v_inicio := case
            when v_proyecto = c_p3 then current_date - 100 + i
            else current_date + (i % 10) - 12
        end;

        insert into public.tareas (
            id, organizacion_id, proyecto_id, titulo, descripcion, estado, prioridad, asignado_id,
            fecha_inicio, fecha_limite, horas_estimadas, posicion, completada_en, creado_en, creado_por
        ) values (
            format('13000000-0000-4000-a000-%s', lpad(i::text, 12, '0'))::uuid,
            c_org_a, v_proyecto,
            format('Tarea de ejemplo %s', i),
            'Descripción de ejemplo.',
            v_estado,
            c_prioridades[(i % 4) + 1],
            case when i % 9 = 0 then null else v_equipo[(i % array_length(v_equipo, 1)) + 1] end,
            v_inicio,
            v_inicio + (i % 7) + 3,
            2 + (i % 8),
            i * 1000,
            case when v_estado = 'hecha' then now() - make_interval(days => (i % 10) + 1) end,
            -- Una tarea hecha se creó antes de cerrarse: si no, el lead da negativo.
            case when v_estado = 'hecha' then now() - make_interval(days => (i % 10) + 8) else now() end,
            v_equipo[1]
        );
    end loop;

    -- ===== 5 tareas en B =====
    for i in 1..5 loop
        v_estado := c_estados[i];
        insert into public.tareas (
            id, organizacion_id, proyecto_id, titulo, estado, asignado_id, fecha_inicio, fecha_limite, posicion, creado_por
        ) values (
            format('23000000-0000-4000-b000-%s', lpad(i::text, 12, '0'))::uuid,
            c_org_b, c_pb, format('Tarea de B %s', i), v_estado, c_colab_b,
            current_date - i, current_date + i, i * 1000, c_admin_b
        );
    end loop;

    -- ===== Dependencias: la primera columna no arranca hasta que termina la segunda =====
    insert into public.tarea_dependencias (organizacion_id, tarea_id, depende_de_id, desfase_dias) values
        (c_org_a, '13000000-0000-4000-a000-000000000002', '13000000-0000-4000-a000-000000000001', 0),
        (c_org_a, '13000000-0000-4000-a000-000000000003', '13000000-0000-4000-a000-000000000002', 2),
        (c_org_a, '13000000-0000-4000-a000-000000000005', '13000000-0000-4000-a000-000000000004', 0),
        (c_org_b, '23000000-0000-4000-b000-000000000002', '23000000-0000-4000-b000-000000000001', 0);

    -- ===== Comentarios =====
    insert into public.comentarios (id, organizacion_id, tarea_id, autor_id, cuerpo) values
        ('15000000-0000-4000-a000-000000000001', c_org_a, '13000000-0000-4000-a000-000000000001', c_colab1, 'Comentario de ejemplo del colaborador.'),
        ('15000000-0000-4000-a000-000000000002', c_org_a, '13000000-0000-4000-a000-000000000016', c_colab1, 'Comentario en un proyecto donde colab3 no está.'),
        ('15000000-0000-4000-a000-000000000003', c_org_a, '13000000-0000-4000-a000-000000000001', c_pm1, 'Comentario de ejemplo del PM.'),
        ('15000000-0000-4000-a000-000000000004', c_org_a, '13000000-0000-4000-a000-000000000003', c_colab3, 'Comentario de ejemplo.'),
        ('15000000-0000-4000-a000-000000000005', c_org_a, '13000000-0000-4000-a000-000000000017', c_pm2, 'Comentario de ejemplo.'),
        ('15000000-0000-4000-a000-000000000006', c_org_a, '13000000-0000-4000-a000-000000000028', c_colab2, 'Comentario de ejemplo.'),
        ('25000000-0000-4000-b000-000000000001', c_org_b, '23000000-0000-4000-b000-000000000001', c_colab_b, 'Comentario de la Empresa B.');

    -- ===== Horas manuales =====
    insert into public.registros_tiempo (id, organizacion_id, tarea_id, usuario_id, origen, minutos, fecha, nota) values
        ('16000000-0000-4000-a000-000000000001', c_org_a, '13000000-0000-4000-a000-000000000001', c_colab1, 'manual', 120, current_date - 3, 'Horas de ejemplo.'),
        ('16000000-0000-4000-a000-000000000002', c_org_a, '13000000-0000-4000-a000-000000000016', c_colab1, 'manual', 90, current_date - 2, 'Horas en un proyecto donde colab3 no está.'),
        ('16000000-0000-4000-a000-000000000003', c_org_a, '13000000-0000-4000-a000-000000000002', c_colab2, 'manual', 60, current_date - 2, null),
        ('16000000-0000-4000-a000-000000000004', c_org_a, '13000000-0000-4000-a000-000000000003', c_colab3, 'manual', 45, current_date - 1, null),
        ('16000000-0000-4000-a000-000000000005', c_org_a, '13000000-0000-4000-a000-000000000017', c_colab2, 'manual', 180, current_date - 1, null),
        ('16000000-0000-4000-a000-000000000006', c_org_a, '13000000-0000-4000-a000-000000000028', c_colab2, 'manual', 240, current_date - 25, null),
        ('26000000-0000-4000-b000-000000000001', c_org_b, '23000000-0000-4000-b000-000000000001', c_colab_b, 'manual', 30, current_date - 1, 'Horas de la Empresa B.');
end;
$$;
