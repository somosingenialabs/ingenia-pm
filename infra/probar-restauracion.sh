#!/bin/sh
#
# Prueba de restaurar: levanta un Postgres descartable, carga el respaldo más nuevo y cuenta
# filas. No toca la base de producción. Necesita Docker. Uso: sh probar-restauracion.sh
# SIN PROBAR en una VM real: ver docs/despliegue.md, paso 8.
#
# Si querés probar un archivo puntual: sh probar-restauracion.sh backups/db_AAAA-MM-DD_HHMM.sql.gz

set -eu
cd "$(dirname "$0")"
archivo="${1:-$(ls -1t backups/db_*.sql.gz | head -n1)}"
[ -f "$archivo" ] || { echo "No hay respaldo: $archivo"; exit 1; }

# Misma imagen que usa el db de Supabase (tomala de docker-compose.yml de tu instalación).
imagen="${IMAGEN_POSTGRES:?Poné IMAGEN_POSTGRES con la imagen del servicio db, por ejemplo supabase/postgres:17.x.y}"
nombre="ingenia-pm-prueba-restauracion"

docker rm -f "$nombre" >/dev/null 2>&1 || true
docker run -d --name "$nombre" -e POSTGRES_PASSWORD=prueba "$imagen" >/dev/null
trap 'docker rm -f "$nombre" >/dev/null 2>&1 || true' EXIT

echo "Esperando a Postgres..."
i=0
until docker exec "$nombre" pg_isready -U supabase_admin >/dev/null 2>&1; do
    i=$((i + 1)); [ "$i" -lt 60 ] || { echo "Postgres no arrancó"; exit 1; }
    sleep 2
done

# Los errores de roles que ya existen son esperables; lo que importa es el conteo de abajo.
gzip -dc "$archivo" | docker exec -i "$nombre" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=0 >/dev/null 2>"/tmp/restauracion.err" || true

echo "Filas restauradas:"
docker exec "$nombre" psql -U supabase_admin -d postgres -At -c "
select 'organizaciones', count(*) from public.organizaciones
union all select 'miembros', count(*) from public.miembros
union all select 'proyectos', count(*) from public.proyectos
union all select 'tareas', count(*) from public.tareas
union all select 'registros_tiempo', count(*) from public.registros_tiempo
union all select 'auth.users', count(*) from auth.users;"
echo "Compará estos números con los de producción. Errores del restore: /tmp/restauracion.err"
