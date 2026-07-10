FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -g 1001 -S bubo && adduser -S bubo -u 1001 -G bubo
COPY --from=dependencies --chown=bubo:bubo /app/node_modules ./node_modules
COPY --chown=bubo:bubo package.json ./
COPY --chown=bubo:bubo src ./src
COPY --chown=bubo:bubo scripts ./scripts
USER bubo
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3001/api/health >/dev/null || exit 1
CMD ["node", "src/server.js"]
