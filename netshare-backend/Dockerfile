FROM node:24-bookworm-slim AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 8000
ENV NODE_ENV=production
CMD ["node", "server.js"]
