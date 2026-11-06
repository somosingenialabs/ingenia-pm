-- =====================================================================
-- Test SQL · Reglas del dominio y hook de token. Corre sobre el seed, en una
-- transacción que se deshace al final.
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
    c_org    constant uuid := '10000000-0000-4000-a000-000000000000';
    c_org_b  constant uuid := '20000000-0000-4000-b000-000000000000';
    c_admin  constant uuid := '00000000-0000-4000-a000-000000000001';
    c_pm1    constant uuid := '00000000-0000-4000-a000-000000000002';
    c_colab1 constant uuid := '00000000-0000-4000-a000-000000000004';
    c_colab3 constant uuid := '00000000-0000-4000-a000-000000000006';
    c_p1     constant uuid := '12000000-0000-4000-a000-000000000001';
    c_p2     constant uuid := '12000000-0000-4000-a000-000000000002';
    c_t1     constant uuid := '13000000-0000-4000-a000-000000000001'; -- p1, colab1, en_curso
    c_t2     constant uuid := '13000000-0000-4000-a000-000000000002'; -- p1, depende de t1
    c_t3     constant uuid := '13000000-0000-4000-a000-000000000003'; -- p1, depende de t2
    c_t16    constant uuid := '13000000-0000-4000-a000-000000000016'; -- p2
    v_n      int;
    v_ok     int := 0;
    v_fecha  timestamptz;
    v_evento jsonb;
    v_id     uuid;
