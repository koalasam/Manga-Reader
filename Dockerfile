FROM node:22-alpine AS builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/backend/dist ./dist
COPY frontend /app/frontend

ENV NODE_ENV=production
ENV PORT=3000
ENV CACHE_DIR=/cache
ENV DATA_DIR=/data/db

EXPOSE 3000
CMD ["node", "dist/index.js"]