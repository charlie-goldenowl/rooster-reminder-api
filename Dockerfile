FROM node:23-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .
COPY .env* ./

RUN npm run build


EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "run", "start:dev"]