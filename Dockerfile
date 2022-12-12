FROM node:16 as builder

# Set work directory
WORKDIR /app
COPY . /app

COPY package.json yarn.lock .env /app/

RUN yarn
RUN yarn install

CMD ["yarn","start"]
