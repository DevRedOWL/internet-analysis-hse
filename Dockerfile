FROM node:16 as builder

# Set work directory
WORKDIR /app
COPY . /app

COPY package.json yarn.lock .env /app/

RUN npm install --global npm@latest
RUN npm install --global node-gyp@latest
RUN npm config set node_gyp $(npm prefix -g)/lib/node_modules/node-gyp/bin/node-gyp.js
RUN python3 --version
RUN python3 -m pip --version

RUN yarn
RUN yarn install

CMD ["yarn","start"]
