import * as winston from "winston";
import * as mqtt from "mqtt";
import * as advlib from "advlib";
import * as XiaomiServiceReader from "xiaomi-gap-parser";
import noble = require("noble");

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

let mqttClient: mqtt.Client;

if (process.env.MQTT_URI) {
  mqttClient = mqtt.connect(process.env.MQTT_URI);
  mqttClient.on("connect", () => logger.info("mqtt connected"));
} else {
  logger.error("No MQTT_URI ENV var specified");
  process.exit(1);
}

interface IParsedServiceData {
  uuid: string;
  data: string;
  xiaomi?: {
    productId: number;
    counter: number;
    frameControl: string[];
    mac: string;
    event: {
      eventId: number;
      length: number;
      raw: string;
      data: {
        tmp?: number;
        bat?: number;
        hum?: number;
      }
    }
  };
  minew?: {
    frameType: string;
    productModel: number;
    batteryPercent: number;
    temperature: number;
    humidity: number;
    macAddress: string;
  };
}

const parseServiceDataBytes = (uuid: string, data: Buffer) => {
  const obj: {serviceData: IParsedServiceData}  = { serviceData: { uuid, data: data.toString("hex") }};
  advlib.ble.data.gatt.services.process(obj);

  if (uuid === "fe95") {
    obj.serviceData.xiaomi = XiaomiServiceReader.readServiceData(data);
  }

  return obj;
};

const publishData = (peripheral: noble.Peripheral, data: {[key: string]: any}) => {
  logger.info("publish", Object.assign({mac: peripheral.address}, data));

  const callback = (e?: Error) => {
    if (e) { logger.error("error publishing", e); }
  };
  const publishOptions = {qos: 1, retain: true} as any;

  mqttClient.publish("sensors/" + peripheral.address + "/ble-gateway", "1", publishOptions, callback);
  mqttClient.publish("sensors/" + peripheral.address + "/ble-gateway-uuid", process.env.RESIN_DEVICE_UUID, publishOptions, callback);
  mqttClient.publish("sensors/" + peripheral.address + "/local_name", peripheral.advertisement.localName, publishOptions, callback);
  mqttClient.publish("sensors/" + peripheral.address + "/transmission_power", String(peripheral.advertisement.txPowerLevel), publishOptions, callback);
  mqttClient.publish("sensors/" + peripheral.address + "/datetime", Date.now().toString(), publishOptions, callback);

  Object.keys(data).forEach((key) => {
    mqttClient.publish(
      "sensors/" + peripheral.address + "/" + key,
      String(data[key]),
      publishOptions,
      callback,
    );
  });
};

const processServiceData = (peripheral: noble.Peripheral, serviceData: any) => {
  const parsed = parseServiceDataBytes(serviceData.uuid, serviceData.data);

  if (parsed.serviceData.minew) {
    publishData(peripheral, {
      device: "Minew S1",
      temperature: parsed.serviceData.minew.temperature,
      humidity: parsed.serviceData.minew.humidity,
      battery_percentage: parsed.serviceData.minew.batteryPercent,
    });
  }

  if (parsed.serviceData.xiaomi) {
    publishData(peripheral, {
      device: "Xiaomi Mijia BTLE TH",
      temperature: parsed.serviceData.xiaomi.event.data.tmp,
      humidity: parsed.serviceData.xiaomi.event.data.hum,
    });
  }
};

noble.on("stateChange", (state) => {
  if (state === "poweredOn") {
    noble.startScanning([], true);
  } else {
    noble.stopScanning();
  }
});

noble.on("discover", (peripheral) => {
    // Skip apple
    const manufacturerData = peripheral.advertisement.manufacturerData;
    if (manufacturerData && manufacturerData.toString("hex").substr(0, 4) === "4c00") {
      return;
    }

    // Skip unknown macs
    const mac = peripheral.address;
    if (!mac || mac === "unknown") {
      return;
    }

    if (peripheral.advertisement.serviceData) {
      (peripheral.advertisement as any).serviceData.forEach((serviceData: {uuid: string, data: Buffer}) => {
        if (serviceData) {
          processServiceData(peripheral, serviceData);
        }
      });
    }
});

logger.info("boot scan");
