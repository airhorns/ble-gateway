FROM resin/raspberry-pi-alpine-node:8.11-slim
RUN apk update && apk add git bluez eudev-dev python make gcc g++

RUN npm install -g npm && npm install -g node-gyp@latest && npm install -g yarn && node -v && npm -v && yarn -v && node-gyp -v

COPY . /usr/src/app
WORKDIR /usr/src/app
RUN yarn install && \
    npm run build-ts && \
    apk del python make gcc g++ git && \
    npm cache clean --force && \
    rm -rf /tmp/*

ENV INITSYSTEM on
CMD ["node", "/usr/src/app/dist/scan.js"]
