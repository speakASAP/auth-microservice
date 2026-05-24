# Auth Microservice Web - landing + admin panel
FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY server.js ./
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3372
EXPOSE 3372

HEALTHCHECK --interval=10s --timeout=5s --retries=2 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3372) + '/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
