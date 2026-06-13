FROM docker.m.daocloud.io/library/node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com && npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM docker.m.daocloud.io/library/node:22-alpine AS runner
RUN apk add --no-cache postgresql-client
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY scripts/startup.sh ./startup.sh
RUN chmod +x ./startup.sh
EXPOSE 3000
CMD ["./startup.sh"]
