FROM node:20-alpine

WORKDIR /app

# Сначала ставим зависимости отдельным слоем для кэша.
# Используем `npm install`, а не `npm ci`, чтобы толерантно обрабатывать
# мелкие рассинхроны между package.json и package-lock.json в dev-контуре
# (в проде перед релизом локалку актуализируют и можно переключаться на ci).
COPY package.json package-lock.json ./
RUN npm install --no-audit --no-fund

# Копируем исходники
COPY . .

# Polling нужен для file-watcher'а CRA в Linux-контейнере (иначе hot reload
# не видит изменений из смонтированного volume).
ENV CHOKIDAR_USEPOLLING=true
ENV WATCHPACK_POLLING=true
# CRA dev-server слушает все интерфейсы внутри контейнера
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
