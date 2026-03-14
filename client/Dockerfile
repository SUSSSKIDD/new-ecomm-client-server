# Build stage
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Define build arguments that Vite replaces at build time
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage - Serve using lightweight Nginx
FROM nginx:alpine

# Copy built artifacts from the Vite dist folder to Nginx's default public folder
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

# Overwrite default Nginx configuration to support React Router (Single Page Application)
RUN echo "server { listen 80; location / { root /usr/share/nginx/html; index index.html index.htm; try_files \$uri \$uri/ /index.html; } }" > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
