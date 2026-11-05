-- =====================================================================
-- Test SQL · Fase 5, paso 1: temporizador. Arma un proyecto propio con
-- colab1. Dentro de una transacción now() no avanza, así que "pasó el
-- tiempo" se simula corriendo hacia atrás el inicio del registro.
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

-- Corre hacia atrás el inicio del temporizador abierto de una persona.
create function pg_temp.atrasar(p_usuario uuid, p_minutos int) returns void language plpgsql as $$
begin
    perform pg_temp.como_postgres();
    update public.registros_tiempo set inicio = inicio - make_interval(mins => p_minutos)
    where usuario_id = p_usuario and origen = 'temporizador' and fin is null;
end;
$$;

do $$
declare
    c_org     constant uuid := '10000000-0000-4000-a000-000000000000';
    c_org_b   constant uuid := '20000000-0000-4000-b000-000000000000';
    c_pm1     constant uuid := '00000000-0000-4000-a000-000000000002';
    c_colab1  constant uuid := '00000000-0000-4000-a000-000000000004';
    c_colab3  constant uuid := '00000000-0000-4000-a000-000000000006';
    c_admin_b constant uuid := '00000000-0000-4000-b000-000000000001';
    c_p       constant uuid := '12000000-0000-4000-a000-0000000000f5';
    v_t1  uuid;
    v_t2  uuid;
    v_reg public.registros_tiempo;
    v_previo public.registros_tiempo;
    v_n   int;
    v_ok  int := 0;
    v_fecha_este date;
    v_fecha_oeste date;
