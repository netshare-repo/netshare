FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8000
ENV NODE_ENV=production
CMD ["node", "server.js"]
