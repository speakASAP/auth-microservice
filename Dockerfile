FROM node:24-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build
RUN npm run build

# Production stage
FROM node:24-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/web ./web

# Operational scripts (service-token provisioning). Needed in the image because
# credential operations must run inside the pod: reaching the auth DB from a
# workstation would require a port-forward and a Vault-read DB password, both
# forbidden by the postgres MCP agent guide. These are exec'd deliberately by an
# operator, never on the container's start path.
COPY --from=builder /app/scripts ./scripts

# Expose port (default: 3370, configured via PORT env var)
EXPOSE ${PORT:-3370}

HEALTHCHECK --interval=10s --timeout=10s --retries=2 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3370) + '/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start application
CMD ["node", "dist/src/main.js"]

