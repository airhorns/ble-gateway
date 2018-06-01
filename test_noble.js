var noble = require('noble');
var async = require('async');
var advlib = require('advlib');

var addresses = [
  'f5:d5:b7:79:1a:b2', // nRF5x aka S1
  // 'ac:23:3f:a0:3b:05', // nRF5x aka S1
  // '4c:65:a8:d3:c8:36', // MJ_HT_V1 aka Xiaomi sensor
  // 'f5:d5:b7:79:1a:b2', // SKYBEACON
];

noble.on('stateChange', function(state) {
  if (state === 'poweredOn') {
    noble.startScanning();
  } else {
    noble.stopScanning();
  }
});

noble.on('discover', function(peripheral) {
    var advertisement = peripheral.advertisement;
    var address = peripheral.address;
    var localName = advertisement.localName;
    var txPowerLevel = advertisement.txPowerLevel;
    var manufacturerData = advertisement.manufacturerData;
    var serviceData = advertisement.serviceData;
    var serviceUuids = advertisement.serviceUuids;

    console.log('peripheral ' + address + ' (' + localName + ') with ID ' + peripheral.id + ' found');
    if(addresses.indexOf(address) === -1) {
      return;
    }

    // Skip apple
    if(manufacturerData && manufacturerData.toString('hex').substr(0, 4) === "4c00") {
      return;
    }

    console.log ('  Address            = ' + address);
    if (localName) {
      console.log('  Local Name        = ' + localName);
    }

    if (txPowerLevel) {
      console.log('  TX Power Level    = ' + txPowerLevel);
    }

    if (manufacturerData) {
      console.log('  Manufacturer Data = ' + manufacturerData.toString('hex'));
    }

    if (serviceData && serviceData[0]) {
      console.log('  Service ' + serviceData[0].uuid + ' Data = ' + serviceData[0].data.toString('hex'));
    }

    if (serviceUuids) {
      console.log('  Service UUIDs     = ' + serviceUuids);
    }

    console.log();

    explore(peripheral);
});

function explore(peripheral) {
  console.log('services and characteristics:');

  peripheral.on('disconnect', function() {
    console.log('disconnected from ' + peripheral.id);
  });

  peripheral.connect(function(error) {
    peripheral.discoverServices([], function(error, services) {
      var serviceIndex = 0;

      async.whilst(
        function () {
          return (serviceIndex < services.length);
        },
        function(callback) {
          var service = services[serviceIndex];
          var serviceInfo = "Service #" + serviceIndex + ": " + service.uuid;

          if (service.name) {
            serviceInfo += ' (' + service.name + ')';
          }
          console.log(serviceInfo);
          // console.log(service);
          service.discoverCharacteristics([], function(error, characteristics) {
            var characteristicIndex = 0;

            async.whilst(
              function () {
                return (characteristicIndex < characteristics.length);
              },
              function(callback) {
                var characteristic = characteristics[characteristicIndex];
                var characteristicInfo = '  ' + characteristic.uuid;

                if (characteristic.name) {
                  characteristicInfo += ' (' + characteristic.name + ')';
                }

                async.series([
                  function(callback) {
                    characteristic.discoverDescriptors(function(error, descriptors) {
                      async.detect(
                        descriptors,
                        function(descriptor, callback) {
                          if (descriptor.uuid === '2901') {
                            return callback(descriptor);
                          } else {
                            return callback();
                          }
                        },
                        function(userDescriptionDescriptor){
                          if (userDescriptionDescriptor) {
                            userDescriptionDescriptor.readValue(function(error, data) {
                              if (data) {
                                characteristicInfo += ' (' + data.toString() + ')';
                              }
                              callback();
                            });
                          } else {
                            callback();
                          }
                        }
                      );
                    });
                  },
                  function(callback) {
                        characteristicInfo += '\n    properties  ' + characteristic.properties.join(', ');

                    if (characteristic.properties.indexOf('read') !== -1) {
                      characteristic.read(function(error, data) {
                        if (data) {
                          var string = data.toString('ascii');

                          characteristicInfo += '\n    value       ' + data.toString('hex') + ' | \'' + string + '\'';
                        }
                        callback();
                      });
                    } else {
                      callback();
                    }
                  },
                  function() {
                    console.log(characteristicInfo);
                    characteristicIndex++;
                    callback();
                  }
                ]);
              },
              function(error) {
                serviceIndex++;
                callback();
              }
            );
          });
        },
        function (err) {
          peripheral.disconnect();
        }
      );
    });
  });
}
