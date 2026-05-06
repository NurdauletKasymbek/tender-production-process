FROM node:20-alpine AS builder

WORKDIR /app

# Тәуелділіктерді алдымен орнату — кэш үшін
COPY package.json package-lock.json ./

# Диагностика — файлдар бар-жоғын тексеру
RUN echo "=== Build context ===" && ls -la && \
    echo "=== package.json ===" && head -20 package.json && \
    echo "=== lock file size ===" && wc -c package-lock.json

# npm install (npm ci-ден гөрі төзімді, lock-ты қажет етеді бірақ minor mismatch-ке жұмсақ)
RUN npm install --no-audit --no-fund --prefer-offline

# Қалған кодты копирлеу (.dockerignore артық файлдарды шығарып тастайды)
COPY . .

# Prisma client + nest build
RUN npx prisma generate && npm run build

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
