FROM node:lts-alpine as build
WORKDIR /git-monitor

RUN apk add --no-cache git

COPY ./package.json ./yarn.lock ./
RUN yarn install

COPY ./server.ts ./
RUN yarn tsc server.ts && yarn uglifyjs server.js -c -m -o server.js

RUN rm -rf node_modules
RUN yarn install --production
RUN rm -rf server.ts \
  package.json \
  yarn.lock \
  /usr/local/lib/node_modules \
  /usr/local/share/.cache/yarn \
  /opt/yarn* \
  /tmp

EXPOSE 3000

FROM scratch
COPY --from=build / /
ENTRYPOINT ["node", "/git-monitor/server.js", "/config.json"]
