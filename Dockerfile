FROM node:20-alpine AS builder

WORKDIR /app

# Тәуелділіктерді алдымен орнату — кэш үшін
COPY package.json package-lock.json ./

# Prisma схемасын алдымен көшіру (postinstall: prisma generate сонда жұмыс істейді)
COPY prisma ./prisma

# Диагностика
RUN echo "=== Build context ===" && ls -la && \
    echo "=== prisma dir ===" && ls -la prisma && \
    echo "=== lock file size ===" && wc -c package-lock.json

# npm install (postinstall автоматты түрде prisma generate шақырады)
RUN npm install --no-audit --no-fund

# Қалған кодты копирлеу (.dockerignore артық файлдарды шығарып тастайды)
COPY . .

# Nest build
RUN npm run build

# ============= Production image =============
FROM node:20-alpine

WORKDIR /app

# OpenSSL — Prisma үшін Alpine-да керек
RUN apk add --no-cache openssl

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json package-lock.json ./

ENV NODE_ENV=production
EXPOSE 3000

# migrate deploy + start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
