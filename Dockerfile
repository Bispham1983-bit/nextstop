# Stage 1: build the React frontend
FROM oven/bun:1 AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN bun install
COPY frontend/ ./
RUN bun run build

# Stage 2: run the Bun backend (serves API + built frontend)
FROM oven/bun:1
WORKDIR /app/backend
COPY backend/package.json ./
RUN bun install
COPY backend/ ./
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

EXPOSE 3001
ENV DB_PATH=/data/nextstop.db

CMD ["bun", "run", "src/index.ts"]
