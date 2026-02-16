FROM node:20-alpine
WORKDIR /app
COPY . .
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN pnpm -w install --frozen-lockfile=false
RUN pnpm -w -r build
WORKDIR /app/services/mcp-gateway
EXPOSE 8080
CMD ["node", "dist/index.js"]
