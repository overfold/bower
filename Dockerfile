FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgres://bower:bower@localhost:5432/bower
ENV OUTPUT_MODE=standalone
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 bower && adduser --system --uid 1001 --ingroup bower bower
COPY --from=builder --chown=bower:bower /app/public ./public
COPY --from=builder --chown=bower:bower /app/.next/standalone ./
COPY --from=builder --chown=bower:bower /app/.next/static ./.next/static
COPY --from=builder --chown=bower:bower /app/drizzle ./drizzle
COPY --from=builder --chown=bower:bower /app/entrypoint.sh ./entrypoint.sh
COPY --from=builder --chown=bower:bower /app/exec ./exec
COPY --from=builder --chown=bower:bower /app/node_modules/ws ./node_modules/ws
COPY --from=builder --chown=bower:bower /app/node_modules/@next/env ./node_modules/@next/env
# Startup migrations run outside Next's standalone dependency tracing.
COPY --from=builder --chown=bower:bower /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=builder --chown=bower:bower /app/node_modules/postgres ./node_modules/postgres
RUN chmod +x entrypoint.sh

USER bower
EXPOSE 3000
CMD ["./entrypoint.sh", "exec/server.mjs"]
