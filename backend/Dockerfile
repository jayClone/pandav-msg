FROM oven/bun:1 AS builder

WORKDIR /app

# ✅ Copy dependency files
COPY bunfig.toml .
COPY package*.json ./
COPY bun.lock* ./

# ✅ Install dependencies with bun
RUN bun install --production --no-frozen-lockfile

# ✅ Copy source code
COPY src ./src


EXPOSE 5000

# ✅ Health check using bun (no external dependencies)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD bun -e "const res = await fetch('http://localhost:5000/api/v1/health'); process.exit(res.ok ? 0 : 1)"

# ✅ Use bun runtime
CMD ["bun", "run", "src/server.js"]