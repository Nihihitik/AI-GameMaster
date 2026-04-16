# syntax=docker/dockerfile:1.7
FROM node:22-alpine

WORKDIR /app

ENV WATCHPACK_POLLING=true \
    CHOKIDAR_USEPOLLING=true \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NODE_ENV=development

# Зависимости отдельным слоем — кэшируется при неизменных lock'ах
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --no-audit --no-fund

# Исходники (перетираются bind-mount'ом в compose, нужны для standalone-сборки)
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
