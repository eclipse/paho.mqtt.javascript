global.self = global;

const ws = require('nodejs-websocket');
require('dotenv').config();

global.WebSocket = function (wsurl, protocol) {
    var connection = ws.connect(wsurl, {
        protocols: protocol
    });
    var onBinary = null;
    var obj = {
        send: function (msg) {
            var nodeBuf = new Buffer(new Uint8Array(msg));
            connection.send(nodeBuf);
        },
        get readyState() { return connection.readyState; },
        addEventListener: function(event, callback) {
            switch(event) {
                case "open":
                    connection.on("connect", callback);
                    break;
                case "message":
                    onBinary = function(message) {
                        var data = new Buffer(0);
                        message.on("readable", function () {
                            var newData = message.read()
                            if (newData)
                                data = Buffer.concat([data, newData], data.length + newData.length)
                        });
                        message.on("end", function () {
                            callback({ data });
                        });
                    };
                    connection.on("binary", onBinary);
                    break;
                default:
                    connection.on(event, callback);
                    break;
            };
        },
        removeEventListener(event, callback) {
            switch(event) {
                case "open":
                    connection.removeListener("connect", callback);
                    break;
                case "message":
                    connection.removeListener("binary", onBinary);
                    break;
                default:
                    connection.removeListener(event, callback);
                    break;
            };
        }
    };

    ws.binaryType = 'arraybuffer';
    return obj;
}

var LocalStorage = require('node-localstorage').LocalStorage;
global.localStorage = new LocalStorage('./persistence');

const Paho = require('../../dist/paho.mqtt.javascript')
global.Paho = Paho;

function ensureValue(prop, value) {
  if(prop === undefined || prop === '' || prop[0] === '$') {
    return value;
  }
  return prop;
}

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

function printConfig(settings) {
  console.log(' - Eclipse Paho Javascript Client Test Harness Settings - ');
  console.log('Server URI: ' + settings.server + ':' + settings.port + settings.path);
  console.log('MQTT Version: ' + settings.mqttVersion);
  console.log('Interop Server URI: ' + settings.interopServer + ':' + settings.interopPort + settings.interopPath);
}

module.exports = {
  server:        ensureValue(process.env.TEST_SERVER, 'iot.eclipse.org'),
  port:          parseInt(ensureValue(process.env.TEST_SERVER_PORT, '443')),
  path:          ensureValue(process.env.TEST_SERVER_PATH, '/ws'),
  mqttVersion:   parseInt(ensureValue(process.env.TEST_SERVER_MQTTVER, '3')),
  interopServer: ensureValue(process.env.TEST_INTEROPSERVER, 'iot.eclipse.org'),
  interopPort:   parseInt(ensureValue(process.env.TEST_INTEROPPORT, '443')),
  interopPath:   ensureValue(process.env.TEST_INTEROPPATH, '/ws'),
  useSSL:        ensureValue((!process.env.TEST_USE_SSL || process.env.TEST_USE_SSL === 'true'), true),
  topicPrefix:   'paho-mqtt-test-' + guid(),
  Paho:          Paho,
  printConfig:   printConfig
};
