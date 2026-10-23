FROM node:22.23.4-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

FROM node:22.23.4-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

EXPOSE 8200

CMD ["node", "dist/server.js"]