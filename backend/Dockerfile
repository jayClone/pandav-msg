FROM node:20-alpine

WORKDIR /app

COPY bunfig.toml .
COPY package*.json ./
COPY bunfig.toml ./

# ✅ CHANGED: Remove --production to include dev dependencies (axios, etc)
RUN npm install -g bun && bun install

COPY src ./src

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["bun", "run", "src/server.js"]