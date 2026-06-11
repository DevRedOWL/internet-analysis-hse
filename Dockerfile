FROM node:20-bookworm-slim

WORKDIR /app
COPY . /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    fontconfig \
    fonts-noto-core \
    python3 \
    make \
    g++ \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock .env /app/

RUN yarn install --frozen-lockfile

CMD ["yarn", "start"]
