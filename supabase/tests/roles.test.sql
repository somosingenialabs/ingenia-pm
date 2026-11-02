-- =====================================================================
-- Test SQL · Matriz de roles (arquitectura, sección 2). Corre sobre el seed,
-- en una transacción que se deshace al final.
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

create function pg_temp.filas(p_sql text) returns int language plpgsql as $$
declare
    v_n int;
begin
    execute p_sql;
    get diagnostics v_n = row_count;
    return v_n;
end;
$$;

do $$
declare
    c_org    constant uuid := '10000000-0000-4000-a000-000000000000';
    c_admin  constant uuid := '00000000-0000-4000-a000-000000000001';
    c_pm1    constant uuid := '00000000-0000-4000-a000-000000000002';
    c_pm2    constant uuid := '00000000-0000-4000-a000-000000000003';
    c_colab1 constant uuid := '00000000-0000-4000-a000-000000000004';
    c_colab2 constant uuid := '00000000-0000-4000-a000-000000000005';
    c_colab3 constant uuid := '00000000-0000-4000-a000-000000000006';
    c_p1     constant uuid := '12000000-0000-4000-a000-000000000001';
    c_p2     constant uuid := '12000000-0000-4000-a000-000000000002';
    c_t1     constant uuid := '13000000-0000-4000-a000-000000000001'; -- p1, colab1
    c_t2     constant uuid := '13000000-0000-4000-a000-000000000002'; -- p1, colab2
    c_t16    constant uuid := '13000000-0000-4000-a000-000000000016'; -- p2, colab1
    c_c_colab1 constant uuid := '15000000-0000-4000-a000-000000000001';
    c_h_colab1 constant uuid := '16000000-0000-4000-a000-000000000001';
    v_n    int;
    v_ok   int := 0;
    v_id   uuid;
    v_col  text;
