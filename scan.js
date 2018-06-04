var noble = require('noble');
var winston = require('winston');
var async = require('async');
var advlib = require('advlib');
var mqtt = require('mqtt');
var XiaomiServiceReader = require('xiaomi-gap-parser');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

let mqttClient;

if (process.env.MQTT_URI) {
  mqttClient = mqtt.connect(process.env.MQTT_URI);
  mqttClient.on('connect', () => logger.info("mqtt connected"));
} else {
  console.debug("No MQTT_URI ENV var specified");
  process.exit(1)
}

let addresses;
if (process.env.ADDRESS_WHITELIST) {
  addresses = process.env.ADDRESS_WHITELIST.split(',');
}

function parseServiceDataBytes(uuid, data) {
  const obj = { serviceData: { uuid: uuid, data: data.toString('hex') }};
  advlib.ble.data.gatt.services.process(obj);
  if (uuid.toString('hex') === 'fe95') {
    obj.serviceData.xiaomi = XiaomiServiceReader.readServiceData(data);
  }
  return obj;
}

function publishData(peripheral, data) {
  logger.info("publish", Object.assign({mac: peripheral.address}, data))
  const callback = (e) => {
    if(e) {
      logger.error("error publishing", e);
    }
  };

  mqttClient.publish("sensors/" + peripheral.address + "/ble-gateway", '1', {retain: true}, callback);
  mqttClient.publish("sensors/" + peripheral.address + "/ble-gateway-uuid", process.env.RESIN_DEVICE_UUID, {retain: true}, callback);
  mqttClient.publish("sensors/" + peripheral.address + "/local_name", peripheral.advertisement.localName, {retain: true}, callback);
  mqttClient.publish("sensors/" + peripheral.address + "/transmission_power", peripheral.advertisement.txPowerLevel, {retain: true}, callback);
  mqttClient.publish("sensors/" + peripheral.address + "/datetime", Date.now().toString(), {retain: true}, callback);

  for(let key in data) {
    mqttClient.publish(
      "sensors/" + peripheral.address + "/" + key,
      String(data[key]),
      {retain: true},
      callback
    );
  }
}

function processServiceData(peripheral, serviceData) {
  var parsed = parseServiceDataBytes(serviceData.uuid, serviceData.data);

  if (parsed.serviceData.minew) {
    publishData(peripheral, {
      device: 'Minew S1',
      temperature: parsed.serviceData.minew.temperature,
      humidity: parsed.serviceData.minew.humidity,
      battery_percentage: parsed.serviceData.minew.batteryPercent,
    });
  };

  if (parsed.serviceData.xiaomi) {
    publishData(peripheral, {
      device: 'Xiaomi Mijia BTLE TH',
      temperature: parsed.serviceData.xiaomi.event.tmp,
      humidity: parsed.serviceData.xiaomi.event.hum
    });
  };
}

noble.on('stateChange', function(state) {
  if (state === 'poweredOn') {
    noble.startScanning([], true);
  } else {
    noble.stopScanning();
  }
});

noble.on('discover', function(peripheral) {
    var advertisement = peripheral.advertisement;

    if(addresses && addresses.indexOf(peripheral.address) === -1) {
      return;
    }

    var localName = advertisement.localName;
    var txPowerLevel = advertisement.txPowerLevel;
    var serviceData = advertisement.serviceData;

    if(advertisement.serviceData) {
      for (let i in advertisement.serviceData) {
        var serviceData = advertisement.serviceData[i];
        if(serviceData) {
          processServiceData(peripheral, serviceData);
        }
      }
    }
});

logger.info("boot scan")
