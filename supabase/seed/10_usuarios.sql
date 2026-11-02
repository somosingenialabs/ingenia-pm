-- =====================================================================
-- Seed 10 · Usuarios de prueba (todos @prueba.test, contraseña de desarrollo
-- en el README). Ids fijos para que los tests y los e2e los encuentren.
-- Son personas ficticias. El rol de cada una se carga en la fase 2.
--
--   Empresa A: admin, 2 PM, 3 colaboradores
--   Empresa B: admin, colaborador
-- =====================================================================

do $$
declare
    v_clave text := extensions.crypt('prueba1234', extensions.gen_salt('bf'));
    u record;
begin
    for u in
        select * from (values
            ('00000000-0000-4000-a000-000000000001'::uuid, 'admin.a@prueba.test',  'Lucía Fernández'),
            ('00000000-0000-4000-a000-000000000002'::uuid, 'pm1.a@prueba.test',    'Martín Gómez'),
            ('00000000-0000-4000-a000-000000000003'::uuid, 'pm2.a@prueba.test',    'Carla Ruiz'),
            ('00000000-0000-4000-a000-000000000004'::uuid, 'colab1.a@prueba.test', 'Diego Paz'),
            ('00000000-0000-4000-a000-000000000005'::uuid, 'colab2.a@prueba.test', 'Sofía Ledesma'),
            ('00000000-0000-4000-a000-000000000006'::uuid, 'colab3.a@prueba.test', 'Tomás Aguirre'),
            ('00000000-0000-4000-b000-000000000001'::uuid, 'admin.b@prueba.test',  'Ramiro Ortiz'),
            ('00000000-0000-4000-b000-000000000002'::uuid, 'colab1.b@prueba.test', 'Paula Medina')
        ) as t (id, email, nombre)
    loop
        insert into auth.users (
            instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
            confirmation_token, recovery_token, email_change, email_change_token_new
        ) values (
            '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, v_clave, now(),
            '{"provider":"email","providers":["email"]}', jsonb_build_object('nombre_completo', u.nombre), now(), now(),
            '', '', '', ''
        );

        insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
        values (
            gen_random_uuid(), u.id, u.id::text,
            jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
            'email', now(), now(), now()
        );
    end loop;
end;
$$;
