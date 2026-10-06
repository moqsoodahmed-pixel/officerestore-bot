FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src/ ./src/
COPY server.js ./

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000
CMD ["node", "server.js"]
