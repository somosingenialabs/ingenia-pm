-- =====================================================================
-- Test SQL · Fase 4: carga por persona, dependencias en conflicto, borrar
-- comentarios y publicación de Realtime. Arma un proyecto propio con fechas
-- en 2030 (el 7 de enero de 2030 es lunes) para que las cuentas sean exactas.
-- Corre en una transacción que se deshace al final.
-- =====================================================================
begin;

create function pg_temp.como(p_usuario uuid, p_org uuid) returns void language plpgsql as $$
begin
    perform set_config('request.jwt.claims',
        json_build_object('sub', p_usuario, 'role', 'authenticated', 'org_id', p_org)::text, true);
    perform set_config('role', 'authenticated', true);
end;
$$;

create function pg_temp.como_postgres() returns void language plpgsql as $$
begin
    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', '', true);
end;
$$;

create function pg_temp.debe_fallar(p_caso text, p_sql text, p_motivo text) returns void language plpgsql as $$
declare
    v_error text;
begin
    begin
        execute p_sql;
    exception when others then
        v_error := sqlerrm;
    end;
    if v_error is null then
        raise exception 'FALLA: %: no dio error', p_caso;
    end if;
    if v_error !~* p_motivo then
        raise exception 'FALLA: %: falló por otro motivo: %', p_caso, v_error;
    end if;
end;
$$;

do $$
declare
    c_org     constant uuid := '10000000-0000-4000-a000-000000000000';
    c_org_b   constant uuid := '20000000-0000-4000-b000-000000000000';
    c_admin   constant uuid := '00000000-0000-4000-a000-000000000001';
    c_pm1     constant uuid := '00000000-0000-4000-a000-000000000002';
    c_pm2     constant uuid := '00000000-0000-4000-a000-000000000003';
    c_colab1  constant uuid := '00000000-0000-4000-a000-000000000004';
    c_colab2  constant uuid := '00000000-0000-4000-a000-000000000005';
    c_colab3  constant uuid := '00000000-0000-4000-a000-000000000006';
    c_admin_b constant uuid := '00000000-0000-4000-b000-000000000001';
    c_p4      constant uuid := '12000000-0000-4000-a000-0000000000f4';
    c_com_colab1 constant uuid := '15000000-0000-4000-a000-000000000001'; -- colab1 en tarea 1 (proyecto 1)
    c_com_p2     constant uuid := '15000000-0000-4000-a000-000000000002'; -- colab1 en tarea 16 (proyecto 2)
    c_com_pm1    constant uuid := '15000000-0000-4000-a000-000000000003'; -- pm1 en tarea 1
    c_com_pm2    constant uuid := '15000000-0000-4000-a000-000000000005'; -- pm2 en tarea 17 (proyecto 2)
    v_t_registrada uuid;
    v_t_parcial    uuid;
    v_t_pred       uuid;
    v_t_suc        uuid;
    v_t_justa      uuid;
    v_n   int;
    v_ok  int := 0;
    v_fila record;
    v_esperadas numeric;
    v_total     numeric;
    v_hoy       date;
