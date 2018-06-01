FROM resin/raspberry-pi-node
RUN apt-get -y update
RUN apt-get install -y bluetooth bluez libbluetooth-dev libudev-dev

COPY package.json /package.json
COPY yarn.lock /yarn.lock
RUN npm install -g npm && npm install -g node-gyp@latest && npm install -g yarn && node -v && npm -v && yarn -v && node-gyp -v
RUN yarn install

COPY scan.js /usr/src/app/scan.js

ENV INITSYSTEM on
CMD ["node", "/usr/src/app/scan.js"]