begin
    insert into public.proyectos (id, organizacion_id, nombre, estado, responsable_id)
    values (c_p, c_org, 'Proyecto de prueba de horas', 'activo', c_pm1);
    insert into public.proyecto_miembros (organizacion_id, proyecto_id, usuario_id) values (c_org, c_p, c_colab1);
    insert into public.tareas (organizacion_id, proyecto_id, titulo, asignado_id)
    values (c_org, c_p, 'Primera', c_colab1) returning id into v_t1;
    insert into public.tareas (organizacion_id, proyecto_id, titulo, asignado_id)
    values (c_org, c_p, 'Segunda', c_colab1) returning id into v_t2;
    -- Por si quedó algo de un e2e: colab1 arranca sin temporizador.
    delete from public.registros_tiempo where usuario_id = c_colab1 and fin is null and origen = 'temporizador';

    -- ===== Iniciar =====
    perform pg_temp.como(c_colab1, c_org);
    v_reg := public.iniciar_temporizador(v_t1);
    if v_reg.origen <> 'temporizador' or v_reg.fin is not null or v_reg.minutos is not null
       or v_reg.inicio <> now() or v_reg.usuario_id <> c_colab1 or v_reg.proyecto_id <> c_p then
        raise exception 'FALLA: el temporizador nuevo no quedó corriendo a nombre de colab1: %', row_to_json(v_reg);
    end if;
    if v_reg.fecha <> (now() at time zone 'America/Argentina/Buenos_Aires')::date then
        raise exception 'FALLA: la fecha % no es hoy en Argentina', v_reg.fecha;
    end if;
    v_ok := v_ok + 2;

    -- ===== Iniciar otro detiene el anterior =====
    perform pg_temp.atrasar(c_colab1, 30);
    perform pg_temp.como(c_colab1, c_org);
    v_previo := v_reg;
    v_reg := public.iniciar_temporizador(v_t2);
    select * into v_previo from public.registros_tiempo where id = v_previo.id;
    if v_previo.fin is null or v_previo.minutos <> 30 then
        raise exception 'FALLA: el anterior debería quedar cerrado con 30 min: fin %, minutos %', v_previo.fin, v_previo.minutos;
    end if;
    select count(*) into v_n from public.registros_tiempo where usuario_id = c_colab1 and origen = 'temporizador' and fin is null;
    if v_n <> 1 or v_reg.tarea_id <> v_t2 then
        raise exception 'FALLA: debería quedar 1 corriendo, en la segunda tarea, y hay %', v_n;
    end if;
    v_ok := v_ok + 2;

    -- ===== Detener: redondea, y nunca menos de 1 minuto =====
    perform pg_temp.atrasar(c_colab1, 90);
    perform pg_temp.como(c_colab1, c_org);
    v_reg := public.detener_temporizador(null, '  Revisé planos  ');
    if v_reg.minutos <> 90 or v_reg.fin is null or v_reg.nota <> 'Revisé planos' then
        raise exception 'FALLA: detener debería dar 90 min con la nota limpia: %', row_to_json(v_reg);
    end if;
    perform pg_temp.debe_fallar('detener sin temporizador',
        'select public.detener_temporizador()', 'no hay un temporizador corriendo');
    v_ok := v_ok + 2;

    perform public.iniciar_temporizador(v_t1);
    perform pg_temp.como_postgres();
    -- 10 segundos: queda en 1 minuto, no en 0.
    update public.registros_tiempo set inicio = now() - interval '10 seconds' where usuario_id = c_colab1 and fin is null and origen = 'temporizador';
    perform pg_temp.como(c_colab1, c_org);
    v_reg := public.detener_temporizador();
    if v_reg.minutos <> 1 then raise exception 'FALLA: 10 segundos deberían dar 1 min y dan %', v_reg.minutos; end if;
    v_ok := v_ok + 1;

    -- ===== Más de 24 h: exige los minutos =====
    perform public.iniciar_temporizador(v_t1);
    perform pg_temp.atrasar(c_colab1, 25 * 60);
    perform pg_temp.como(c_colab1, c_org);
    perform pg_temp.debe_fallar('detener a las 25 h sin minutos',
        'select public.detener_temporizador()', 'más de 24 h');
    perform pg_temp.debe_fallar('iniciar otro con uno de 25 h prendido',
        format('select public.iniciar_temporizador(%L)', v_t2), 'más de 24 h');
    perform pg_temp.debe_fallar('corregir a más de lo que estuvo prendido',
        'select public.detener_temporizador(1441)', 'entre 1 y lo que estuvo prendido');
    v_reg := public.detener_temporizador(480);
    if v_reg.minutos <> 480 then raise exception 'FALLA: con p_minutos = 480 quedó en %', v_reg.minutos; end if;
    v_ok := v_ok + 4;

    -- Corregir a la baja antes de las 24 h (la pantalla lo ofrece desde las 10 h), pero no a la suba.
    perform public.iniciar_temporizador(v_t1);
    perform pg_temp.atrasar(c_colab1, 11 * 60);
    perform pg_temp.como(c_colab1, c_org);
    perform pg_temp.debe_fallar('corregir a la suba',
        'select public.detener_temporizador(700)', 'entre 1 y lo que estuvo prendido');
    v_reg := public.detener_temporizador(120);
    if v_reg.minutos <> 120 then raise exception 'FALLA: la corrección a 120 min quedó en %', v_reg.minutos; end if;
    v_ok := v_ok + 2;

    -- ===== Descartar =====
    v_reg := public.iniciar_temporizador(v_t1);
    perform public.descartar_temporizador();
    select count(*) into v_n from public.registros_tiempo where id = v_reg.id;
    if v_n <> 0 then raise exception 'FALLA: descartar no borró el temporizador'; end if;
    perform public.descartar_temporizador(); -- sin temporizador, no falla
    v_ok := v_ok + 1;

    -- Descartar no toca los cerrados.
    select count(*) into v_n from public.registros_tiempo where usuario_id = c_colab1 and proyecto_id = c_p;
    if v_n <> 5 then raise exception 'FALLA: deberían quedar 5 registros cerrados y hay %', v_n; end if;
    v_ok := v_ok + 1;

    -- ===== Quién puede =====
    -- colab3 no es miembro del proyecto: para él la tarea no existe.
    perform pg_temp.como(c_colab3, c_org);
    perform pg_temp.debe_fallar('colaborador fuera del proyecto',
        format('select public.iniciar_temporizador(%L)', v_t1), 'la tarea no existe');
    -- Otra empresa, aunque pase el id.
    perform pg_temp.como(c_admin_b, c_org_b);
    perform pg_temp.debe_fallar('otra empresa',
        format('select public.iniciar_temporizador(%L)', v_t1), 'la tarea no existe');
    -- El PM no puede detener ni descartar el de colab1: las funciones solo tocan el propio.
    perform pg_temp.como(c_colab1, c_org);
    v_reg := public.iniciar_temporizador(v_t1);
    perform pg_temp.como(c_pm1, c_org);
    perform public.descartar_temporizador();
    perform pg_temp.debe_fallar('PM detiene el de otro',
        'select public.detener_temporizador()', 'no hay un temporizador corriendo');
    select count(*) into v_n from public.registros_tiempo where id = v_reg.id and fin is null;
    if v_n <> 1 then raise exception 'FALLA: el PM tocó el temporizador de colab1'; end if;
    v_ok := v_ok + 3;

    -- Una tarea borrada no se puede medir.
    perform pg_temp.como_postgres();
    update public.tareas set eliminado_en = now() where id = v_t2;
    perform pg_temp.como(c_colab1, c_org);
    perform pg_temp.debe_fallar('tarea borrada',
        format('select public.iniciar_temporizador(%L)', v_t2), 'la tarea no existe');
    perform public.descartar_temporizador();
    v_ok := v_ok + 1;

    -- ===== Cambio de día por la zona de la empresa =====
    -- Kiritimati (UTC+14) y Pago Pago (UTC-11) están a 25 h: nunca comparten fecha. La fecha del
    -- temporizador tiene que seguir a la empresa, no al reloj UTC del servidor.
    perform pg_temp.como_postgres();
    update public.organizaciones set zona_horaria = 'Pacific/Kiritimati' where id = c_org;
    perform pg_temp.como(c_colab1, c_org);
    v_reg := public.iniciar_temporizador(v_t1);
    v_fecha_este := v_reg.fecha;
    perform public.descartar_temporizador();

    perform pg_temp.como_postgres();
    update public.organizaciones set zona_horaria = 'Pacific/Pago_Pago' where id = c_org;
    perform pg_temp.como(c_colab1, c_org);
    v_reg := public.iniciar_temporizador(v_t1);
    v_fecha_oeste := v_reg.fecha;
    perform public.descartar_temporizador();

    if v_fecha_este <> (now() at time zone 'Pacific/Kiritimati')::date
       or v_fecha_oeste <> (now() at time zone 'Pacific/Pago_Pago')::date
       or v_fecha_este = v_fecha_oeste then
        raise exception 'FALLA: las fechas % (UTC+14) y % (UTC-11) no siguen a la zona de la empresa', v_fecha_este, v_fecha_oeste;
    end if;
    v_ok := v_ok + 1;

    -- anon no puede llamar a nada.
    perform pg_temp.como_postgres();
    select count(*) into v_n from information_schema.role_routine_grants
    where grantee in ('anon', 'PUBLIC') and routine_schema = 'public'
      and routine_name in ('iniciar_temporizador', 'detener_temporizador', 'descartar_temporizador');
    if v_n <> 0 then raise exception 'FALLA: anon o public pueden llamar al temporizador (% permisos)', v_n; end if;
    v_ok := v_ok + 1;

    raise notice '% comprobaciones en verde', v_ok;
end;
$$;

rollback;
