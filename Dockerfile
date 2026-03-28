FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY shared/package.json shared/
COPY backend/package.json backend/

# Install dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy source
COPY shared/ shared/
COPY backend/ backend/

EXPOSE 3000

CMD ["pnpm", "run", "--filter", "backend", "start"]
