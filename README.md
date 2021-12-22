# HSE Bot App

## Required infrastructure
1. Install LTS NodeJS for your OS: https://nodejs.org/en/download/
2. Install docker: https://docs.docker.com/get-docker/
3. Install yarn package manager: `npm install yarn -g`
4. Restart your PC

## Installation
1. Create **.env** file based on **.env.dist** and change needed variables `cp .env.dist .env`
2. Run `docker-compose up --force-recreate --build`
3. Done!

## Example requests
### Частотный анализ текста:
```
curl 'http://localhost:3000/frequrency' \
  -H 'content-type: application/json' \
  --data-raw '{"text":"Should be rather a long text. This is an useless sentence. Hello, world. Significantly tested message over here.","compression":1}' \
  --compressed
```
### Оценка тональности текста:
```
curl 'http://localhost:3000/tonal' \
  -H 'Connection: keep-alive' \
  -H 'content-type: application/json' \
  --data-raw '{"text":"Very neutral but bad text"}' \
```
### Поиск отзывов по названию фильма и оценка их тональности:
```
curl 'http://localhost:3000/reviews' \
  -H 'content-type: application/json' \
  --data-raw '{"name":"Форсаж 5"}' \
  --compressed
```

## BOT Features:
1. Игра в тайного санту с использованием БД
2. Поиск отзывов к фильму по его названию
3. Установка списка команд бота (справка)
4. Отправка тональности полученного сообщения в ответ
