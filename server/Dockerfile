FROM oven/bun:1 as build
WORKDIR /app
COPY . .
RUN bun build --compile --minify --sourcemap ./index.ts --outfile server

FROM debian:12-slim
COPY --from=build /app/server /bin/
RUN chmod +x /bin/server
CMD /bin/server