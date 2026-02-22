FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY bun.lock* ./

RUN npm install -g bun && bun install

COPY . .
RUN bun run build

FROM node:20-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5173', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["serve", "-s", "dist", "-l", "5173"]