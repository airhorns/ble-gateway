FROM resin/raspberry-pi-node:8.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends git bluetooth bluez libbluetooth-dev libudev-dev python make gcc g++

RUN npm install -g npm && npm install -g node-gyp@latest && npm install -g yarn && node -v && npm -v && yarn -v && node-gyp -v

COPY . /usr/src/app
WORKDIR /usr/src/app
RUN yarn install && \
    npm run build-ts && \
    apt-get remove python make gcc g++ git && apt-get clean && rm -rf /var/lib/apt/lists/* && \
    npm cache clean --force --loglevel error && \
    rm -rf /tmp/*

ENV INITSYSTEM on
CMD ["node", "/usr/src/app/dist/timeout-if-no-output.js", "--timeout", "60000", "node", "dist/scan.js"]