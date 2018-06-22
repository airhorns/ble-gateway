import * as winston from "winston";
import advlib from "advlib";
import * as XiaomiServiceReader from "xiaomi-gap-parser";
import noble = require("noble");
noble.stopScanning();

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

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

const processServiceData = (peripheral: noble.Peripheral, serviceData: any) => {
  return parseServiceDataBytes(serviceData.uuid, serviceData.data);
};

if (noble.state === "poweredOn") {
  noble.startScanning([], true);
  logger.info("BLE scanner was already powered on, scanning");
} else {
  noble.on("stateChange", (state) => {
    if (state === "poweredOn") {
      noble.startScanning([], true);
      logger.info("BLE scanner powered on, scanning");
    } else {
      noble.stopScanning();
      logger.error(`BLE scanner stateChange to ${state}, shutting down`);
      process.exit(1);
    }
  });
}

noble.on("discover", (peripheral) => {
    // Skip apple
    const manufacturerData = peripheral.advertisement.manufacturerData;
    if (manufacturerData && manufacturerData.toString("hex").substr(0, 4) === "4c00") {
      return;
    }

    // Skip unknown macs
    const mac = peripheral.address;
    const macs = ["f5:d5:b7:79:1a:b2", "ff:ac:3c:7e:36:fb"];
    // if (macs.indexOf(mac) === -1) {
    //   return;
    // }

    // Push macs
    if (peripheral.advertisement.serviceData) {
      (peripheral.advertisement as any).serviceData.forEach((serviceData: {uuid: string, data: Buffer}) => {
        if (serviceData) {
          const data = processServiceData(peripheral, serviceData);
          if (
              (data.serviceData as any).companyName === "Estimote" ||
              // (data.serviceData as any).companyName === "Google" ||
              (data.serviceData as any).companyName === "Xiaomi Inc." ||
              typeof data.serviceData.minew !== "undefined") {
            return;
          }
          console.log(data);
          if((data.serviceData as any).companyName === "Google") {
            console.log(`googly address at ${mac}`);
          }
          // peripheral.discoverAllServicesAndCharacteristics((error, services, characteristics) => {
          //   console.log(`Connected to ${peripheral.address}`);
          //   console.log({
          //     serviceData: data,
          //     error,
          //     services,
          //     characteristics,
          //   });
          // });

        }
      });
    }
});

noble.on("warning", (message: string) => {
  logger.warning("noble warning: " + message);
});

logger.info(`boot scan, adapter state: ${noble.state}`);
