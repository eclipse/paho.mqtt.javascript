const EventEmitter = require("eventemitter3"),
      ws           = require("nodejs-websocket");

global.self = global;

require("dotenv").config();

global.WebSocket = class extends EventEmitter {
  constructor(wsurl, protocol) {
    super();
    this.connection = ws.connect(wsurl, {
      protocols: protocol
    });

    this.connection.on("connect", () => this.emit("open"));
    this.connection.on("binary", (message) => {
      let data = Buffer.alloc(0);
      message.on("readable", () => {
        const newData = message.read();
        if(newData) {
          data = Buffer.concat([data, newData], data.length + newData.length);
        }
      });
      message.on("end", () => this.emit("message", { data }));
    });
    this.connection.on("close", () => this.emit("close"));
    this.connection.on("error", (err) => {
      console.error("error!", err)
      this.emit("error", err);
    });
  }

  addEventListener() {
    this.addListener.apply(this, arguments);
  }

  removeEventListener() {
    this.removeListener.apply(this, arguments);
  }

  send(msg) {
    const nodeBuf = Buffer.from(msg); // new Uint8Array
    this.connection.send(nodeBuf);
  }

  close() {
    this.connection.close();
  }

  get readyState() {
    return this.connection.readyState;
  }
};

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
