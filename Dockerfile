# api/Dockerfile
FROM node:18-slim

# Install OpenSSL3 used by Debian Bookworm (prisma target debian-openssl-3.0.x)
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl ca-certificates libssl3 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# copy package files and install inside image (so node_modules are built for Debian)
COPY package*.json ./
RUN npm install --production=false

# copy rest of source (do NOT copy host node_modules due to .dockerignore)
COPY . .

# generate Prisma inside the image (no CLI binary-target flags needed — targets in schema)
RUN npx prisma generate --schema=./prisma/schema.prisma

EXPOSE 3000
CMD ["node", "server.js"]
