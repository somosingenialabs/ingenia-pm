-- =====================================================================
-- Test SQL · Aceptar invitaciones y bucket de avatares. Corre sobre el seed,
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

do $$
declare
    c_org     constant uuid := '10000000-0000-4000-a000-000000000000';
    c_org_b   constant uuid := '20000000-0000-4000-b000-000000000000';
    c_colab1  constant uuid := '00000000-0000-4000-a000-000000000004';
    c_admin_b constant uuid := '00000000-0000-4000-b000-000000000001';
    c_colab_b constant uuid := '00000000-0000-4000-b000-000000000002';
    v_org uuid;
    v_rol text;
    v_ok int := 0;
begin
    insert into public.invitaciones (organizacion_id, email, rol, token_hash, vence_en, revocada_en, aceptada_en) values
        (c_org, 'vencida@prueba.test', 'colaborador', 'h-vencida', now() - interval '1 minute', null, null),
        (c_org, 'revocada@prueba.test', 'colaborador', 'h-revocada', now() + interval '1 day', now(), null),
        (c_org, 'usada@prueba.test', 'colaborador', 'h-usada', now() + interval '1 day', null, now()),
        (c_org, 'colab1.b@prueba.test', 'pm', 'h-ok', now() + interval '1 day', null, null),
        (c_org_b, 'colab1.a@prueba.test', 'pm', 'h-ajena', now() + interval '1 day', null, null);

    -- ===== Tokens que no sirven =====
    perform pg_temp.debe_fallar('token adulterado',
        format('select public.aceptar_invitacion(%L, %L)', 'h-adulterado', c_colab_b), 'no es válida');
    perform pg_temp.debe_fallar('token vencido',
        format('select public.aceptar_invitacion(%L, %L)', 'h-vencida', c_colab_b), 'venció');
    perform pg_temp.debe_fallar('token revocado',
        format('select public.aceptar_invitacion(%L, %L)', 'h-revocada', c_colab_b), 'revocada');
    perform pg_temp.debe_fallar('token ya usado',
        format('select public.aceptar_invitacion(%L, %L)', 'h-usada', c_colab_b), 'ya se usó');
    v_ok := v_ok + 4;

    -- ===== El mail se compara con auth.users, no con perfiles (lo edita su dueño) =====
    perform pg_temp.debe_fallar('otro usuario usa el token',
        format('select public.aceptar_invitacion(%L, %L)', 'h-ok', c_admin_b), 'otro mail');
    update public.perfiles set email = 'colab1.b@prueba.test' where id = c_colab1;
    perform pg_temp.debe_fallar('perfil con el mail falsificado',
        format('select public.aceptar_invitacion(%L, %L)', 'h-ok', c_colab1), 'otro mail');
    v_ok := v_ok + 2;

    -- ===== El camino bueno: alta, empresa activa y token gastado =====
    v_org := public.aceptar_invitacion('h-ok', c_colab_b);
    if v_org <> c_org then raise exception 'FALLA: devolvió otra empresa'; end if;
    select m.rol into v_rol from public.miembros m where m.organizacion_id = c_org and m.usuario_id = c_colab_b and m.activo;
    if v_rol is distinct from 'pm' then raise exception 'FALLA: no quedó miembro con el rol de la invitación: %', v_rol; end if;
    if (select organizacion_activa_id from public.perfiles where id = c_colab_b) <> c_org then
        raise exception 'FALLA: no cambió la empresa activa';
    end if;
    perform pg_temp.debe_fallar('segundo uso del token',
        format('select public.aceptar_invitacion(%L, %L)', 'h-ok', c_colab_b), 'ya se usó');
    v_ok := v_ok + 3;

    -- ===== Quien ya es miembro activo conserva su rol; a quien estaba de baja lo reactiva =====
    insert into public.invitaciones (organizacion_id, email, rol, token_hash) values
        (c_org, 'colab1.b@prueba.test', 'colaborador', 'h-activo');
    perform public.aceptar_invitacion('h-activo', c_colab_b);
    if (select rol from public.miembros where organizacion_id = c_org and usuario_id = c_colab_b) <> 'pm' then
        raise exception 'FALLA: la invitación le bajó el rol a un miembro activo';
    end if;
    update public.miembros set activo = false where organizacion_id = c_org and usuario_id = c_colab_b;
    insert into public.invitaciones (organizacion_id, email, rol, token_hash) values
        (c_org, 'colab1.b@prueba.test', 'colaborador', 'h-baja');
    perform public.aceptar_invitacion('h-baja', c_colab_b);
    select m.rol into v_rol from public.miembros m where m.organizacion_id = c_org and m.usuario_id = c_colab_b and m.activo;
    if v_rol is distinct from 'colaborador' then raise exception 'FALLA: no reactivó con el rol nuevo: %', v_rol; end if;
    v_ok := v_ok + 2;

    -- ===== Solo la clave secreta llama a estas funciones =====
    perform pg_temp.como(c_colab1, c_org);
    perform pg_temp.debe_fallar('un usuario común acepta por RPC',
        format('select public.aceptar_invitacion(%L, %L)', 'h-ajena', c_colab1), 'permission denied');
    perform pg_temp.debe_fallar('un usuario común lee invitaciones por RPC',
        format('select * from public.invitacion_por_token(%L)', 'h-ajena'), 'permission denied');
    perform pg_temp.como_postgres();
    v_ok := v_ok + 2;

    -- ===== Bucket: público, 2 MB y solo imágenes =====
    if not exists (
        select 1 from storage.buckets b
        where b.id = 'avatares' and b.public and b.file_size_limit = 2097152
          and b.allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
    ) then
        raise exception 'FALLA: el bucket avatares no tiene la configuración pedida';
    end if;
    v_ok := v_ok + 1;

    -- ===== Cada uno escribe solo en su carpeta =====
    perform pg_temp.como(c_colab1, c_org);
    insert into storage.objects (bucket_id, name, owner_id)
    values ('avatares', c_colab1::text || '/foto.png', c_colab1::text);
    perform pg_temp.debe_fallar('subir a la carpeta de otro',
        format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'avatares', c_admin_b::text || '/foto.png'),
        'row-level security');
    perform pg_temp.debe_fallar('subir fuera de una carpeta',
        format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'avatares', 'foto.png'),
        'row-level security');
    v_ok := v_ok + 3;

    perform pg_temp.como_postgres();
    raise notice '% comprobaciones', v_ok;
end;
$$;

rollback;
