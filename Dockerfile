FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json tsconfig*.json vite.config.ts index.html ./
RUN npm install
COPY src/ ./src/
COPY server.ts ./
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV TCP_PORT=5000
COPY package*.json ./
RUN npm install --omit=dev && npm install tsx
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig*.json ./
EXPOSE 8080 5000
CMD ["npx", "tsx", "server.ts"]
