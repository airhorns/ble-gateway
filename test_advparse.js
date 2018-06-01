var advlib = require('advlib');

var obj = { serviceData: { uuid: "fe95", data: "5020aa01ac36c8d3a8654c0d10041b013b02" } };

advlib.ble.data.gatt.services.process(obj);
console.log(obj);
