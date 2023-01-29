FROM node:16 as builder

# Set work directory
WORKDIR /app
COPY . /app

COPY package.json yarn.lock .env /app/

RUN yarn
RUN yarn install --ignore-scripts --frozen-lockfile

# HEALTHCHECK CMD curl --fail http://localhost:3000 || exit 1

CMD ["yarn","start"]
