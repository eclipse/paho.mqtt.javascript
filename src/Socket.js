import { ERROR, format, uriRegex } from "./definitions";
import EventEmitter from "eventemitter3";

const readyState = {
  CONNECTING: 0,  // The connection is not yet open.
  OPEN: 1,        // The connection is open and ready to communicate.
  CLOSING: 2,     // The connection is in the process of closing.
  CLOSED: 3       // The connection is closed or couldn't be opened.
};

export default class extends EventEmitter {
  /*
  constructor() {
    super(); 
  }
  */
  
  connectWs(url, mqttVersion) {
    // Check dependencies are satisfied in this browser.
    if(!("WebSocket" in global && global.WebSocket !== null)) {
      throw new Error(format(ERROR.UNSUPPORTED, ["WebSocket"]));
    }
    if(mqttVersion < 4) {
      this.socket = new WebSocket(url, ["mqttv3.1"]);
    } else {
      this.socket = new WebSocket(url, ["mqtt"]);
    }
    this.socket.binaryType = "arraybuffer";
    const onClose = (event) => {
            if(this.socket) {
              this.socket.removeEventListener("close", onClose);
              this.socket.removeEventListener("error", onError);
              this.socket.removeEventListener("message", onMessage);
              this.socket.removeEventListener("open", onOpen);
            }
            this.emit("close", event);
          },
          onError = (event) => {
            this.emit("error", event);
          },
          onMessage = (event) => {
            this.emit("message", event);
          },
          onOpen = (event) => {
            this.emit("open", event);
          };
    this.socket.addEventListener("close", onClose);
    this.socket.addEventListener("error", onError);
    this.socket.addEventListener("message", onMessage);
    this.socket.addEventListener("open", onOpen);
  } 

  connectTcp(host, port, useSsl) {
    global.chrome.sockets.tcp.create({}, ({socketId}) => {
      if(global.chrome.runtime.lastError) {
        this.emit("error", {
          data: global.chrome.runtime.lastError
        });
        return true;
      }
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
            };
      const socket = this.socket = {
        readyState: readyState.CONNECTING,
        send: (buffer) => (
          // eslint-disable-next-line no-empty-function
          global.chrome.sockets.tcp.send(socketId, buffer, () => {})
        ),
        close: () => {
          global.chrome.sockets.tcp.onReceive.removeListener(messageFilter);
          global.chrome.sockets.tcp.onReceiveError.removeListener(errorFilter);
          global.chrome.sockets.tcp.disconnect(socketId, () => {
            global.chrome.sockets.tcp.close(socketId, () => {
              if(this.socket === socket) {
                this.emit("close");
              }
            });
          });
        }
      };
      const hasError = () => {
        if(socket !== this.socket) {
          // not current anymore (timeout?!)
          return true;
        }
        if(global.chrome.runtime.lastError) {
          this.emit("error", {
            data: global.chrome.runtime.lastError
          });
          return true;
        }
      },
      open = () => {
        socket.readyState = readyState.OPEN;
        this.emit("open");
        global.chrome.sockets.tcp.onReceive.addListener(messageFilter);
        global.chrome.sockets.tcp.onReceiveError.addListener(errorFilter);
      };
      if(useSsl) {
        global.chrome.sockets.tcp.setPaused(socketId, true, () => {
          if(hasError()) {
            return;
          }
          global.chrome.sockets.tcp.connect(socketId, host, port, () => {
            if(hasError()) {
              return;
            }
            global.chrome.sockets.tcp.secure(socketId, () => {
              if(hasError()) {
                return;
              }
              global.chrome.sockets.tcp.setPaused(socketId, false, () => {
                if(hasError()) {
                  return;
                }
                open();
              });
            });
          });
        });
      } else {
        global.chrome.sockets.tcp.connect(socketId, host, port, () => {
          if(hasError()) {
            return;
          }
          open();
        });
      }
    });
  }

  connect({url, mqttVersion}) {
    const match    = url.match(uriRegex);
    const host     = match[4] || match[2], // IP4 or [IP6]
          // path     = match[8],
          port     = parseInt(match[7]),
          protocol = match[1];
    
    if(this.socket) {
      throw new Error(format(ERROR.INVALID_STATE, ["connected already. Close existing connecting first"]));
    }
    if(protocol.startsWith("ws")) {
      return this.connectWs(url, mqttVersion);
    } else if((protocol === "tcp" || protocol === "tls") && global.chrome && global.chrome.sockets && global.chrome.sockets.tcp) {
      return this.connectTcp(host, port, (protocol === "tls"));
    } else {
      throw new Error(format(ERROR.UNSUPPORTED, ["protocol '" + protocol + "'"]));
    }
  }

  send(buffer) { // type ArrayBuffer
    if(!this.isOpen()) {
      throw new Error(format(ERROR.INVALID_STATE, ["not connected"]));
    }
    this.socket.send(buffer);
  }

  close() {
    if(this.isOpen()) {
      this.socket.close();
    }
    delete this.socket;
  }

  isOpen() {
    return this.socket && this.socket.readyState === readyState.OPEN;
  }
}
