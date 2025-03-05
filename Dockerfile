FROM oven/bun:alpine
COPY . /bot
WORKDIR /bot
RUN bun install --production --no-cache
CMD ["bun", "start"]