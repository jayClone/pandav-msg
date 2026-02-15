FROM node:20-alpine

WORKDIR /app

COPY bunfig.toml .
COPY package*.json ./

RUN npm install -g bun && bun install

COPY src ./src

# ✅ Accept build arguments
ARG MONGO_URI
ARG JWT_SECRET
ARG PORT=5000
ARG NODE_ENV=production
ARG API_VERSION=v1
ARG CLIENT_URL

# ✅ Set as environment variables
ENV MONGO_URI=${MONGO_URI}
ENV JWT_SECRET=${JWT_SECRET}
ENV PORT=${PORT}
ENV NODE_ENV=${NODE_ENV}
ENV API_VERSION=${API_VERSION}
ENV CLIENT_URL=${CLIENT_URL}

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["bun", "run", "src/server.js"]