begin
    -- ===== El seed 30 cumple lo que pide la fase (el 40 suma historia aparte) =====
    select count(*) into v_n from public.tareas where organizacion_id = c_org and id::text like '13000000-%';
    if v_n <> 30 then raise exception 'FALLA: la Empresa A debería tener 30 tareas y tiene %', v_n; end if;
    select count(distinct estado) into v_n from public.tareas where organizacion_id = c_org and id::text like '13000000-%';
    if v_n <> 5 then raise exception 'FALLA: las tareas deberían estar en 5 estados y están en %', v_n; end if;
    select count(*) into v_n from public.tarea_dependencias where organizacion_id = c_org;
    if v_n <> 3 then raise exception 'FALLA: la Empresa A debería tener 3 dependencias y tiene %', v_n; end if;
    select count(*) into v_n from public.tarea_historial_estados where organizacion_id = c_org and estado_anterior is null
        and tarea_id::text like '13000000-%';
    if v_n <> 30 then raise exception 'FALLA: cada tarea debería nacer con su fila de historial, hay %', v_n; end if;
    select count(*) into v_n from public.proyecto_miembros where proyecto_id = c_p2 and usuario_id = c_colab3;
    if v_n <> 0 then raise exception 'FALLA: colab3 debería quedar fuera del proyecto 2'; end if;
    select count(*) into v_n from public.tareas where estado = 'hecha' and completada_en is null;
    if v_n <> 0 then raise exception 'FALLA: % tareas hechas sin completada_en', v_n; end if;
    v_ok := v_ok + 6;

    -- ===== Mover a hecha pone completada_en y agrega historial. Reabrir lo limpia =====
    perform pg_temp.como(c_colab1, c_org);
    update public.tareas set estado = 'hecha' where id = c_t1;
    select completada_en into v_fecha from public.tareas where id = c_t1;
    if v_fecha is null then raise exception 'FALLA: pasar a hecha no puso completada_en'; end if;
    select count(*) into v_n from public.tarea_historial_estados
    where tarea_id = c_t1 and estado_anterior = 'en_curso' and estado_nuevo = 'hecha' and cambiado_por = c_colab1;
    if v_n <> 1 then raise exception 'FALLA: el cambio de estado no quedó en el historial a nombre de quien lo hizo'; end if;

    -- Editar otra cosa no toca completada_en ni agrega historial.
    update public.tareas set descripcion = 'Otra', estado = 'hecha' where id = c_t1;
    if (select completada_en from public.tareas where id = c_t1) <> v_fecha then
        raise exception 'FALLA: editar una tarea hecha cambió completada_en';
    end if;
    select count(*) into v_n from public.tarea_historial_estados where tarea_id = c_t1;
    if v_n <> 2 then raise exception 'FALLA: repetir el mismo estado agregó historial (% filas)', v_n; end if;

    update public.tareas set estado = 'en_curso' where id = c_t1;
    if (select completada_en from public.tareas where id = c_t1) is not null then
        raise exception 'FALLA: reabrir la tarea no limpió completada_en';
    end if;
    select count(*) into v_n from public.tarea_historial_estados where tarea_id = c_t1;
    if v_n <> 3 then raise exception 'FALLA: reabrir no quedó en el historial (% filas)', v_n; end if;
    v_ok := v_ok + 5;

    -- ===== Nadie modifica el historial, ni siquiera el Admin =====
    perform pg_temp.como(c_admin, c_org);
    perform pg_temp.debe_fallar('editar historial', 'update public.tarea_historial_estados set estado_nuevo = ''hecha''', 'permission denied');
    perform pg_temp.debe_fallar('borrar historial', 'delete from public.tarea_historial_estados', 'permission denied');
    perform pg_temp.debe_fallar('escribir historial',
        format('insert into public.tarea_historial_estados (organizacion_id, proyecto_id, tarea_id, estado_nuevo) values (%L, %L, %L, %L)', c_org, c_p1, c_t1, 'hecha'),
        'permission denied');
    v_ok := v_ok + 3;

    -- ===== proyecto y empresa de una tarea son inmutables, también para el Admin =====
    perform pg_temp.debe_fallar('mover tarea de proyecto',
        format('update public.tareas set proyecto_id = %L where id = %L', c_p2, c_t1),
        'no se pueden cambiar');
    perform pg_temp.debe_fallar('cambiar empresa del proyecto',
        format('update public.proyectos set organizacion_id = %L where id = %L', c_org_b, c_p1),
        'no se puede cambiar|row-level security');
    v_ok := v_ok + 2;

    -- ===== Dependencias =====
    perform pg_temp.como(c_pm1, c_org);
    -- t2 depende de t1 y t3 de t2 (seed): t1 dependiendo de t3 cierra el ciclo A→B→C→A.
    perform pg_temp.debe_fallar('ciclo A-B-C-A',
        format('insert into public.tarea_dependencias (organizacion_id, tarea_id, depende_de_id) values (%L, %L, %L)', c_org, c_t1, c_t3),
        'ciclo');
    perform pg_temp.debe_fallar('ciclo directo',
        format('insert into public.tarea_dependencias (organizacion_id, tarea_id, depende_de_id) values (%L, %L, %L)', c_org, c_t1, c_t2),
        'ciclo');
    perform pg_temp.debe_fallar('consigo misma',
        format('insert into public.tarea_dependencias (organizacion_id, tarea_id, depende_de_id) values (%L, %L, %L)', c_org, c_t1, c_t1),
        'ciclo|check');
    perform pg_temp.debe_fallar('entre proyectos',
        format('insert into public.tarea_dependencias (organizacion_id, tarea_id, depende_de_id) values (%L, %L, %L)', c_org, c_t1, c_t16),
        'mismo proyecto');
    -- Una válida sí entra.
    insert into public.tarea_dependencias (organizacion_id, tarea_id, depende_de_id)
    values (c_org, c_t3, c_t1);
    v_ok := v_ok + 5;

    -- ===== Asignar a alguien que no es miembro del proyecto falla =====
    perform pg_temp.como(c_admin, c_org);
    perform pg_temp.debe_fallar('asignar a un no miembro',
        format('update public.tareas set asignado_id = %L where id = %L', c_colab3, c_t16),
        'no es miembro del proyecto');
    perform pg_temp.debe_fallar('crear asignada a un no miembro',
        format('insert into public.tareas (organizacion_id, proyecto_id, titulo, asignado_id) values (%L, %L, %L, %L)', c_org, c_p2, 'Nueva', c_colab3),
        'no es miembro del proyecto');
    v_ok := v_ok + 2;

    -- Sacar a alguien del proyecto no traba las tareas que ya tenía asignadas.
    delete from public.proyecto_miembros where proyecto_id = c_p1 and usuario_id = c_colab1;
    update public.tareas set titulo = 'Sigue editable' where id = c_t1;
    get diagnostics v_n = row_count;
    if v_n <> 1 then raise exception 'FALLA: la tarea quedó trabada al sacar al asignado del proyecto'; end if;
    insert into public.proyecto_miembros (organizacion_id, proyecto_id, usuario_id) values (c_org, c_p1, c_colab1);
    v_ok := v_ok + 1;

    -- ===== Horas =====
    perform pg_temp.como(c_colab1, c_org);
    insert into public.registros_tiempo (organizacion_id, tarea_id, usuario_id, origen, inicio, fecha)
    values (c_org, c_t1, c_colab1, 'temporizador', now(), current_date - 1);
    perform pg_temp.debe_fallar('segundo temporizador',
        format('insert into public.registros_tiempo (organizacion_id, tarea_id, usuario_id, origen, inicio, fecha) values (%L, %L, %L, %L, now(), current_date - 1)', c_org, c_t1, c_colab1, 'temporizador'),
        'registros_tiempo_un_temporizador');
    perform pg_temp.debe_fallar('fecha futura',
        format('insert into public.registros_tiempo (organizacion_id, tarea_id, usuario_id, origen, minutos, fecha) values (%L, %L, %L, %L, 10, current_date + 2)', c_org, c_t1, c_colab1, 'manual'),
        'fecha futura');
    perform pg_temp.debe_fallar('manual sin minutos',
        format('insert into public.registros_tiempo (organizacion_id, tarea_id, usuario_id, origen, fecha) values (%L, %L, %L, %L, current_date - 1)', c_org, c_t1, c_colab1, 'manual'),
        'check constraint');
    v_ok := v_ok + 3;

    -- ===== Comentarios =====
    insert into public.comentarios (organizacion_id, tarea_id, autor_id, cuerpo)
    values (c_org, c_t1, c_colab1, 'Original') returning id into v_id;
    if (select editado_en from public.comentarios where id = v_id) is not null then
        raise exception 'FALLA: un comentario nuevo nace editado';
    end if;
    update public.comentarios set cuerpo = 'Corregido' where id = v_id;
    if (select editado_en from public.comentarios where id = v_id) is null then
        raise exception 'FALLA: cambiar el cuerpo no puso editado_en';
    end if;
    perform pg_temp.debe_fallar('cambiar autor del comentario',
        format('update public.comentarios set autor_id = %L where id = %L', c_pm1, v_id),
        'no se pueden cambiar');
    perform pg_temp.debe_fallar('mover comentario de tarea',
        format('update public.comentarios set tarea_id = %L where id = %L', c_t2, v_id),
        'no se pueden cambiar');
    v_ok := v_ok + 4;

    -- ===== No se puede dejar la empresa sin Admin =====
    perform pg_temp.como(c_admin, c_org);
    perform pg_temp.debe_fallar('el último Admin se baja el rol',
        format('update public.miembros set rol = %L where usuario_id = %L', 'pm', c_admin),
        'sin un Admin activo');
    perform pg_temp.debe_fallar('el último Admin se desactiva',
        format('update public.miembros set activo = false where usuario_id = %L', c_admin),
        'sin un Admin activo');
    perform pg_temp.como_postgres();
    perform pg_temp.debe_fallar('borrar al último Admin',
        format('delete from public.miembros where usuario_id = %L', c_admin),
        'sin un Admin activo');
    -- Con otro Admin activo, sí.
    perform pg_temp.como(c_admin, c_org);
    update public.miembros set rol = 'admin' where usuario_id = c_pm1;
    update public.miembros set rol = 'pm' where usuario_id = c_admin;
    get diagnostics v_n = row_count;
    if v_n <> 1 then raise exception 'FALLA: habiendo otro Admin, no se pudo bajar el rol'; end if;
    perform pg_temp.como_postgres();
    update public.miembros set rol = 'admin' where usuario_id = c_admin;
    update public.miembros set rol = 'pm' where usuario_id = c_pm1;
    v_ok := v_ok + 4;

    -- ===== Hook: org_id para el miembro activo, sin él para el inactivo =====
    v_evento := public.custom_access_token_hook(jsonb_build_object(
        'user_id', c_colab1, 'claims', jsonb_build_object('sub', c_colab1, 'org_id', 'viejo')));
    if v_evento -> 'claims' ->> 'org_id' is distinct from c_org::text then
        raise exception 'FALLA: el hook no puso org_id al miembro activo: %', v_evento;
    end if;

    update public.miembros set activo = false where usuario_id = c_colab1;
    v_evento := public.custom_access_token_hook(jsonb_build_object(
        'user_id', c_colab1, 'claims', jsonb_build_object('sub', c_colab1, 'org_id', 'viejo')));
    if (v_evento -> 'claims') ? 'org_id' then
        raise exception 'FALLA: el hook dejó org_id a un miembro inactivo: %', v_evento;
    end if;
    update public.miembros set activo = true where usuario_id = c_colab1;

    -- Una empresa activa de la que no es miembro tampoco da org_id.
    update public.perfiles set organizacion_activa_id = c_org_b where id = c_colab1;
    v_evento := public.custom_access_token_hook(jsonb_build_object(
        'user_id', c_colab1, 'claims', jsonb_build_object('sub', c_colab1)));
    if (v_evento -> 'claims') ? 'org_id' then
        raise exception 'FALLA: el hook dio org_id de una empresa ajena: %', v_evento;
    end if;
    update public.perfiles set organizacion_activa_id = c_org where id = c_colab1;

    if has_function_privilege('authenticated', 'public.custom_access_token_hook(jsonb)', 'execute')
       or has_function_privilege('anon', 'public.custom_access_token_hook(jsonb)', 'execute') then
        raise exception 'FALLA: el hook se puede llamar desde la API';
    end if;
    v_ok := v_ok + 4;

    perform pg_temp.como_postgres();
    raise notice '% comprobaciones', v_ok;
end;
$$;

rollback;
