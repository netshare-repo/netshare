FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ENV NODE_ENV=production
ENTRYPOINT ["node", "agent.js"]
CMD ["--url", "http://backend:8000"]
