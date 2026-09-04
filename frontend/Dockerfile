FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY bun.lock* ./

RUN npm install -g bun && bun install

COPY . .

# Vite inlines VITE_* vars into the bundle at build time (this image builds
# static files, then serves them with `serve` — there's no runtime env
# injection), so it must be passed as a build arg, not a compose `environment:`.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN bun run build

FROM node:20-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5173', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["serve", "-s", "dist", "-l", "5173"]