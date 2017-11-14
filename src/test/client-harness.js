global.self = global

var WebSocketClient = require('websocket').client
var Paho = require('../paho-mqtt')
require('dotenv').config()

global.WebSocket = function(wsurl, protocol) {
  var ws = new WebSocketClient()
  var connection
  var obj = {
    send: function(msg) {
      var nodeBuf = new Buffer(new Uint8Array(msg))
      connection.send(nodeBuf)
    },
    get readyState() {
      return ws.readyState;
    }
  };

  ws.binaryType = 'arraybuffer';

  ws.on("connect", function(conn) {
    connection = conn;
    conn.on("error", function(error) {
      console.log("socket error ", error);
      if (obj.onerror) {
        obj.onerror();
      }
    });

    conn.on("close", function(reasonCode, description) {
      console.log("socket closed ", description);
    })

    conn.on("message", function(message) {
      if (message.type === "binary") {
        if (obj.onmessage) {
          obj.onmessage({
            data: message.binaryData
          });
        }
      }
    });
    if (obj.onopen) {
      obj.onopen();
    }
  });
  ws.on('connectFailed', function(error) {
    console.log('Connect Error: ' + error.toString());
    if (obj.onerror) {
      obj.onerror(error);
    }
  });
  ws.connect(wsurl, protocol);
  return obj;
}


var LocalStorage = require('node-localstorage').LocalStorage
global.localStorage = new LocalStorage('./persistence')

var Paho = require('../paho-mqtt')
global.Paho = Paho



function ensureValue(prop, value) {
  if (prop === '' || prop[0] === '$') {
    return value
  }
  return prop
}

function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1)
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4()
}

function printConfig(settings) {
  console.log(' - Eclipse Paho Javascript Client Test Harness Settings - ')
  console.log('Server URI: ' + settings.server + ':' + settings.port + settings.path)
  console.log('MQTT Version: ' + settings.mqttVersion)
  console.log('Interop Server URI: ' + settings.interopServer + ':' + settings.interopPort + settings.interopPath)
}

module.exports = {
  server: ensureValue(process.env.TEST_SERVER, 'iot.eclipse.org'),
  port: parseInt(ensureValue(process.env.TEST_SERVER_PORT, '443')),
  path: ensureValue(process.env.TEST_SERVER_PATH, '/ws'),
  mqttVersion: parseInt(ensureValue(process.env.TEST_SERVER_MQTTVER, '3')),
  interopServer: ensureValue(process.env.TEST_INTEROPSERVER, 'iot.eclipse.org'),
  interopPort: parseInt(ensureValue(process.env.TEST_INTEROPPORT, '443')),
  interopPath: ensureValue(process.env.TEST_INTEROPPATH, '/ws'),
  useSSL: ensureValue((process.env.TEST_USE_SSL === 'true'), true),
  topicPrefix: 'paho-mqtt-test-' + guid(),
  Paho: Paho,
  printConfig: printConfig
}
