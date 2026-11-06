-- =====================================================================
-- Test SQL · Fase 5, paso 3: métricas de analítica.
--
-- Arma una empresa aislada (M) con tres personas y un proyecto, con fechas
-- fijas de enero de 2026 en Argentina (UTC-3), y compara cada función con el
-- resultado calculado a mano. Período: lunes 5 al domingo 18 de enero, dos
-- semanas, 10 días hábiles. Corre en una transacción que se deshace al final.
--
-- Personas: am (admin, 40 h), cx (colaborador, 40 h), cy (colaborador, 20 h).
-- Tareas del proyecto M1 (horas entre pasos; "->" es un cambio de estado):
--   T1  cx  hecha. 5/1 09:00 por_hacer, 13:00 en_curso, 6/1 13:00 en_revision,
--           15:00 en_curso (vuelve), 7/1 09:00 en_revision, 15:00 hecha.
--           Estimada 10 h; registros cx 600 min (5/1) y cy 300 min (6/1): 1,5.
--           Límite 7/1: a tiempo. Lead 54 h, ciclo 50 h.
--   T2  cy  hecha. 8/1 09:00 por_hacer, 10:00 en_curso, 18:00 en_revision,
--           9/1 10:00 hecha. Estimada 4 h; cy 180 min (8/1): 0,75.
--           Límite 8/1: tarde. Lead 25 h, ciclo 24 h.
--   T3  cx  hecha. 12/1 09:00 por_hacer, 11:00 en_curso, 21:30 hecha (en UTC
--           ya es 13/1). Sin estimar; cx 120 min (12/1). Límite 12/1: a tiempo
--           solo si se mira el día en Argentina. Lead 12,5 h, ciclo 10,5 h.
--   T4  cy  hecha. 15/1 09:00 por_hacer, 10:00 en_curso, 16/1 10:00
--           en_revision, 18/1 22:00 hecha (en UTC ya es 19/1, fuera del
--           período). Estimada 2 h, sin registros. Sin límite. Lead 85 h, ciclo 84 h.
--   T5  cx  cancelada. 9/1 09:00 por_hacer, 10:00 en_curso, 12:00 cancelada.
--           cx 60 min (9/1): cuenta en horas, no en tiempos.
--   T6  cx  en_revision desde el 14/1 12:00 (14/1 09:00 por_hacer, 10:00
--           en_curso). Temporizador de cx corriendo: no cuenta.
--   T7  cy  por_hacer desde el 16/1 09:00.
--   T8  cx  hecha fuera del período: 19/1 09:00 por_hacer, 20/1 09:00 hecha.
--           cx 60 min el 20/1.
--   T9  cx  hecha el 10/1 pero borrada; cx 30 min (10/1). No cuenta en nada.
--   T10 cy  hecha. 13/1 09:00 por_hacer, 13:00 hecha (nunca pasó por en_curso).
--           Límite 14/1: a tiempo. Lead 4 h, sin ciclo.
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

-- Nombre corto de los ids de prueba, para leer los resultados.
create function pg_temp.n(p_id uuid) returns text language sql immutable as $$
    select case p_id
        when 'e0000000-0000-4000-e000-000000000001' then 'am'
        when 'e0000000-0000-4000-e000-000000000002' then 'cx'
        when 'e0000000-0000-4000-e000-000000000003' then 'cy'
        when 'e2000000-0000-4000-e000-000000000001' then 'M1'
        else coalesce(regexp_replace(p_id::text, '^e3000000-0000-4000-e000-0*', 'T'), '-')
    end
$$;

create function pg_temp.igual(p_caso text, p_obtenido text, p_esperado text) returns void language plpgsql as $$
begin
    if p_obtenido is distinct from p_esperado then
        raise exception 'FALLA: %: esperaba [%] y dio [%]', p_caso, p_esperado, p_obtenido;
    end if;
end;
$$;

