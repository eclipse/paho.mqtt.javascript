const EventEmitter = require("eventemitter3"),
      ws           = require("nodejs-websocket");

module.exports = class extends EventEmitter {
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
      this.emit("error", err);
    });
  }

  addEventListener() {
    this.addListener(...arguments);
  }

  removeEventListener() {
    this.removeListener(...arguments);
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
