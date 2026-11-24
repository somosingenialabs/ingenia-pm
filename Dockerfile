# Imagen de Ingenia PM (Next.js 16, output "standalone").
# Preparada, todavía no probada en una VM: ver docs/despliegue.md.
# node:24 tiene variante arm64, así que sirve para una VM Ampere de Oracle.
#
# Construir (las dos NEXT_PUBLIC_* son públicas y quedan dentro del JavaScript del navegador
# y de la CSP: si cambian, hay que reconstruir):
#   docker build --build-arg NEXT_PUBLIC_SUPABASE_URL=https://api.ejemplo.com \
#                --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<clave publicable> -t ingenia-pm .
# Correr (la clave secreta va solo al arrancar, nunca al build):
#   docker run -p 3000:3000 -e SUPABASE_SECRET_KEY=<clave secreta> \
#              -e NEXT_PUBLIC_SUPABASE_URL=https://api.ejemplo.com \
#              -e NEXT_PUBLIC_SUPABASE_ANON_KEY=<clave publicable> ingenia-pm

ARG NODE_IMAGE=node:24-bookworm-slim

# ---------- 1) Dependencias ----------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Nunca `npm install`: ver README (borra binarios del lock).
RUN npm ci --no-audit --no-fund

# ---------- 2) Build ----------
FROM ${NODE_IMAGE} AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---------- 3) Servidor ----------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# El servidor mínimo de "standalone" no trae .next/static. El repo no tiene carpeta public/.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/ingresar').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
