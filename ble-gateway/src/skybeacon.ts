export const isSkybeaconData = (serviceData: {uuid: string, data: string}) => {
  return serviceData.uuid === "ff80" && serviceData.data.slice(0, 2) === "64" && serviceData.data.slice(-2) === "ff";
};

export const parseSkybeaconServiceData = (hexString: string) => {
  // Skybeacon temperature / humidity data looks like this:
  // 641d2105ff -> 29.2 C, 31% RH
  const temperature = parseInt(hexString.slice(2, 5), 16) / 16.0;
  const humidity = parseInt(hexString.slice(6, 8), 16) / (16.0 * 16.0) * 1000;
  const ret: { model: string, temperature?: number, humidity?: number } = {model: "SKYBEACON"};
  if (temperature !== 0) {
    ret.temperature = temperature;
  }
  if (humidity !== 0) {
    ret.humidity = humidity;
  }
  return ret;
};
