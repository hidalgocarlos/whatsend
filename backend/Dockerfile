FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY src/prisma ./src/prisma
RUN npm ci --omit=dev && npx prisma generate

COPY . .

ENV NODE_ENV=production

EXPOSE 3001

# Correr como usuario no-root (node ya viene en la imagen base)
USER node

# Migraciones separadas del arranque para no bloquear si fallan
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
