import { ERROR, format, global, uriRegex } from "./definitions";
import EventEmitter from "eventemitter3";

const readyState = {
  CONNECTING: 0,  // The connection is not yet open.
  OPEN: 1,        // The connection is open and ready to communicate.
  CLOSING: 2,     // The connection is in the process of closing.
  CLOSED: 3       // The connection is closed or couldn't be opened.
};

export default class extends EventEmitter {
  constructor() {
    super();
    this.on("close", () => {
      this.socket = null;
    });
  }
  
  async connectWs(url, mqttVersion) {
    // Check dependencies are satisfied in this browser.
    if(!("WebSocket" in global && global.WebSocket !== null)) {
      throw new Error(format(ERROR.UNSUPPORTED, ["WebSocket"]));
    }
    const ws = new global.WebSocket(url, [(mqttVersion < 4) ? "mqttv3.1" : "mqtt"]);
    ws.binaryType = "arraybuffer";
    const onClose = (event) => {
            ws.removeEventListener("close", onClose);
            ws.removeEventListener("error", onError);
            ws.removeEventListener("message", onMessage);
            this.emit("close", event);
          },
          onError = (event) => {
            this.emit("error", event);
          },
          onMessage = (event) => {
            this.emit("message", event);
          },
          promisifyEvent = (name) => new Promise((resolve, reject) => {
            const localOnEvent = (event) => {
                    ws.removeEventListener(name, localOnEvent);
                    ws.removeEventListener("error", localOnError);
                    resolve(event);
                  },
                  localOnError = (err) => {
                    ws.removeEventListener(name, localOnEvent);
                    ws.removeEventListener("error", localOnError);
                    reject(err);
                  };
            ws.addEventListener(name, localOnEvent);
            ws.addEventListener("error", localOnError);
          }),
          socket = {
            get readyState() {
              return ws.readyState;
            },
            send: (buffer) => ws.send(buffer),
            close: () => {
              ws.close();
              return promisifyEvent("close");
            }
          };
    return promisifyEvent("open")
      .then((event) => {
        ws.addEventListener("close", onClose);
        ws.addEventListener("error", onError);
        ws.addEventListener("message", onMessage);
      return ws;
    });
  }

  async connectTcp(host, port, useSsl) {
    const promisify = (fn, ...args) => (
      new Promise((fnresolve, fnreject) => {
        fn(...args, (fnresult) => {
          if(global.chrome.runtime.lastError) {  
            return fnreject(global.chrome.runtime.lastError);
          }
          fnresolve(fnresult);
        })
      })
    );
    const {socketId} = await promisify(global.chrome.sockets.tcp.create, {});
    const errorFilter = (event) => {
            if (event.socketId === socketId) {
              this.emit("error", {
                data: event.resultCode
              });
            }
          },
          messageFilter = (event) => {
            if (event.socketId === socketId) {
              this.emit("message", event);
            }
          },
          open = () => {
            global.chrome.sockets.tcp.onReceive.addListener(messageFilter);
            global.chrome.sockets.tcp.onReceiveError.addListener(errorFilter);
            socket.readyState = readyState.OPEN;
            return socket;
          },
          socket = {
            readyState: readyState.CONNECTING,
            send: (buffer) => (
              // eslint-disable-next-line no-empty-function
              global.chrome.sockets.tcp.send(socketId, buffer, () => {})
            ),
            close: () => {
              global.chrome.sockets.tcp.onReceive.removeListener(messageFilter);
              global.chrome.sockets.tcp.onReceiveError.removeListener(errorFilter);
              return promisify(global.chrome.sockets.tcp.disconnect, socketId)
                .then(() => promisify(global.chrome.sockets.tcp.close, socketId))
                .then(() => {
                  socket.readyState = readyState.CLOSED;
                  this.emit("close");
                });
            }
          };
    if(useSsl) {
      return promisify(global.chrome.sockets.tcp.setPaused, socketId, true)
      .then(() => promisify(global.chrome.sockets.tcp.connect, socketId, host, port))
      .then(() => promisify(global.chrome.sockets.tcp.secure, socketId))
      .then(() => promisify(global.chrome.sockets.tcp.setPaused, socketId, false))
      .then(() => open());
    } else {
      return promisify(global.chrome.sockets.tcp.connect, socketId, host, port)
      .then(() => open());
    }
  }

  async connect({url, mqttVersion}) {
    const match    = url.match(uriRegex);
    const host     = match[4] || match[2], // IP4 or [IP6]
          // path     = match[8],
          port     = parseInt(match[7]),
          protocol = match[1];
    
    if(this.socket) {
      throw new Error(format(ERROR.INVALID_STATE, ["connected already. Close existing connecting first"]));
    }
    try {
      if(protocol.startsWith("ws")) {
        this.socket = await this.connectWs(url, mqttVersion);
      } else if((protocol === "tcp" || protocol === "tls") && global.chrome && global.chrome.sockets && global.chrome.sockets.tcp) {
        this.socket = await this.connectTcp(host, port, (protocol === "tls"));
      } else {
        throw new Error(format(ERROR.UNSUPPORTED, ["protocol '" + protocol + "'"]));
      }
      this.emit("open", this.socket);
    } catch(err) {
      this.emit("error", {
        data: err
      });
    }
    return this.socket;
  }

  send(buffer) { // type ArrayBuffer
    if(!this.isOpen()) {
      throw new Error(format(ERROR.INVALID_STATE, ["not connected"]));
    }
    this.socket.send(buffer);
  }

  async close() {
    if(this.isOpen()) {
      await this.socket.close();
    }
  }

  isOpen() {
    return this.socket && this.socket.readyState === readyState.OPEN;
  }
}
