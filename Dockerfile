FROM oven/bun:alpine
COPY src /bot/src
COPY package.json /bot
COPY bun.lock /bot
WORKDIR /bot
RUN bun install --production --no-cache
CMD ["bun", "start"]