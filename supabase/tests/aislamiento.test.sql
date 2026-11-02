-- =====================================================================
-- Test SQL · Aislamiento entre empresas. Corre sobre el seed, en una
-- transacción que se deshace al final. Si algo falla, corta con "FALLA: ...".
-- Cada caso se hace "como" un usuario: rol authenticated + su JWT simulado.
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

-- Tiene que fallar, y por el motivo esperado: así un error de tipeo en el test no pasa por bueno.
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

-- Cuántas filas afectó una escritura.
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
    c_org_a    constant uuid := '10000000-0000-4000-a000-000000000000';
    c_org_b    constant uuid := '20000000-0000-4000-b000-000000000000';
    c_admin_a  constant uuid := '00000000-0000-4000-a000-000000000001';
    c_pm1_a    constant uuid := '00000000-0000-4000-a000-000000000002';
    c_colab1_a constant uuid := '00000000-0000-4000-a000-000000000004';
    c_admin_b  constant uuid := '00000000-0000-4000-b000-000000000001';
    c_colab_b  constant uuid := '00000000-0000-4000-b000-000000000002';
    c_p1_a     constant uuid := '12000000-0000-4000-a000-000000000001';
    c_t1_a     constant uuid := '13000000-0000-4000-a000-000000000001';
    c_p_b      constant uuid := '22000000-0000-4000-b000-000000000001';
    c_t1_b     constant uuid := '23000000-0000-4000-b000-000000000001';
    c_t3_b     constant uuid := '23000000-0000-4000-b000-000000000003';
    c_c_b      constant uuid := '25000000-0000-4000-b000-000000000001';
    c_h_b      constant uuid := '26000000-0000-4000-b000-000000000001';
    c_tablas   constant text[] := array['miembros', 'invitaciones', 'proyectos', 'proyecto_miembros', 'tareas',
                                        'tarea_dependencias', 'comentarios', 'registros_tiempo'];
    v_tabla text;
    v_n     int;
    v_ok    int := 0;
    v_quien uuid;
