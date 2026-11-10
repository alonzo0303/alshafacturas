# Compila primero: npm ci --prefix frontend && npm run build --prefix frontend
FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY --chmod=0444 deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --chmod=0755 frontend/dist /usr/share/nginx/html
EXPOSE 8080
