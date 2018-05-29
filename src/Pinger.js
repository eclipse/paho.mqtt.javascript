/**
  * Repeat keepalive requests, monitor responses.
  * @ignore
  */

import { ERROR, MESSAGE_TYPE, format, global } from "./definitions";
import WireMessage from "./WireMessage";

function doTimeout(pinger) {
  return function() {
    return pinger.doPing();
  };
}

/**
* Repeat keepalive requests, monitor responses.
* @ignore
*/
export default class {
  constructor(client, keepAliveInterval) {
    this._client = client;
    this._keepAliveInterval = keepAliveInterval * 1000;
    this.isReset = false;

    this.pingReq = new WireMessage(MESSAGE_TYPE.PINGREQ).encode();

  }

  doPing() {
    if(!this.isReset) {
      this._client._trace("Pinger.doPing", "Timed out");
      this._client._disconnected(ERROR.PING_TIMEOUT.code, format(ERROR.PING_TIMEOUT));
    } else {
      this.isReset = false;
      this._client._trace("Pinger.doPing", "send PINGREQ");
      this._client.socket.send(this.pingReq);
      this.timeout = global.setTimeout(doTimeout(this), this._keepAliveInterval);
    }
  }

  reset() {
    this.isReset = true;
    global.clearTimeout(this.timeout);
    if(this._keepAliveInterval > 0) {
      this.timeout = setTimeout(doTimeout(this), this._keepAliveInterval);
    }
  }

  cancel() {
    global.clearTimeout(this.timeout);
  }
}