begin
    -- ===== El seed tiene lo que este test necesita =====
    if (select asignado_id from public.tareas where id = c_t1) <> c_colab1
       or (select asignado_id from public.tareas where id = c_t2) <> c_colab2
       or (select asignado_id from public.tareas where id = c_t16) <> c_colab1 then
        raise exception 'FALLA: el seed cambió las asignaciones que usa este test';
    end if;

    -- ===== Colaborador no ve el proyecto donde no es miembro, ni nada de adentro =====
    perform pg_temp.como(c_colab3, c_org);
    select count(*) into v_n from public.proyectos where id = c_p2;
    if v_n <> 0 then raise exception 'FALLA: colab3 ve el proyecto 2'; end if;
    select count(*) into v_n from public.tareas where proyecto_id = c_p2;
    if v_n <> 0 then raise exception 'FALLA: colab3 ve % tareas del proyecto 2', v_n; end if;
    select count(*) into v_n from public.comentarios where tarea_id = c_t16;
    if v_n <> 0 then raise exception 'FALLA: colab3 ve comentarios del proyecto 2'; end if;
    select count(*) into v_n from public.registros_tiempo where proyecto_id = c_p2;
    if v_n <> 0 then raise exception 'FALLA: colab3 ve horas del proyecto 2'; end if;
    select count(*) into v_n from public.tarea_historial_estados where proyecto_id = c_p2;
    if v_n <> 0 then raise exception 'FALLA: colab3 ve el historial del proyecto 2'; end if;
    select count(*) into v_n from public.proyecto_miembros where proyecto_id = c_p2;
    if v_n <> 0 then raise exception 'FALLA: colab3 ve los miembros del proyecto 2'; end if;
    v_ok := v_ok + 6;

    -- Y sí ve los suyos.
    select count(*) into v_n from public.proyectos;
    if v_n <> 2 then raise exception 'FALLA: colab3 debería ver 2 proyectos y ve %', v_n; end if;
    select count(*) into v_n from public.tareas where proyecto_id = c_p1;
    if v_n <> 14 then raise exception 'FALLA: colab3 debería ver las 14 tareas del proyecto 1 y ve %', v_n; end if;
    v_ok := v_ok + 2;

    -- Tampoco comenta ni carga horas donde no es miembro.
    perform pg_temp.debe_fallar('comentar en proyecto ajeno',
        format('insert into public.comentarios (organizacion_id, tarea_id, autor_id, cuerpo) values (%L, %L, %L, %L)', c_org, c_t16, c_colab3, 'No'),
        'row-level security');
    perform pg_temp.debe_fallar('horas en proyecto ajeno',
        format('insert into public.registros_tiempo (organizacion_id, tarea_id, usuario_id, origen, minutos, fecha) values (%L, %L, %L, %L, 10, current_date - 1)', c_org, c_t16, c_colab3, 'manual'),
        'row-level security');
    v_ok := v_ok + 2;

    -- ===== Colaborador cambia estado de su tarea, pero no el resto =====
    perform pg_temp.como(c_colab1, c_org);
    v_n := pg_temp.filas(format('update public.tareas set estado = %L, posicion = 1500, descripcion = %L where id = %L', 'en_revision', 'Nueva descripción', c_t1));
    if v_n <> 1 then raise exception 'FALLA: colab1 no pudo cambiar el estado de su tarea'; end if;
    v_ok := v_ok + 1;

    foreach v_col in array array[
        'titulo = ''Otro título''',
        'fecha_limite = current_date + 100',
        format('asignado_id = %L', c_colab2),
        'prioridad = ''urgente''',
        'horas_estimadas = 99',
        'eliminado_en = now()'
    ] loop
        perform pg_temp.debe_fallar('colaborador cambia ' || v_col,
            format('update public.tareas set %s where id = %L', v_col, c_t1),
            'Solo podés cambiar el estado');
        v_ok := v_ok + 1;
    end loop;

    -- completada_en no se escribe a mano: se ignora.
    update public.tareas set completada_en = '2000-01-01' where id = c_t1;
    if (select completada_en from public.tareas where id = c_t1) is not null then
        raise exception 'FALLA: colab1 escribió completada_en a mano';
    end if;
    v_ok := v_ok + 1;

    -- No toca tareas ajenas.
    v_n := pg_temp.filas(format('update public.tareas set estado = %L where id = %L', 'hecha', c_t2));
    if v_n <> 0 then raise exception 'FALLA: colab1 cambió la tarea de colab2'; end if;
    v_ok := v_ok + 1;

    -- ===== PM ve todo; edita solo donde es miembro =====
    perform pg_temp.como(c_pm1, c_org);
    select count(*) into v_n from public.proyectos;
    if v_n <> 3 then raise exception 'FALLA: el PM debería ver 3 proyectos y ve %', v_n; end if;
    select count(*) into v_n from public.tareas;
    if v_n <> 30 then raise exception 'FALLA: el PM debería ver 30 tareas y ve %', v_n; end if;
    select count(*) into v_n from public.registros_tiempo where proyecto_id = c_p2;
    if v_n = 0 then raise exception 'FALLA: el PM no ve horas del proyecto 2'; end if;
    v_ok := v_ok + 3;

    v_n := pg_temp.filas(format('update public.tareas set titulo = %L where id = %L', 'Editada por pm1', c_t1));
    if v_n <> 1 then raise exception 'FALLA: pm1 no pudo editar una tarea de su proyecto'; end if;
    v_n := pg_temp.filas(format('update public.proyectos set nombre = %L where id = %L', 'Editado por pm1', c_p1));
    if v_n <> 1 then raise exception 'FALLA: pm1 no pudo editar su proyecto'; end if;
    v_n := pg_temp.filas(format('update public.tareas set titulo = %L where id = %L', 'No', c_t16));
    if v_n <> 0 then raise exception 'FALLA: pm1 editó una tarea de un proyecto donde no es miembro'; end if;
    v_n := pg_temp.filas(format('update public.proyectos set nombre = %L where id = %L', 'No', c_p2));
    if v_n <> 0 then raise exception 'FALLA: pm1 editó un proyecto donde no es miembro'; end if;
    perform pg_temp.debe_fallar('PM crea tarea donde no es miembro',
        format('insert into public.tareas (organizacion_id, proyecto_id, titulo) values (%L, %L, %L)', c_org, c_p2, 'No'),
        'row-level security');
    perform pg_temp.debe_fallar('PM agrega miembros donde no es miembro',
        format('insert into public.proyecto_miembros (organizacion_id, proyecto_id, usuario_id) values (%L, %L, %L)', c_org, c_p2, c_pm1),
        'row-level security');
    v_ok := v_ok + 6;

    -- ===== Colaborador no crea proyectos ni tareas =====
    perform pg_temp.como(c_colab1, c_org);
    perform pg_temp.debe_fallar('colaborador crea proyecto',
        format('insert into public.proyectos (organizacion_id, nombre, responsable_id) values (%L, %L, %L)', c_org, 'No', c_colab1),
        'row-level security');
    perform pg_temp.debe_fallar('colaborador crea tarea',
        format('insert into public.tareas (organizacion_id, proyecto_id, titulo) values (%L, %L, %L)', c_org, c_p1, 'No'),
        'row-level security');
    v_ok := v_ok + 2;

    -- ===== PM crea un proyecto y queda como miembro, y gestor del proyecto =====
    perform pg_temp.como(c_pm2, c_org);
    -- creado_por lo pone la base, aunque el pedido traiga otro.
    insert into public.proyectos (organizacion_id, nombre, responsable_id, creado_por)
    values (c_org, 'Proyecto nuevo del PM', c_colab1, c_pm1)
    returning id into v_id;
    if (select creado_por from public.proyectos where id = v_id) <> c_pm2 then
        raise exception 'FALLA: creado_por quedó a nombre de otro';
    end if;
    select count(*) into v_n from public.proyecto_miembros where proyecto_id = v_id and usuario_id in (c_pm2, c_colab1);
    if v_n <> 2 then raise exception 'FALLA: quien crea y el responsable deberían ser miembros, hay %', v_n; end if;
    insert into public.tareas (organizacion_id, proyecto_id, titulo, asignado_id) values (c_org, v_id, 'Primera tarea', c_colab1);
    v_ok := v_ok + 3;

    -- ===== Solo Admin marca eliminado_en en un proyecto =====
    perform pg_temp.como(c_pm1, c_org);
    perform pg_temp.debe_fallar('PM borra su proyecto',
        format('update public.proyectos set eliminado_en = now() where id = %L', c_p1),
        'Solo un Admin');
    perform pg_temp.como(c_admin, c_org);
    v_n := pg_temp.filas(format('update public.proyectos set eliminado_en = now() where id = %L', c_p1));
    if v_n <> 1 then raise exception 'FALLA: el Admin no pudo borrar el proyecto'; end if;
    -- Sigue visible: el RLS no filtra eliminado_en, filtra la capa de datos.
    select count(*) into v_n from public.proyectos where id = c_p1;
    if v_n <> 1 then raise exception 'FALLA: el borrado lógico ocultó la fila por RLS'; end if;
    update public.proyectos set eliminado_en = null where id = c_p1;
    v_ok := v_ok + 3;

    -- ===== Nadie borra de verdad =====
    foreach v_id in array array[c_admin, c_pm1, c_colab1] loop
        perform pg_temp.como(v_id, c_org);
        v_n := pg_temp.filas(format('delete from public.proyectos where id = %L', c_p1))
             + pg_temp.filas(format('delete from public.tareas where id = %L', c_t1))
             + pg_temp.filas(format('delete from public.comentarios where id = %L', c_c_colab1))
             + pg_temp.filas(format('delete from public.miembros where usuario_id = %L', c_colab3))
             + pg_temp.filas(format('delete from public.organizaciones where id = %L', c_org));
        if v_n <> 0 then raise exception 'FALLA: % borró % filas', v_id, v_n; end if;
        v_ok := v_ok + 1;
    end loop;

    -- ===== Un usuario no comenta ni carga horas a nombre de otro =====
    perform pg_temp.como(c_colab2, c_org);
    perform pg_temp.debe_fallar('comentar a nombre de otro',
        format('insert into public.comentarios (organizacion_id, tarea_id, autor_id, cuerpo) values (%L, %L, %L, %L)', c_org, c_t1, c_colab1, 'No'),
        'row-level security');
    perform pg_temp.debe_fallar('horas a nombre de otro',
        format('insert into public.registros_tiempo (organizacion_id, tarea_id, usuario_id, origen, minutos, fecha) values (%L, %L, %L, %L, 10, current_date - 1)', c_org, c_t1, c_colab1, 'manual'),
        'row-level security');
    v_n := pg_temp.filas(format('update public.comentarios set cuerpo = %L where id = %L', 'Editado', c_c_colab1));
    if v_n <> 0 then raise exception 'FALLA: colab2 editó el comentario de colab1'; end if;
    v_n := pg_temp.filas(format('update public.registros_tiempo set minutos = 1 where id = %L', c_h_colab1))
         + pg_temp.filas(format('delete from public.registros_tiempo where id = %L', c_h_colab1));
    if v_n <> 0 then raise exception 'FALLA: colab2 tocó las horas de colab1'; end if;
    v_ok := v_ok + 4;

    -- El PM tampoco corrige horas ajenas; el Admin, sí.
    perform pg_temp.como(c_pm1, c_org);
    v_n := pg_temp.filas(format('update public.registros_tiempo set minutos = 1 where id = %L', c_h_colab1));
    if v_n <> 0 then raise exception 'FALLA: el PM corrigió horas ajenas'; end if;
    perform pg_temp.como(c_admin, c_org);
    v_n := pg_temp.filas(format('update public.registros_tiempo set minutos = 100 where id = %L', c_h_colab1));
    if v_n <> 1 then raise exception 'FALLA: el Admin no pudo corregir horas ajenas'; end if;
    v_ok := v_ok + 2;

    -- Cada uno carga y edita lo propio.
    perform pg_temp.como(c_colab1, c_org);
    insert into public.registros_tiempo (organizacion_id, tarea_id, usuario_id, origen, minutos, fecha, proyecto_id)
    values (c_org, c_t1, c_colab1, 'manual', 30, current_date - 1, c_p2)
    returning id into v_id;
    -- El proyecto sale de la tarea, no del pedido.
    if (select proyecto_id from public.registros_tiempo where id = v_id) <> c_p1 then
        raise exception 'FALLA: proyecto_id no se copió de la tarea';
    end if;
    update public.comentarios set cuerpo = 'Editado por el autor' where id = c_c_colab1;
    get diagnostics v_n = row_count;
    if v_n <> 1 then raise exception 'FALLA: colab1 no pudo editar su comentario'; end if;
    v_ok := v_ok + 2;

    -- ===== Configuración de la empresa: solo Admin =====
    foreach v_id in array array[c_pm1, c_colab1] loop
        perform pg_temp.como(v_id, c_org);
        v_n := pg_temp.filas(format('update public.organizaciones set nombre = %L where id = %L', 'No', c_org))
             + pg_temp.filas(format('update public.miembros set rol = %L where usuario_id = %L', 'admin', v_id));
        if v_n <> 0 then raise exception 'FALLA: % editó la empresa o se subió el rol', v_id; end if;
        perform pg_temp.debe_fallar('invitar sin ser Admin',
            format('insert into public.invitaciones (organizacion_id, email, token_hash) values (%L, %L, %L)', c_org, 'y@prueba.test', 'y'),
            'row-level security');
        select count(*) into v_n from public.invitaciones;
        if v_n <> 0 then raise exception 'FALLA: % ve invitaciones', v_id; end if;
        v_ok := v_ok + 3;
    end loop;
    perform pg_temp.como(c_admin, c_org);
    insert into public.invitaciones (organizacion_id, email, token_hash, rol) values (c_org, 'z@prueba.test', 'z', 'pm');
    update public.miembros set horas_semanales = 30 where usuario_id = c_colab1;
    get diagnostics v_n = row_count;
    if v_n <> 1 then raise exception 'FALLA: el Admin no pudo editar un miembro'; end if;
    v_ok := v_ok + 2;

    -- ===== Miembro desactivado no ve nada, aunque su token siga vigente =====
    perform pg_temp.como_postgres();
    update public.miembros set activo = false where usuario_id = c_colab1;
    perform pg_temp.como(c_colab1, c_org);
    select
        (select count(*) from public.proyectos)
      + (select count(*) from public.proyecto_miembros)
      + (select count(*) from public.tareas)
      + (select count(*) from public.tarea_dependencias)
      + (select count(*) from public.tarea_historial_estados)
      + (select count(*) from public.comentarios)
      + (select count(*) from public.registros_tiempo)
      + (select count(*) from public.miembros)
      + (select count(*) from public.organizaciones)
    into v_n;
    if v_n <> 0 then raise exception 'FALLA: un miembro desactivado ve % filas', v_n; end if;
    v_n := pg_temp.filas(format('update public.tareas set estado = %L where id = %L', 'hecha', c_t1));
    if v_n <> 0 then raise exception 'FALLA: un miembro desactivado cambió una tarea'; end if;
    perform pg_temp.debe_fallar('desactivado comenta',
        format('insert into public.comentarios (organizacion_id, tarea_id, autor_id, cuerpo) values (%L, %L, %L, %L)', c_org, c_t1, c_colab1, 'No'),
        'row-level security');
    v_ok := v_ok + 3;

    perform pg_temp.como_postgres();
    raise notice '% comprobaciones', v_ok;
end;
$$;

rollback;