create function pg_temp.t(p_n int) returns uuid language sql immutable as $$
    select format('e3000000-0000-4000-e000-%s', lpad(p_n::text, 12, '0'))::uuid
$$;

do $$
declare
    c_org    constant uuid := 'e1000000-0000-4000-e000-000000000000';
    c_org_b  constant uuid := '20000000-0000-4000-b000-000000000000';
    c_am     constant uuid := 'e0000000-0000-4000-e000-000000000001';
    c_cx     constant uuid := 'e0000000-0000-4000-e000-000000000002';
    c_cy     constant uuid := 'e0000000-0000-4000-e000-000000000003';
    c_admin_b constant uuid := '00000000-0000-4000-b000-000000000001';
    c_m1     constant uuid := 'e2000000-0000-4000-e000-000000000001';
    c_d      constant date := '2026-01-05';
    c_h      constant date := '2026-01-18';
    v_ok     int := 0;
    v_txt    text;
    v_n      int;
    p        record;
begin
    -- ===== Datos, como postgres =====
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, '', now(),
           '{"provider":"email","providers":["email"]}', jsonb_build_object('nombre_completo', u.nombre), now(), now()
    from (values (c_am, 'am.metricas@prueba.test', 'Admin Métricas'),
                 (c_cx, 'cx.metricas@prueba.test', 'Colab X'),
                 (c_cy, 'cy.metricas@prueba.test', 'Colab Y')) as u (id, email, nombre);

    insert into public.organizaciones (id, nombre, zona_horaria)
    values (c_org, 'Empresa de métricas', 'America/Argentina/Buenos_Aires');
    insert into public.miembros (organizacion_id, usuario_id, rol, horas_semanales) values
        (c_org, c_am, 'admin', 40), (c_org, c_cx, 'colaborador', 40), (c_org, c_cy, 'colaborador', 20);
    insert into public.proyectos (id, organizacion_id, nombre, estado, responsable_id, horas_presupuestadas, creado_por)
    values (c_m1, c_org, 'Proyecto de métricas', 'activo', c_am, 100, c_am);
    insert into public.proyecto_miembros (organizacion_id, proyecto_id, usuario_id)
    values (c_org, c_m1, c_cx), (c_org, c_m1, c_cy);

    for p in
        select * from (values
            (1,  c_cx, 'hecha',       10::numeric, '2026-01-07'::date, '2026-01-05 09:00-03'::timestamptz, '2026-01-07 15:00-03'::timestamptz, null::timestamptz),
            (2,  c_cy, 'hecha',       4,    '2026-01-08', '2026-01-08 09:00-03', '2026-01-09 10:00-03', null),
            (3,  c_cx, 'hecha',       null, '2026-01-12', '2026-01-12 09:00-03', '2026-01-12 21:30-03', null),
            (4,  c_cy, 'hecha',       2,    null,         '2026-01-15 09:00-03', '2026-01-18 22:00-03', null),
            (5,  c_cx, 'cancelada',   3,    null,         '2026-01-09 09:00-03', null, null),
            (6,  c_cx, 'en_revision', 5,    null,         '2026-01-14 09:00-03', null, null),
            (7,  c_cy, 'por_hacer',   5,    null,         '2026-01-16 09:00-03', null, null),
            (8,  c_cx, 'hecha',       1,    null,         '2026-01-19 09:00-03', '2026-01-20 09:00-03', null),
            (9,  c_cx, 'hecha',       1,    null,         '2026-01-10 09:00-03', '2026-01-10 12:00-03', now()),
            (10, c_cy, 'hecha',       1,    '2026-01-14', '2026-01-13 09:00-03', '2026-01-13 13:00-03', null)
        ) as x (n, asignado, estado, estimadas, limite, creado, cerrada, borrada)
    loop
        insert into public.tareas (id, organizacion_id, proyecto_id, titulo, estado, asignado_id, horas_estimadas,
            fecha_limite, creado_en, completada_en, eliminado_en, creado_por)
        values (pg_temp.t(p.n), c_org, c_m1, format('Tarea %s', p.n), p.estado, p.asignado, p.estimadas,
            p.limite, p.creado, p.cerrada, p.borrada, c_am);
    end loop;

    delete from public.tarea_historial_estados where organizacion_id = c_org;
    insert into public.tarea_historial_estados (organizacion_id, proyecto_id, tarea_id, estado_nuevo, cambiado_en)
    select c_org, c_m1, pg_temp.t(x.n), x.estado, x.en::timestamptz
    from (values
        (1, 'por_hacer', '2026-01-05 09:00-03'), (1, 'en_curso', '2026-01-05 13:00-03'),
        (1, 'en_revision', '2026-01-06 13:00-03'), (1, 'en_curso', '2026-01-06 15:00-03'),
        (1, 'en_revision', '2026-01-07 09:00-03'), (1, 'hecha', '2026-01-07 15:00-03'),
        (2, 'por_hacer', '2026-01-08 09:00-03'), (2, 'en_curso', '2026-01-08 10:00-03'),
        (2, 'en_revision', '2026-01-08 18:00-03'), (2, 'hecha', '2026-01-09 10:00-03'),
        (3, 'por_hacer', '2026-01-12 09:00-03'), (3, 'en_curso', '2026-01-12 11:00-03'),
        (3, 'hecha', '2026-01-12 21:30-03'),
        (4, 'por_hacer', '2026-01-15 09:00-03'), (4, 'en_curso', '2026-01-15 10:00-03'),
        (4, 'en_revision', '2026-01-16 10:00-03'), (4, 'hecha', '2026-01-18 22:00-03'),
        (5, 'por_hacer', '2026-01-09 09:00-03'), (5, 'en_curso', '2026-01-09 10:00-03'),
        (5, 'cancelada', '2026-01-09 12:00-03'),
        (6, 'por_hacer', '2026-01-14 09:00-03'), (6, 'en_curso', '2026-01-14 10:00-03'),
        (6, 'en_revision', '2026-01-14 12:00-03'),
        (7, 'por_hacer', '2026-01-16 09:00-03'),
        (8, 'por_hacer', '2026-01-19 09:00-03'), (8, 'hecha', '2026-01-20 09:00-03'),
        (9, 'por_hacer', '2026-01-10 09:00-03'), (9, 'en_curso', '2026-01-10 10:00-03'),
        (9, 'hecha', '2026-01-10 12:00-03'),
        (10, 'por_hacer', '2026-01-13 09:00-03'), (10, 'hecha', '2026-01-13 13:00-03')
    ) as x (n, estado, en);

    insert into public.registros_tiempo (organizacion_id, tarea_id, usuario_id, origen, minutos, fecha) values
        (c_org, pg_temp.t(1), c_cx, 'manual', 600, '2026-01-05'),
        (c_org, pg_temp.t(1), c_cy, 'manual', 300, '2026-01-06'),
        (c_org, pg_temp.t(2), c_cy, 'manual', 180, '2026-01-08'),
        (c_org, pg_temp.t(3), c_cx, 'manual', 120, '2026-01-12'),
        (c_org, pg_temp.t(5), c_cx, 'manual', 60,  '2026-01-09'),
        (c_org, pg_temp.t(8), c_cx, 'manual', 60,  '2026-01-20'),
        (c_org, pg_temp.t(9), c_cx, 'manual', 30,  '2026-01-10');
    insert into public.registros_tiempo (organizacion_id, tarea_id, usuario_id, origen, inicio, fecha)
    values (c_org, pg_temp.t(6), c_cx, 'temporizador', '2026-01-14 12:00-03', '2026-01-14');

    -- ===== Como el Admin de M =====
    perform pg_temp.como(c_am, c_org);

    -- Horas por semana: sin el temporizador corriendo, sin la tarea borrada, sin el 20/1. La
    -- cancelada sí: cx el 5/1 600 + el 9/1 60 = 11 h; cy 300 + 180 = 8 h.
    select string_agg(format('%s %s %s %s %s', x.periodo, pg_temp.n(x.proyecto_id), pg_temp.n(x.usuario_id), x.horas, x.n), '; ')
    into v_txt from analitica.horas_por_periodo(c_d, c_h) x;
    perform pg_temp.igual('horas_por_periodo', v_txt,
        '2026-01-05 M1 cx 11.00 2; 2026-01-05 M1 cy 8.00 2; 2026-01-12 M1 cx 2.00 1');
    v_ok := v_ok + 1;

    -- Utilización: 10 días hábiles. cx 13 h / 80 = 16,25 %; cy 8 h / 40 = 20 %; am 0 de 80.
    select string_agg(format('%s %s %s %s %s', pg_temp.n(x.usuario_id), x.horas, x.capacidad, x.porcentaje, x.n), '; '
                      order by pg_temp.n(x.usuario_id))
    into v_txt from analitica.utilizacion(c_d, c_h) x;
    perform pg_temp.igual('utilizacion', v_txt, 'am 0.00 80.00 0.0 0; cx 13.00 80.00 16.3 3; cy 8.00 40.00 20.0 2');
    v_ok := v_ok + 1;

    -- Precisión: solo T1 (1,5) y T2 (0,75). T3 sin estimar, T4 sin registros, T9 borrada.
    select format('%s %s', x.mediana_ratio, x.n) into v_txt
    from analitica.precision_estimacion(c_d, c_h, null, null, 'total') x;
    perform pg_temp.igual('precision_estimacion total', v_txt, '1.13 2');
    select string_agg(format('%s %s %s', pg_temp.n(x.usuario_id), x.mediana_ratio, x.n), '; ' order by pg_temp.n(x.usuario_id))
    into v_txt from analitica.precision_estimacion(c_d, c_h) x;
    perform pg_temp.igual('precision_estimacion por usuario', v_txt, 'cx 1.50 1; cy 0.75 1');
    select string_agg(format('%s %s %s', pg_temp.n(x.proyecto_id), x.mediana_ratio, x.n), '; ')
    into v_txt from analitica.precision_estimacion(c_d, c_h, null, null, 'proyecto') x;
    perform pg_temp.igual('precision_estimacion por proyecto', v_txt, 'M1 1.13 2');
    v_ok := v_ok + 3;

    -- Tiempos de ciclo: T1, T2, T3, T4 (cerrada el 18 a la noche en Argentina) y T10.
    -- Lead 54, 25, 12,5, 85, 4: mediana 25. Ciclo 50, 24, 10,5, 84 (T10 no tiene): mediana 37.
    select format('%s %s %s %s', x.mediana_lead_horas, x.mediana_ciclo_horas, x.n, x.n_ciclo) into v_txt
    from analitica.tiempos_de_ciclo(c_d, c_h) x;
    perform pg_temp.igual('tiempos_de_ciclo', v_txt, '25.00 37.00 5 4');
    v_ok := v_ok + 1;

    -- Tiempo en estado: pasos cerrados en el período, sin la cancelada ni la borrada.
    --   por_hacer:   4, 1, 2, 1, 1 (T6), 4 (T10). Mediana 1,5; p85 4.
    --   en_curso:    24 y 18 (T1 vuelve: dos pasos), 8, 10,5, 24, 2 (T6). Mediana 14,25; p85 24.
    --   en_revision: 2 y 6 (T1), 16, 60. Mediana 11; p85 16 + 0,55 x 44 = 40,2. n = 4.
    select string_agg(format('%s %s %s %s', x.estado, x.mediana_horas, x.p85_horas, x.n), '; ')
    into v_txt from analitica.tiempo_en_estado(c_d, c_h) x;
    perform pg_temp.igual('tiempo_en_estado', v_txt,
        'por_hacer 1.50 4.00 6; en_curso 14.25 24.00 6; en_revision 11.00 40.20 4');
    v_ok := v_ok + 1;

    -- Trabadas: T6 en revisión desde enero; ese estado tiene n = 4, menos que 5, así que el umbral
    -- es 7 días (168 h). T7 por hacer desde el 16/1, contra el p85 de por_hacer (4 h).
    select string_agg(format('%s %s %s', pg_temp.n(x.tarea_id), x.estado, x.umbral_horas), '; ')
    into v_txt from analitica.tareas_trabadas(c_d, c_h) x;
    perform pg_temp.igual('tareas_trabadas', v_txt, 'T6 en_revision 168; T7 por_hacer 4.00');
    select count(*) into v_n from analitica.tareas_trabadas(c_d, c_h) x
    where x.horas_en_estado <> round((extract(epoch from now() - case pg_temp.n(x.tarea_id)
        when 'T6' then '2026-01-14 12:00-03'::timestamptz else '2026-01-16 09:00-03'::timestamptz end) / 3600)::numeric, 2);
    perform pg_temp.igual('horas en estado contra now()', v_n::text, '0');
    v_ok := v_ok + 2;

    select string_agg(format('%s %s %s %s %s', x.estado, x.tareas_ahora, x.trabadas, x.mediana_horas, x.n), '; ')
    into v_txt from analitica.cuellos_de_botella(c_d, c_h) x;
    perform pg_temp.igual('cuellos_de_botella', v_txt,
        'por_hacer 1 1 1.50 6; en_curso 0 0 14.25 6; en_revision 1 1 11.00 4');
    v_ok := v_ok + 1;

    -- Rendimiento: semana del 5, T1 y T2; semana del 12, T3, T10 y T4 (el 18 a las 22 en Argentina).
    select string_agg(format('%s %s', x.semana, x.tareas_hechas), '; ')
    into v_txt from analitica.rendimiento(c_d, c_h) x;
    perform pg_temp.igual('rendimiento', v_txt, '2026-01-05 2; 2026-01-12 3');
    v_ok := v_ok + 1;

    -- En curso ahora: T6 en revisión de cx.
    select string_agg(format('%s %s %s', pg_temp.n(x.usuario_id), x.en_curso, x.en_revision), '; ' order by pg_temp.n(x.usuario_id))
    into v_txt from analitica.trabajo_en_curso(c_d, c_h) x;
    perform pg_temp.igual('trabajo_en_curso', v_txt, 'am 0 0; cx 0 1; cy 0 0');
    v_ok := v_ok + 1;

    -- Plazos: T1 a tiempo, T2 tarde, T3 a tiempo (en UTC sería tarde), T10 a tiempo. T4 sin límite.
    select format('%s %s %s %s', x.a_tiempo, x.tarde, x.porcentaje, x.n) into v_txt
    from analitica.cumplimiento_plazos(c_d, c_h) x;
    perform pg_temp.igual('cumplimiento_plazos', v_txt, '3 1 75.0 4');
    v_ok := v_ok + 1;

    -- Presupuesto: horas de toda la vida, también la cancelada y el 20/1, sin la borrada ni el
    -- temporizador: 600 + 300 + 180 + 120 + 60 + 60 = 1320 min = 22 h de 100. Avance: 6 hechas
    -- (T1, T2, T3, T4, T8, T10) de 8 (sin la cancelada ni la borrada).
    select string_agg(format('%s %s %s %s %s %s', pg_temp.n(x.proyecto_id), x.horas, x.presupuestadas, x.porcentaje, x.avance, x.n), '; ')
    into v_txt from analitica.consumo_presupuesto(c_d, c_h) x;
    perform pg_temp.igual('consumo_presupuesto', v_txt, 'M1 22.00 100.00 22.0 75.0 8');
    v_ok := v_ok + 1;

    -- Filtro de persona: el Admin pide solo cy.
    select string_agg(format('%s %s', pg_temp.n(x.usuario_id), x.horas), '; ')
    into v_txt from analitica.horas_por_periodo(c_d, c_h, null, array[c_cy]) x;
    perform pg_temp.igual('filtro de persona', v_txt, 'cy 8.00');
    v_ok := v_ok + 1;

    -- ===== Colaborador que pide los datos de otro: recibe solo los suyos =====
    perform pg_temp.como(c_cx, c_org);
    select string_agg(format('%s %s', pg_temp.n(x.usuario_id), x.horas), '; ')
    into v_txt from analitica.horas_por_periodo(c_d, c_h, null, array[c_cy]) x;
    perform pg_temp.igual('colaborador pide horas de otro', v_txt, 'cx 11.00; cx 2.00');
    select string_agg(pg_temp.n(x.usuario_id), '; ') into v_txt from analitica.utilizacion(c_d, c_h, null, array[c_cy]) x;
    perform pg_temp.igual('colaborador pide utilización de otro', v_txt, 'cx');
    select string_agg(format('%s %s', pg_temp.n(x.usuario_id), x.mediana_ratio), '; ')
    into v_txt from analitica.precision_estimacion(c_d, c_h, null, array[c_cy]) x;
    perform pg_temp.igual('colaborador pide precisión de otro', v_txt, 'cx 1.50');
    select format('%s %s', x.a_tiempo, x.n) into v_txt from analitica.cumplimiento_plazos(c_d, c_h, null, array[c_cy]) x;
    perform pg_temp.igual('colaborador pide plazos de otro', v_txt, '2 2');
    select count(*) into v_n from analitica.consumo_presupuesto(c_d, c_h);
    perform pg_temp.igual('colaborador no ve presupuesto', v_n::text, '0');
    v_ok := v_ok + 5;

    -- ===== Usuario de otra empresa =====
    perform pg_temp.como(c_admin_b, c_org_b);
    select count(*) into v_n from analitica.horas_por_periodo(c_d, c_h, array[c_m1]);
    perform pg_temp.igual('otra empresa pide el proyecto de M', v_n::text, '0');
    select count(*) into v_n from analitica.consumo_presupuesto(c_d, c_h, array[c_m1]);
    perform pg_temp.igual('otra empresa pide el presupuesto de M', v_n::text, '0');
    -- Con el token apuntando a M, sin ser miembro: nada.
    perform pg_temp.como(c_admin_b, c_org);
    select count(*) into v_n from analitica.utilizacion(c_d, c_h);
    perform pg_temp.igual('no miembro con el token de M', v_n::text, '0');
    select count(*) into v_n from analitica.tareas_trabadas(c_d, c_h);
    perform pg_temp.igual('no miembro no ve trabadas', v_n::text, '0');
    v_ok := v_ok + 4;

    -- ===== Cambio de día por zona: la misma empresa en UTC deja T4 fuera y T3 tarde =====
    perform pg_temp.como_postgres();
    update public.organizaciones set zona_horaria = 'UTC' where id = c_org;
    perform pg_temp.como(c_am, c_org);
    select format('%s %s', x.a_tiempo, x.tarde) into v_txt from analitica.cumplimiento_plazos(c_d, c_h) x;
    perform pg_temp.igual('plazos en UTC', v_txt, '2 2');
    select string_agg(format('%s %s', x.semana, x.tareas_hechas), '; ') into v_txt from analitica.rendimiento(c_d, c_h) x;
    perform pg_temp.igual('rendimiento en UTC', v_txt, '2026-01-05 2; 2026-01-12 2');
    v_ok := v_ok + 2;

    raise notice '% comprobaciones de métricas en verde', v_ok;
end;
$$;

rollback;
