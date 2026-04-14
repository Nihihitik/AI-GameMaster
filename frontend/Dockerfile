# syntax=docker/dockerfile:1.7
FROM node:20-alpine

WORKDIR /app

ENV CHOKIDAR_USEPOLLING=true \
    WATCHPACK_POLLING=true \
    HOST=0.0.0.0 \
    PORT=3000 \
    CI=false \
    BROWSER=none \
    NODE_ENV=development

# Слой зависимостей отдельно от исходников — кэшируется при неизменных lock'ах.
# --legacy-peer-deps нужен из-за связки React 19 + react-scripts 5
# (CRA не знает про новые peer-range'ы и падает на strict-резолвере npm 7+).
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --legacy-peer-deps --no-audit --no-fund

# Исходники (перетираются bind-mount'ом в compose, нужны для standalone-сборки)
COPY . .

EXPOSE 3000

CMD ["npm", "start"]