begin
    -- ===== Toda tabla de public tiene RLS =====
    select count(*) into v_n
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
    if v_n <> 0 then raise exception 'FALLA: % tablas de public sin RLS', v_n; end if;
    v_ok := v_ok + 1;

    -- ===== Nadie sin sesión toca nada, y TRUNCATE (que saltea el RLS) no está al alcance =====
    select count(*) into v_n
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and (has_table_privilege('anon', c.oid, 'select, insert, update, delete, truncate')
           or has_table_privilege('authenticated', c.oid, 'truncate'));
    if v_n <> 0 then raise exception 'FALLA: % tablas con permisos de más para anon o truncate', v_n; end if;
    v_ok := v_ok + 1;

    -- ===== Los datos de B existen: si no, los conteos en cero no prueban nada =====
    insert into public.invitaciones (organizacion_id, email, token_hash)
    values (c_org_b, 'invitada.b@prueba.test', 'hash-de-prueba-b');
    foreach v_tabla in array c_tablas || array['tarea_historial_estados'] loop
        execute format('select count(*) from public.%I where organizacion_id = $1', v_tabla) into v_n using c_org_b;
        if v_n = 0 then raise exception 'FALLA: el seed no cargó % en B', v_tabla; end if;
    end loop;

    -- ===== Por cada tabla: un usuario de A no ve, no edita y no borra nada de B =====
    foreach v_quien in array array[c_admin_a, c_pm1_a, c_colab1_a] loop
        perform pg_temp.como(v_quien, c_org_a);
        foreach v_tabla in array c_tablas loop
            execute format('select count(*) from public.%I where organizacion_id = $1', v_tabla) into v_n using c_org_b;
            if v_n <> 0 then raise exception 'FALLA: % ve % filas de B en %', v_quien, v_n, v_tabla; end if;

            v_n := pg_temp.filas(format('update public.%I set organizacion_id = organizacion_id where organizacion_id = %L', v_tabla, c_org_b));
            if v_n <> 0 then raise exception 'FALLA: % editó % filas de B en %', v_quien, v_n, v_tabla; end if;

            v_n := pg_temp.filas(format('delete from public.%I where organizacion_id = %L', v_tabla, c_org_b));
            if v_n <> 0 then raise exception 'FALLA: % borró % filas de B en %', v_quien, v_n, v_tabla; end if;
            v_ok := v_ok + 3;
        end loop;

        select count(*) into v_n from public.tarea_historial_estados where organizacion_id = c_org_b;
        if v_n <> 0 then raise exception 'FALLA: % ve el historial de B', v_quien; end if;
        select count(*) into v_n from public.organizaciones where id = c_org_b;
        if v_n <> 0 then raise exception 'FALLA: % ve la Empresa B', v_quien; end if;
        v_n := pg_temp.filas(format('update public.organizaciones set nombre = %L where id = %L', 'Hackeada', c_org_b));
        if v_n <> 0 then raise exception 'FALLA: % editó la Empresa B', v_quien; end if;
        select count(*) into v_n from public.perfiles where id = c_colab_b;
        if v_n <> 0 then raise exception 'FALLA: % ve un perfil de B', v_quien; end if;
        v_ok := v_ok + 4;
    end loop;

    -- ===== Adivinando ids, tampoco =====
    perform pg_temp.como(c_admin_a, c_org_a);
    select
        (select count(*) from public.proyectos where id = c_p_b)
      + (select count(*) from public.tareas where id = c_t1_b)
      + (select count(*) from public.comentarios where id = c_c_b)
      + (select count(*) from public.registros_tiempo where id = c_h_b)
      + (select count(*) from public.tarea_dependencias where depende_de_id = c_t1_b)
    into v_n;
    if v_n <> 0 then raise exception 'FALLA: el Admin de A lee % filas de B por id', v_n; end if;
    v_n := pg_temp.filas(format('update public.tareas set titulo = %L where id = %L', 'Hackeada', c_t1_b));
    if v_n <> 0 then raise exception 'FALLA: el Admin de A editó una tarea de B por id'; end if;
    v_ok := v_ok + 2;

    -- ===== Insertar con organizacion_id de B falla, tabla por tabla =====
    perform pg_temp.debe_fallar('proyecto en B',
        format('insert into public.proyectos (organizacion_id, nombre, responsable_id) values (%L, %L, %L)', c_org_b, 'Intruso', c_admin_b),
        'row-level security');
    perform pg_temp.debe_fallar('miembro en B',
        format('insert into public.miembros (organizacion_id, usuario_id) values (%L, %L)', c_org_b, c_colab1_a),
        'row-level security');
    perform pg_temp.debe_fallar('invitación en B',
        format('insert into public.invitaciones (organizacion_id, email, token_hash) values (%L, %L, %L)', c_org_b, 'x@prueba.test', 'x'),
        'row-level security');
    perform pg_temp.debe_fallar('miembro de proyecto en B',
        format('insert into public.proyecto_miembros (organizacion_id, proyecto_id, usuario_id) values (%L, %L, %L)', c_org_b, c_p_b, c_colab_b),
        'row-level security');
    perform pg_temp.debe_fallar('tarea en B',
        format('insert into public.tareas (organizacion_id, proyecto_id, titulo) values (%L, %L, %L)', c_org_b, c_p_b, 'Intrusa'),
        'row-level security');
    perform pg_temp.debe_fallar('dependencia en B',
        format('insert into public.tarea_dependencias (organizacion_id, tarea_id, depende_de_id) values (%L, %L, %L)', c_org_b, c_t3_b, c_t1_b),
        'row-level security|no existe');
    perform pg_temp.debe_fallar('comentario en B',
        format('insert into public.comentarios (organizacion_id, tarea_id, autor_id, cuerpo) values (%L, %L, %L, %L)', c_org_b, c_t1_b, c_admin_a, 'Intruso'),
        'row-level security');
    perform pg_temp.debe_fallar('horas en B',
        format('insert into public.registros_tiempo (organizacion_id, tarea_id, usuario_id, origen, minutos, fecha) values (%L, %L, %L, %L, 10, current_date - 1)', c_org_b, c_t1_b, c_admin_a, 'manual'),
        'row-level security');
    v_ok := v_ok + 8;

    -- ===== Una FK cruzada falla: fila de A que apunta a algo de B =====
    perform pg_temp.debe_fallar('tarea de A en proyecto de B',
        format('insert into public.tareas (organizacion_id, proyecto_id, titulo) values (%L, %L, %L)', c_org_a, c_p_b, 'Cruzada'),
        'row-level security|foreign key');
    perform pg_temp.debe_fallar('proyecto de A con responsable de B',
        format('insert into public.proyectos (organizacion_id, nombre, responsable_id) values (%L, %L, %L)', c_org_a, 'Cruzado', c_admin_b),
        'foreign key');
    perform pg_temp.debe_fallar('miembro de proyecto de A que es de B',
        format('insert into public.proyecto_miembros (organizacion_id, proyecto_id, usuario_id) values (%L, %L, %L)', c_org_a, c_p1_a, c_admin_b),
        'foreign key');
    perform pg_temp.debe_fallar('dependencia de A hacia tarea de B',
        format('insert into public.tarea_dependencias (organizacion_id, tarea_id, depende_de_id) values (%L, %L, %L)', c_org_a, c_t1_a, c_t1_b),
        'no existe|foreign key');
    perform pg_temp.debe_fallar('comentario de A en tarea de B',
        format('insert into public.comentarios (organizacion_id, tarea_id, autor_id, cuerpo) values (%L, %L, %L, %L)', c_org_a, c_t1_b, c_admin_a, 'Cruzado'),
        'row-level security|foreign key');
    perform pg_temp.debe_fallar('horas de A en tarea de B',
        format('insert into public.registros_tiempo (organizacion_id, tarea_id, usuario_id, origen, minutos, fecha) values (%L, %L, %L, %L, 10, current_date - 1)', c_org_a, c_t1_b, c_admin_a, 'manual'),
        'no existe en esta empresa');
    v_ok := v_ok + 6;

    -- ===== Tampoco con postgres: la FK frena aunque el RLS no esté en el medio =====
    perform pg_temp.como_postgres();
    perform pg_temp.debe_fallar('FK cruzada sin RLS',
        format('insert into public.tareas (organizacion_id, proyecto_id, titulo) values (%L, %L, %L)', c_org_a, c_p_b, 'Cruzada'),
        'foreign key');
    v_ok := v_ok + 1;

    -- ===== Un token falsificado con la empresa de otro no da acceso =====
    perform pg_temp.como(c_colab1_a, c_org_b);
    select count(*) into v_n from public.proyectos;
    if v_n <> 0 then raise exception 'FALLA: un usuario de A entra a B cambiando org_id del token'; end if;
    select count(*) into v_n from public.tareas;
    if v_n <> 0 then raise exception 'FALLA: un usuario de A ve tareas con org_id de B'; end if;
    perform pg_temp.debe_fallar('escribir con org_id ajeno',
        format('insert into public.tareas (organizacion_id, proyecto_id, titulo) values (%L, %L, %L)', c_org_b, c_p_b, 'Intrusa'),
        'row-level security');
    v_ok := v_ok + 3;

    -- ===== Y B no ve lo de A =====
    perform pg_temp.como(c_admin_b, c_org_b);
    select count(*) into v_n from public.proyectos;
    if v_n <> 1 then raise exception 'FALLA: el Admin de B debería ver 1 proyecto y ve %', v_n; end if;
    select count(*) into v_n from public.tareas where organizacion_id = c_org_a;
    if v_n <> 0 then raise exception 'FALLA: el Admin de B ve tareas de A'; end if;
    v_ok := v_ok + 2;

    perform pg_temp.como_postgres();
    raise notice '% comprobaciones', v_ok;
end;
$$;

rollback;
