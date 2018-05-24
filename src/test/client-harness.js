require("dotenv").config();

global.WebSocket = require("./WebSocket.js");

const LocalStorage = require("node-localstorage").LocalStorage;
global.localStorage = new LocalStorage("./persistence");

const Paho = require("../../dist/paho.mqtt.javascript");
global.Paho = Paho;

function ensureValue(prop, value) {
  if (prop === undefined || prop === "" || prop[0] === "$") {
    return value;
  }
  return prop;
}

function guid() {
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).
                    substring(1);
  return s4() + s4() + "-" + s4() + "-" + s4() + "-" +
    s4() + "-" + s4() + s4() + s4();
}

function printConfig(settings) { /* eslint-disable no-console */
  console.log(" - Eclipse Paho Javascript Client Test Harness Settings - ");
  console.log("Server URI: " + settings.server + ":" + settings.port + settings.path);
  console.log("MQTT Version: " + settings.mqttVersion);
  console.log("Interop Server URI: " + settings.interopServer + ":" + settings.interopPort + settings.interopPath);
}

module.exports = {
  server: ensureValue(process.env.TEST_SERVER, "iot.eclipse.org"),
  port: parseInt(ensureValue(process.env.TEST_SERVER_PORT, "443")),
  path: ensureValue(process.env.TEST_SERVER_PATH, "/ws"),
  mqttVersion: parseInt(ensureValue(process.env.TEST_SERVER_MQTTVER, "3")),
  interopServer: ensureValue(process.env.TEST_INTEROPSERVER, "iot.eclipse.org"),
  interopPort: parseInt(ensureValue(process.env.TEST_INTEROPPORT, "443")),
  interopPath: ensureValue(process.env.TEST_INTEROPPATH, "/ws"),
  useSSL: ensureValue((!process.env.TEST_USE_SSL || process.env.TEST_USE_SSL === "true"), true),
  topicPrefix: "paho-mqtt-test-" + guid(),
  Paho: Paho,
  printConfig: printConfig
};