begin
    -- ===== Datos: proyecto 4 de pm1, con colab1 =====
    insert into public.proyectos (id, organizacion_id, nombre, estado, responsable_id)
    values (c_p4, c_org, 'Proyecto de prueba de carga', 'activo', c_pm1);
    insert into public.proyecto_miembros (organizacion_id, proyecto_id, usuario_id) values (c_org, c_p4, c_colab1);

    insert into public.tareas (organizacion_id, proyecto_id, titulo, estado, asignado_id, fecha_inicio, fecha_limite, horas_estimadas, eliminado_en) values
        -- 10 h de lunes a viernes de la semana 1: 2 h por día.
        (c_org, c_p4, 'Semana 1 entera', 'por_hacer', c_colab1, '2030-01-07', '2030-01-11', 10, null),
        -- 6 h de jueves a martes: 4 días hábiles, 1,5 h cada uno. 3 h en la semana 1 y 3 en la 2.
        (c_org, c_p4, 'Cruza el fin de semana', 'en_curso', c_colab1, '2030-01-10', '2030-01-15', 6, null),
        -- Solo límite, un sábado: las 4 h van al viernes anterior (semana 2).
        (c_org, c_p4, 'Cae en sábado', 'por_hacer', c_colab1, null, '2030-01-19', 4, null),
        -- Sin estimar: no suma horas, se cuenta aparte.
        (c_org, c_p4, 'Sin estimar', 'por_hacer', c_colab1, '2030-01-08', '2030-01-08', null, null),
        -- Sin fecha: no suma horas, se cuenta aparte.
        (c_org, c_p4, 'Sin fecha', 'por_hacer', c_colab1, null, null, 8, null),
        -- Cerrada y borrada: no cuentan.
        (c_org, c_p4, 'Hecha', 'hecha', c_colab1, '2030-01-07', '2030-01-11', 100, null),
        (c_org, c_p4, 'Borrada', 'por_hacer', c_colab1, '2030-01-07', '2030-01-11', 100, now());

    -- 5 h estimadas y 6 registradas: no quedan horas, y no da negativo.
    insert into public.tareas (organizacion_id, proyecto_id, titulo, asignado_id, fecha_limite, horas_estimadas)
    values (c_org, c_p4, 'Ya registrada', c_colab1, '2030-01-21', 5) returning id into v_t_registrada;
    -- 3 h estimadas y 1 registrada: quedan 2, en la semana 3.
    insert into public.tareas (organizacion_id, proyecto_id, titulo, asignado_id, fecha_limite, horas_estimadas)
    values (c_org, c_p4, 'Registrada en parte', c_colab1, '2030-01-21', 3) returning id into v_t_parcial;
    insert into public.registros_tiempo (organizacion_id, tarea_id, usuario_id, origen, minutos, fecha) values
        (c_org, v_t_registrada, c_colab1, 'manual', 360, current_date - 1),
        (c_org, v_t_parcial, c_colab1, 'manual', 60, current_date - 1);

    -- ===== Carga: colab1 ve su fila con las cuentas exactas =====
    perform pg_temp.como(c_colab1, c_org);
    select count(*) into v_n from analitica.carga_por_persona('2030-01-07', '2030-01-27', c_p4);
    if v_n <> 3 then raise exception 'FALLA: colab1 debería ver 3 filas (1 persona x 3 semanas) y ve %', v_n; end if;
    v_ok := v_ok + 1;

    for v_fila in select * from analitica.carga_por_persona('2030-01-07', '2030-01-27', c_p4) loop
        if v_fila.usuario_id <> c_colab1 then raise exception 'FALLA: colab1 ve la fila de otra persona'; end if;
        if v_fila.capacidad <> 40 then raise exception 'FALLA: capacidad % y debería ser 40', v_fila.capacidad; end if;
        if v_fila.tareas_sin_estimar <> 1 or v_fila.tareas_sin_fecha <> 1 then
            raise exception 'FALLA: sin estimar % y sin fecha %, deberían ser 1 y 1', v_fila.tareas_sin_estimar, v_fila.tareas_sin_fecha;
        end if;
        v_esperadas := case v_fila.semana when '2030-01-07' then 13 when '2030-01-14' then 7 when '2030-01-21' then 2 end;
        if v_fila.horas_asignadas is distinct from v_esperadas then
            raise exception 'FALLA: semana % tiene % h', v_fila.semana, v_fila.horas_asignadas;
        end if;
    end loop;
    v_ok := v_ok + 4;

    -- Un rango que corta la semana cuenta solo los días de adentro: del miércoles 9 al domingo 13.
    select horas_asignadas into strict v_fila from analitica.carga_por_persona('2030-01-09', '2030-01-13', c_p4);
    if v_fila.horas_asignadas <> 9 then
        raise exception 'FALLA: del 9 al 13 deberían ser 9 h (2+2+2 y 1,5+1,5) y son %', v_fila.horas_asignadas;
    end if;
    v_ok := v_ok + 1;

    perform pg_temp.debe_fallar('rango al revés',
        'select * from analitica.carga_por_persona(''2030-01-10'', ''2030-01-01'')', 'rango de fechas no es válido');
    perform pg_temp.debe_fallar('rango de más de un año',
        'select * from analitica.carga_por_persona(''2030-01-01'', ''2031-06-01'')', 'demasiado largo');
    v_ok := v_ok + 2;

    -- Colaborador sin proyecto en común ve solo su fila; sin proyecto, solo la propia.
    select count(*) into v_n from analitica.carga_por_persona('2030-01-07', '2030-01-13');
    if v_n <> 1 then raise exception 'FALLA: colab1 sin proyecto debería ver 1 fila y ve %', v_n; end if;
    perform pg_temp.como(c_colab3, c_org);
    select count(*) into v_n from analitica.carga_por_persona('2030-01-07', '2030-01-27', c_p4);
    if v_n <> 0 then raise exception 'FALLA: colab3 ve % filas de un proyecto donde no está', v_n; end if;
    v_ok := v_ok + 2;

    -- PM ve a todos los miembros del proyecto (pm1 y colab1), y Admin a toda la empresa.
    perform pg_temp.como(c_pm1, c_org);
    select count(distinct usuario_id) into v_n from analitica.carga_por_persona('2030-01-07', '2030-01-27', c_p4);
    if v_n <> 2 then raise exception 'FALLA: pm1 debería ver 2 personas del proyecto 4 y ve %', v_n; end if;
    -- Se compara contra la base y no contra 6: los e2e suman personas a la empresa A.
    select count(distinct usuario_id) - (select count(*) from public.miembros where organizacion_id = c_org and activo)
    into v_n from analitica.carga_por_persona('2030-01-07', '2030-01-13');
    if v_n <> 0 then raise exception 'FALLA: pm1 no ve a todas las personas activas de la empresa A (diferencia %)', v_n; end if;
    v_ok := v_ok + 2;

    -- Otra empresa: nada.
    perform pg_temp.como(c_admin_b, c_org_b);
    select count(*) into v_n from analitica.carga_por_persona('2030-01-07', '2030-01-27', c_p4);
    if v_n <> 0 then raise exception 'FALLA: la empresa B ve % filas de la carga de A', v_n; end if;
    select count(*) into v_n
    from analitica.carga_por_persona('2030-01-07', '2030-01-13') where usuario_id = c_colab1;
    if v_n <> 0 then raise exception 'FALLA: la empresa B ve a colab1'; end if;
    v_ok := v_ok + 2;

    -- ===== Atrasadas y tareas ya empezadas, contra el hoy de la empresa =====
    perform pg_temp.como_postgres();
    v_hoy := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
    insert into public.tareas (organizacion_id, proyecto_id, titulo, asignado_id, fecha_inicio, fecha_limite, horas_estimadas) values
        -- Vencida hace 3 días: sus 5 h van a hoy, como atrasadas.
        (c_org, c_p4, 'Vencida', c_colab1, v_hoy - 10, v_hoy - 3, 5),
        -- Empezó hace un mes y termina en un mes: las 10 h se reparten de hoy en adelante, sin perder nada.
        (c_org, c_p4, 'En marcha', c_colab1, v_hoy - 30, v_hoy + 30, 10);

    perform pg_temp.como(c_colab1, c_org);
    select sum(horas_asignadas), sum(horas_atrasadas) into v_total, v_esperadas
    from analitica.carga_por_persona(date_trunc('week', v_hoy)::date, v_hoy + 40, c_p4);
    if abs(v_total - 15) > 0.05 then raise exception 'FALLA: deberían quedar 15 h de hoy en adelante y hay %', v_total; end if;
    if v_esperadas <> 5 then raise exception 'FALLA: deberían ser 5 h atrasadas y son %', v_esperadas; end if;
    select horas_atrasadas into v_esperadas
    from analitica.carga_por_persona(date_trunc('week', v_hoy)::date, v_hoy + 40, c_p4)
    where semana = date_trunc('week', v_hoy)::date;
    if v_esperadas <> 5 then raise exception 'FALLA: las atrasadas tienen que caer en esta semana, hay %', v_esperadas; end if;
    -- Antes de hoy no queda nada: la semana pasada está vacía.
    select sum(horas_asignadas) into v_total
    from analitica.carga_por_persona(date_trunc('week', v_hoy)::date - 7, date_trunc('week', v_hoy)::date - 1, c_p4);
    if v_total <> 0 then raise exception 'FALLA: la semana pasada tiene % h, y lo que falta no se hace en el pasado', v_total; end if;
    v_ok := v_ok + 4;

    -- ===== Dependencias en conflicto =====
    perform pg_temp.como_postgres();
    insert into public.tareas (organizacion_id, proyecto_id, titulo, asignado_id, fecha_limite)
    values (c_org, c_p4, 'Predecesora', c_colab1, '2030-02-10') returning id into v_t_pred;
    insert into public.tareas (organizacion_id, proyecto_id, titulo, asignado_id, fecha_inicio, fecha_limite)
    values (c_org, c_p4, 'Arranca antes', c_colab1, '2030-02-08', '2030-02-12') returning id into v_t_suc;
    insert into public.tareas (organizacion_id, proyecto_id, titulo, asignado_id, fecha_inicio, fecha_limite)
    values (c_org, c_p4, 'Arranca justo', c_colab1, '2030-02-10', '2030-02-12') returning id into v_t_justa;

    perform pg_temp.como(c_pm1, c_org);
    insert into public.tarea_dependencias (organizacion_id, tarea_id, depende_de_id, desfase_dias) values
        (c_org, v_t_suc, v_t_pred, 0),
        (c_org, v_t_justa, v_t_pred, 0);

    select count(*) into v_n from public.conflictos_dependencias(c_p4);
    if v_n <> 1 then raise exception 'FALLA: debería haber 1 conflicto y hay %', v_n; end if;
    select * into strict v_fila from public.conflictos_dependencias(c_p4);
    if v_fila.tarea_id <> v_t_suc or v_fila.depende_de_id <> v_t_pred
       or v_fila.debe_arrancar_desde <> '2030-02-10' or v_fila.arranca_el <> '2030-02-08' then
        raise exception 'FALLA: el conflicto no es el esperado: %', v_fila;
    end if;
    v_ok := v_ok + 2;

    -- El desfase corre la fecha: con 1 día, la que arrancaba justo también choca.
    perform pg_temp.como_postgres();
    update public.tarea_dependencias set desfase_dias = 1 where tarea_id = v_t_justa;
    perform pg_temp.como(c_pm1, c_org);
    select count(*) into v_n from public.conflictos_dependencias(c_p4);
    if v_n <> 2 then raise exception 'FALLA: con desfase debería haber 2 conflictos y hay %', v_n; end if;
    -- Sin proyecto, entran todos los proyectos visibles.
    select count(*) into v_n from public.conflictos_dependencias(null) where tarea_id in (v_t_suc, v_t_justa);
    if v_n <> 2 then raise exception 'FALLA: sin proyecto no aparecen los conflictos del proyecto 4'; end if;
    v_ok := v_ok + 2;

    -- Si la predecesora termina, no hay conflicto.
    update public.tareas set estado = 'hecha' where id = v_t_pred;
    select count(*) into v_n from public.conflictos_dependencias(c_p4);
    if v_n <> 0 then raise exception 'FALLA: con la predecesora hecha sigue habiendo % conflictos', v_n; end if;
    update public.tareas set estado = 'por_hacer' where id = v_t_pred;
    v_ok := v_ok + 1;

    -- Quien no ve el proyecto no ve sus conflictos.
    perform pg_temp.como(c_colab3, c_org);
    select count(*) into v_n from public.conflictos_dependencias(c_p4);
    if v_n <> 0 then raise exception 'FALLA: colab3 ve % conflictos de un proyecto ajeno', v_n; end if;
    perform pg_temp.como(c_admin_b, c_org_b);
    select count(*) into v_n from public.conflictos_dependencias(null) where tarea_id in (v_t_suc, v_t_justa);
    if v_n <> 0 then raise exception 'FALLA: la empresa B ve conflictos de A'; end if;
    v_ok := v_ok + 2;

    -- ===== Borrar comentarios =====
    -- Ajeno, sin ser gestor: no.
    perform pg_temp.como(c_colab2, c_org);
    perform pg_temp.debe_fallar('colaborador borra comentario ajeno',
        format('select public.eliminar_comentario(%L)', c_com_colab1), 'No podés borrar');
    -- En un proyecto que no ve, o en otra empresa: como si no existiera.
    perform pg_temp.como(c_colab3, c_org);
    perform pg_temp.debe_fallar('colaborador borra en proyecto que no ve',
        format('select public.eliminar_comentario(%L)', c_com_p2), 'no existe');
    perform pg_temp.como(c_admin_b, c_org_b);
    perform pg_temp.debe_fallar('Admin de otra empresa borra',
        format('select public.eliminar_comentario(%L)', c_com_colab1), 'no existe');
    -- PM que no es miembro del proyecto: no.
    perform pg_temp.como(c_pm2, c_org);
    perform pg_temp.debe_fallar('PM de otro proyecto borra',
        format('select public.eliminar_comentario(%L)', c_com_pm1), 'No podés borrar');
    v_ok := v_ok + 4;

    -- El autor borra el propio.
    perform pg_temp.como(c_colab1, c_org);
    perform public.eliminar_comentario(c_com_colab1);
    if (select eliminado_en from public.comentarios where id = c_com_colab1) is null then
        raise exception 'FALLA: el autor no pudo borrar su comentario';
    end if;
    -- Borrarlo de nuevo no da error, y no se puede restaurar ni editar.
    perform public.eliminar_comentario(c_com_colab1);
    perform pg_temp.debe_fallar('autor restaura su comentario borrado',
        format('update public.comentarios set eliminado_en = null where id = %L', c_com_colab1), 'eliminado no se puede editar');
    perform pg_temp.debe_fallar('autor edita su comentario borrado',
        format('update public.comentarios set cuerpo = %L where id = %L', 'Otra vez', c_com_colab1), 'eliminado no se puede editar');
    v_ok := v_ok + 3;

    -- PM gestor borra uno ajeno de su proyecto; Admin, cualquiera.
    perform pg_temp.como(c_pm1, c_org);
    perform pg_temp.debe_fallar('pm1 borra en proyecto 2', format('select public.eliminar_comentario(%L)', c_com_pm2), 'No podés borrar');
    perform pg_temp.como(c_pm2, c_org);
    perform public.eliminar_comentario(c_com_p2);
    perform pg_temp.como(c_admin, c_org);
    perform public.eliminar_comentario(c_com_pm1);
    perform pg_temp.como_postgres();
    select count(*) into v_n from public.comentarios where id in (c_com_p2, c_com_pm1) and eliminado_en is not null;
    if v_n <> 2 then raise exception 'FALLA: el gestor o el Admin no pudieron borrar, quedaron % borrados', v_n; end if;
    v_ok := v_ok + 2;

    -- Sin sesión no se llama.
    perform set_config('role', 'anon', true);
    perform pg_temp.debe_fallar('anon borra comentario',
        format('select public.eliminar_comentario(%L)', c_com_pm2), 'permission denied');
    perform pg_temp.debe_fallar('anon pide la carga',
        'select * from analitica.carga_por_persona(''2030-01-07'', ''2030-01-13'')', 'permission denied');
    perform pg_temp.como_postgres();
    v_ok := v_ok + 2;

    -- ===== Realtime publica comentarios y tareas =====
    select count(*) into v_n from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename in ('comentarios', 'tareas');
    if v_n <> 2 then raise exception 'FALLA: Realtime publica % de las 2 tablas', v_n; end if;
    v_ok := v_ok + 1;

    raise notice '% comprobaciones', v_ok;
end;
$$;

rollback;
