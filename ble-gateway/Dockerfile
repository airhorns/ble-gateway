FROM resin/raspberry-pi-node:8.11-slim

COPY package.json /usr/src/app/package.json
COPY yarn.lock /usr/src/app/yarn.lock
WORKDIR /usr/src/app

RUN apt-get update && \
    apt-get install -y --no-install-recommends git bluetooth bluez libbluetooth-dev libudev-dev python build-essential jq && \
    npm install -g npm yarn node-gyp && node -v && npm -v && yarn -v && node-gyp -v && \
    yarn && \
    apt-get remove python build-essential jq && apt-get autoremove && apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /tmp/*

COPY . /usr/src/app
RUN ls -lA && npx tsc -v && npm run build-ts

ENV INITSYSTEM on
CMD ["node", "/usr/src/app/dist/timeout-if-no-output.js", "--timeout", "60000", "node", "dist/scan.js"]
