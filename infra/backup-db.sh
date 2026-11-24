#!/bin/sh
#
# Respaldo de la base de Ingenia PM (solo Supabase self-hosted en Docker).
# Guarda en infra/backups/ el dump de la base completa y los archivos de Storage (avatares),
# y borra los de más de 14 días. Por cron, todos los días. A mano: sh backup-db.sh
# SIN PROBAR en una VM real: ver docs/despliegue.md, paso 8.

set -eu
cd "$(dirname "$0")"
mkdir -p backups
fecha=$(date +%Y-%m-%d_%H%M)

# supabase_admin es el superusuario: el dump incluye auth, storage, roles y las tablas.
docker compose exec -T db pg_dumpall -U supabase_admin --clean --if-exists \
    | gzip > "backups/db_${fecha}.sql.gz"

# Controla que no quede un archivo vacío por un error silencioso.
[ "$(gzip -dc "backups/db_${fecha}.sql.gz" | wc -c)" -gt 1000 ] || { echo "El dump salió vacío"; exit 1; }

if [ -d volumes/storage ]; then
    sudo tar -czf "backups/storage_${fecha}.tar.gz" -C volumes storage
fi

find backups -name 'db_*.sql.gz' -mtime +14 -delete
find backups -name 'storage_*.tar.gz' -mtime +14 -delete

echo "Respaldo listo: backups/db_${fecha}.sql.gz"
