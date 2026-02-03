# Auth Microservice Web - landing + admin panel
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY server.js ./
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3380
EXPOSE 3380

CMD ["node", "server.js"]
