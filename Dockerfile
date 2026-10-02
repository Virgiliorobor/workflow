# Static demo of the ICM Workspace Builder wizard (no AI backend).
# Serves only index.html, css/ and js/. The optional FastAPI backend in
# backend/ is not deployed, so the "build with AI" button stays disabled.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/
COPY css /usr/share/nginx/html/css
COPY js /usr/share/nginx/html/js
EXPOSE 80
