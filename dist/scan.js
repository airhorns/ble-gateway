"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston = __importStar(require("winston"));
const mqtt = __importStar(require("mqtt"));
const advlib = __importStar(require("advlib"));
const XiaomiServiceReader = __importStar(require("xiaomi-gap-parser"));
const noble = require("noble");
const logger = winston.createLogger({
    level: "info",
    format: winston.format.json(),
    transports: [new winston.transports.Console()],
});
let mqttClient;
if (process.env.MQTT_URI) {
    mqttClient = mqtt.connect(process.env.MQTT_URI);
    mqttClient.on("connect", () => logger.info("mqtt connected"));
}
else {
    logger.error("No MQTT_URI ENV var specified");
    process.exit(1);
}
const parseServiceDataBytes = (uuid, data) => {
    const obj = { serviceData: { uuid, data: data.toString("hex") } };
    advlib.ble.data.gatt.services.process(obj);
    if (uuid === "fe95") {
        obj.serviceData.xiaomi = XiaomiServiceReader.readServiceData(data);
    }
    return obj;
};
const publishData = (peripheral, data) => {
    logger.info("publish", Object.assign({ mac: peripheral.address }, data));
    const callback = (e) => {
        if (e) {
            logger.error("error publishing", e);
        }
    };
    const publishOptions = { qos: 1, retain: true };
    mqttClient.publish("sensors/" + peripheral.address + "/ble-gateway", "1", publishOptions, callback);
    mqttClient.publish("sensors/" + peripheral.address + "/ble-gateway-uuid", process.env.RESIN_DEVICE_UUID, publishOptions, callback);
    mqttClient.publish("sensors/" + peripheral.address + "/local_name", peripheral.advertisement.localName, publishOptions, callback);
    mqttClient.publish("sensors/" + peripheral.address + "/transmission_power", String(peripheral.advertisement.txPowerLevel), publishOptions, callback);
    mqttClient.publish("sensors/" + peripheral.address + "/datetime", Date.now().toString(), publishOptions, callback);
    Object.keys(data).forEach((key) => {
        mqttClient.publish("sensors/" + peripheral.address + "/" + key, String(data[key]), publishOptions, callback);
    });
};
const processServiceData = (peripheral, serviceData) => {
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
    }
    else {
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
        peripheral.advertisement.serviceData.forEach((serviceData) => {
            if (serviceData) {
                processServiceData(peripheral, serviceData);
            }
        });
    }
});
logger.info("boot scan");
//# sourceMappingURL=scan.js.map