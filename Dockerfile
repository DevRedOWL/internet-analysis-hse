FROM node:20-bookworm-slim

WORKDIR /app

# System deps — layer is cached until this block changes
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

# Install node deps before copying source — cache survives code edits
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# App source (and .env on the server) last — only this layer rebuilds on deploy
COPY . .

CMD ["yarn", "start"]
