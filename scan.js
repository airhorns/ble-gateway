var noble = require('noble');
var winston = require('winston');
var async = require('async');
var advlib = require('advlib');
var mqtt = require('mqtt');
var XiaomiServiceReader = require('xiaomi-gap-parser');


const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.File({ filename: 'scan.log' })]
});

let mqttClient;

if (process.env.MQTT_URI) {
  mqttClient = mqtt.connect(process.env.MQTT_URI);
  mqttClient.on('connect', () => logger.info("mqtt connected"));
} else {
  console.debug("No MQTT_URI ENV var specified");
  process.exit(1)
}

const addresses = [
  'ac:23:3f:a0:3b:16', // nRF5x aka S1
  'ac:23:3f:a0:3b:05', // nRF5x aka S1
  '4c:65:a8:d3:c8:36', // MJ_HT_V1 aka Xiaomi sensor
  'f5:d5:b7:79:1a:b2', // SKYBEACON
];

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

function parseServiceData(uuid, data) {
  const obj = { serviceData: { uuid: uuid, data: data }};
  advlib.ble.data.gatt.services.process(obj);
  if (uuid.toString('hex') === 'fe95') {
    obj.serviceData.xiaomi = XiaomiServiceReader.readServiceData(data);
    }
  return obj;
}

function publishData(peripheral, data) {
  logger.info("publish", Object.assign({mac: peripheral.address}, data))
  mqttClient.publish("sensors/" + peripheral.address + "/local_name", peripheral.advertisement.localName)
  mqttClient.publish("sensors/" + peripheral.address + "/txPowerLevel", peripheral.advertisement.txPowerLevel)

  for(let key in data) {
    mqttClient.publish("sensors/" + peripheral.address + "/" + key, String(data[key]))
  }
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

    if(addresses.indexOf(peripheral.address) === -1) {
      return;
    }

    var localName = advertisement.localName;
    var txPowerLevel = advertisement.txPowerLevel;
    var serviceData = advertisement.serviceData;

    if(advertisement.serviceData) {
      for (let i in advertisement.serviceData) {
        var serviceData = advertisement.serviceData[i];
        if(serviceData) {
          var parsed = parseServiceData(serviceData.uuid, serviceData.data.toString('hex'));
          if (parsed.serviceData.minew) {
            publishData(peripheral, {
              temperature: parsed.serviceData.minew.temperature,
              humidity: parsed.serviceData.minew.humidity,
              battery_percentage: parsed.serviceData.minew.batteryPercent,
            });
          }
        }
      }
    }
});

logger.info("boot scan")
