# syntax=docker/dockerfile:1

# ---- deps -----------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- test (docker-compose.test.yml → frontend-tests) ----------------------
# Lint, typecheck and unit tests. Not part of the default build: the runtime stage never references it.
FROM deps AS test
ENV CI=true
COPY . .
CMD ["npm", "run", "check"]

# ---- build ----------------------------------------------------------------
FROM deps AS build
COPY . .
RUN npm run build

# ---- runtime --------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY docker-entrypoint.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh

# API_BASE_URL is read at container start and written into runtime-config.js.
ENV API_BASE_URL=""
EXPOSE 80
