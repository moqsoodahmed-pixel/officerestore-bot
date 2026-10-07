FROM node:20-alpine AS builder
WORKDIR /app

# Vite bakes this in at BUILD time. Railway passes service variables
# as build args when they are declared with ARG.
# The admin key is NOT baked in: staff enter it on the sign-in screen.
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# nginx:alpine runs envsubst on /etc/nginx/templates/*.template at startup,
# so ${PORT} is filled in from Railway's PORT variable.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
ENV PORT=80
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]