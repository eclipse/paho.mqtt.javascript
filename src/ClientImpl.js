import { ERROR, MESSAGE_TYPE, format, global, parseUTF8 } from "./definitions";
import EventEmitter from "eventemitter3";
import Message from "./Message";
import Pinger from "./Pinger";
import Socket from "./Socket";
import Storage from "./Storage";
import WireMessage from "./WireMessage";

/** CONNACK RC Meaning. */
const CONNACK_RC = {
  0: "Connection Accepted",
  1: "Connection Refused: unacceptable protocol version",
  2: "Connection Refused: identifier rejected",
  3: "Connection Refused: server unavailable",
  4: "Connection Refused: bad user name or password",
  5: "Connection Refused: not authorized"
};

function readUint16(buffer, offset) {
  return 256 * buffer[offset] + buffer[offset + 1];
}

function decodeMessage(input, pos) {
  const startingPos = pos;
  let first = input[pos];
  const type = first >> 4;
  const messageInfo = first &= 0x0f;
  pos += 1;

  // Decode the remaining length (MBI format)

  let digit;
  let remLength = 0;
  let multiplier = 1;
  do {
    if(pos == input.length) {
      return [null, startingPos];
    }
    digit = input[pos++];
    remLength += ((digit & 0x7F) * multiplier);
    multiplier *= 128;
  } while((digit & 0x80) !== 0);

  const endPos = pos + remLength;
  if(endPos > input.length) {
    return [null, startingPos];
  }

  const wireMessage = new WireMessage(type);
  switch (type) {
    case MESSAGE_TYPE.CONNACK: {
      const connectAcknowledgeFlags = input[pos++];
      if(connectAcknowledgeFlags & 0x01) {
        wireMessage.sessionPresent = true;
      }
      wireMessage.returnCode = input[pos++];
      break;
    }
    case MESSAGE_TYPE.PUBLISH: {
      const qos = (messageInfo >> 1) & 0x03;

      const len = readUint16(input, pos);
      pos += 2;
      const topicName = parseUTF8(input, pos, len);
      pos += len;
      // If QoS 1 or 2 there will be a messageIdentifier
      if(qos > 0) {
        wireMessage.messageIdentifier = readUint16(input, pos);
        pos += 2;
      }

      const message = new Message(input.subarray(pos, endPos));
      if((messageInfo & 0x01) == 0x01) {
        message.retained = true;
      }
      if((messageInfo & 0x08) == 0x08) {
        message.duplicate =  true;
      }
      message.qos = qos;
      message.destinationName = topicName;
      wireMessage.payloadMessage = message;
      break;
    }
    case  MESSAGE_TYPE.PUBACK:
    case  MESSAGE_TYPE.PUBREC:
    case  MESSAGE_TYPE.PUBREL:
    case  MESSAGE_TYPE.PUBCOMP:
    case  MESSAGE_TYPE.UNSUBACK:
      wireMessage.messageIdentifier = readUint16(input, pos);
      break;

    case  MESSAGE_TYPE.SUBACK:
      wireMessage.messageIdentifier = readUint16(input, pos);
      pos += 2;
      wireMessage.returnCode = input.subarray(pos, endPos);
      break;

    default:
      break;
  }

  return [wireMessage, endPos];
}

/** @ignore */
function _traceMask(traceObject, masked) {
  const traceObjectMasked = {};
  for(const attr in traceObject) {
    if(traceObject.hasOwnProperty(attr)) {
      if(attr == masked) {
        traceObjectMasked[attr] = "******";
      } else {
        traceObjectMasked[attr] = traceObject[attr];
      }
    }
  }
  return traceObjectMasked;
}

/**
 * Internal implementation of the MQTT V3.1 client.
 *
 * @name Paho.ClientImpl @constructor
 * @param {String} clientId the MQ client identifier.
 */
export default class extends EventEmitter {
  constructor(uri, clientId) {
    super();
    Object.assign(this, {
      // Messaging Client public instance members.
      uri:      null,
      clientId: null,

      // Messaging Client private instance members.
      socket:                 new Socket(uri),
      /* true once we have received an acknowledgement to a CONNECT packet. */
      connected:              false,
      /* The largest message identifier allowed, may not be larger than 2**16 but
       * if set smaller reduces the maximum number of outbound messages allowed.
       */
      maxMessageIdentifier:   65536,
      connectOptions:         null,
      hostIndex:              null,
      traceFunction:          null,
      _msg_queue:             null,
      _buffered_msg_queue:    null,
      _connectTimeout:        null,
      /* The sendPinger monitors how long we allow before we send data to prove to the server that we are alive. */
      sendPinger:             null,
      /* The receivePinger monitors how long we allow before we require evidence that the server is alive. */
      receivePinger:          null,
      _reconnectInterval:     1, // Reconnect Delay, starts at 1 second
      _reconnecting:          false,
      _reconnectTimeout:      null,
      disconnectedPublishing: false,
      disconnectedBufferSize: 5000,

      receiveBuffer: null,

      _traceBuffer:       null,
      _MAX_TRACE_ENTRIES: 100,
      storage:             new Storage(uri + ":" + clientId)
    });

    if(!("ArrayBuffer" in global && global.ArrayBuffer !== null)) {
      throw new Error(format(ERROR.UNSUPPORTED, ["ArrayBuffer"]));
    }
    this._trace("Paho.Client", uri, clientId);

    this.uri      = uri;
    this.clientId = clientId;
    this._uri     = null;

    // Create private instance-only message queue
    // Internal queue of messages to be sent, in sending order.
    this._msg_queue = [];
    this._buffered_msg_queue = [];

    // Messages we have sent and are expecting a response for, indexed by their respective message ids.
    this._sentMessages = {};

    // Messages we have received and acknowleged and are expecting a confirm message for
    // indexed by their respective message ids.
    this._receivedMessages = {};

    // Unique identifier for SEND messages, incrementing
    // counter as messages are sent.
    this._message_identifier = 1;

    // Used to determine the transmission sequence of stored sent messages.
    this._sequence = 0;

    // Load the local state, if any, from the saved version, only restore state relevant to this client.
    this.storage.entries().map(([key, value]) => this.restore(key, value));

    this.on("delivered", (message, ...args) => {
      message.emit("delivered", ...args);
    });
  }

  connect(connectOptions) {
    const connectOptionsMasked = _traceMask(connectOptions, "password");
    this._trace("Client.connect", connectOptionsMasked, this.socket, this.connected);

    if(this.connected) {
      throw new Error(format(ERROR.INVALID_STATE, ["already connected"]));
    }
    if(this.socket.isOpen()) {
      throw new Error(format(ERROR.INVALID_STATE, ["already connected"]));
    }

    if(this._reconnecting) {
      // connect() function is called while reconnect is in progress.
      // Terminate the auto reconnect process to use new connect options.
      global.clearTimeout(this._reconnectTimeout);
      this._reconnectTimeout = null;
      this._reconnecting = false;
    }

    this.connectOptions = connectOptions;
    this._reconnectInterval = 1;
    this._reconnecting = false;
    if(connectOptions.uris) {
      this.hostIndex = 0;
      this._doConnect(connectOptions.uris[0]);
    } else {
      this._doConnect(this.uri);
    }
  }

  subscribe(filter, subscribeOptions) {
    this._trace("Client.subscribe", filter, subscribeOptions);

    if(!this.connected) {
      throw new Error(format(ERROR.INVALID_STATE, ["not connected"]));
    }

    const wireMessage = new WireMessage(MESSAGE_TYPE.SUBSCRIBE),
          onDelivered = (returnCode) => {
            if(wireMessage.timeOut) {
              global.clearTimeout(wireMessage.timeOut);
            }
            if(returnCode[0] === 0x80) {
              subscribeOptions.onFailure && subscribeOptions.onFailure({
                invocationContext:  subscribeOptions.invocationContext,
                errorCode:          errorCode,
                errorMessage:       format(errorCode)
              });
            } else {
              subscribeOptions.onSuccess && subscribeOptions.onSuccess({
                invocationContext:  subscribeOptions.invocationContext,
                grantedQos:         returnCode
              });
            }
          };

    wireMessage.topics = filter.constructor === Array ? filter : [filter];
    if(subscribeOptions.qos === undefined) {
      subscribeOptions.qos = 0;
    }
    wireMessage.requestedQos = [];
    for(let i = 0; i < wireMessage.topics.length; i++) {
      wireMessage.requestedQos[i] = subscribeOptions.qos;
    }

    wireMessage.on("delivered", onDelivered);

    if(subscribeOptions.timeout) {
      wireMessage.timeOut = global.setTimeout(() => {
        wireMessage.removeListener("delivered", onDelivered);
        subscribeOptions.onFailure({
          invocationContext: subscribeOptions.invocationContext,
          errorCode:         ERROR.SUBSCRIBE_TIMEOUT.code,
          errorMessage:      format(ERROR.SUBSCRIBE_TIMEOUT)
        });
      }, (subscribeOptions.timeout || 30) * 1000);
    }

    // All subscriptions return a SUBACK.
    this._requiresAck(wireMessage);
    this._scheduleMessage(wireMessage);
  }

  /** @ignore */
  unsubscribe(filter, unsubscribeOptions) {
    this._trace("Client.unsubscribe", filter, unsubscribeOptions);

    if(!this.connected) {
      throw new Error(format(ERROR.INVALID_STATE, ["not connected"]));
    }

    const wireMessage = new WireMessage(MESSAGE_TYPE.UNSUBSCRIBE),
          onDelivered = () => {
            if(wireMessage.timeOut) {
              global.clearTimeout(wireMessage.timeOut);
            }
            unsubscribeOptions.onSuccess({
              invocationContext: unsubscribeOptions.invocationContext
          });
        };
    wireMessage.topics = filter.constructor === Array ? filter : [filter];

    wireMessage.on("delivered", onDelivered);

    if(unsubscribeOptions.timeout) {
      wireMessage.timeOut = global.setTimeout(() => {
        wireMessage.removeListener("delivered", onDelivered);
        unsubscribeOptions.onFailure({
          invocationContext: unsubscribeOptions.invocationContext,
          errorCode:         ERROR.UNSUBSCRIBE_TIMEOUT.code,
          errorMessage:      format(ERROR.UNSUBSCRIBE_TIMEOUT)
        })
      }, (unsubscribeOptions.timeout || 30) * 1000);
    }

    // All unsubscribes return a SUBACK.
    this._requiresAck(wireMessage);
    this._scheduleMessage(wireMessage);
  }

  send(message) {
    this._trace("Client.send", message);

    const wireMessage = new WireMessage(MESSAGE_TYPE.PUBLISH);
    wireMessage.payloadMessage = message;

    if(this.connected) {
      // Mark qos 1 & 2 message as "ACK required"
      // For qos 0 message, invoke onMessageDelivered callback if there is one.
      // Then schedule the message.
      if(message.qos > 0) {
        this._requiresAck(wireMessage);
      }
      this._scheduleMessage(wireMessage);
    } else {
      // Currently disconnected, will not schedule this message
      // Check if reconnecting is in progress and disconnected publish is enabled.
      if(this._reconnecting && this.disconnectedPublishing) {
        // Check the limit which include the "required ACK" messages
        const messageCount = Object.keys(this._sentMessages).length + this._buffered_msg_queue.length;
        if(messageCount > this.disconnectedBufferSize) {
          throw new Error(format(ERROR.BUFFER_FULL, [this.disconnectedBufferSize]));
        } else {
          if(message.qos > 0) {
            // Mark this message as "ACK required"
            this._requiresAck(wireMessage);
          } else {
            wireMessage.sequence = ++this._sequence;
            // Add messages in fifo order to array, by adding to start
            this._buffered_msg_queue.unshift(wireMessage);
          }
        }
      } else {
        throw new Error(format(ERROR.INVALID_STATE, ["not connected"]));
      }
    }
  }

  disconnect() {
    this._trace("Client.disconnect");

    if(this._reconnecting) {
      // disconnect() function is called while reconnect is in progress.
      // Terminate the auto reconnect process.
      global.clearTimeout(this._reconnectTimeout);
      this._reconnectTimeout = null;
      this._reconnecting = false;
    }

    if(!this.socket.isOpen()) {
      throw new Error(format(ERROR.INVALID_STATE, ["not connecting or connected"]));
    }

    const wireMessage = new WireMessage(MESSAGE_TYPE.DISCONNECT);

    // Run the disconnected call back as soon as the message has been sent,
    // in case of a failure later on in the disconnect processing.
    // as a consequence, the _disconected call back may be run several times.
    wireMessage.on("delivered", this._disconnected, this);

    this._scheduleMessage(wireMessage);
  }

  getTraceLog() {
    if(this._traceBuffer !== null) {
      this._trace("Client.getTraceLog", new Date());
      this._trace("Client.getTraceLog in flight messages", this._sentMessages.length);
      Object.entries(this._sentMessages).forEach(([key, value]) => this._trace("_sentMessages ", key, value));
      Object.entries(this._receivedMessages).forEach(([key, value]) => this._trace("_receivedMessages ", key, value));

      return this._traceBuffer;
    }
  }

  startTrace() {
    if(this._traceBuffer === null) {
      this._traceBuffer = [];
    }
    this._trace("Client.startTrace", new Date(), process.env.VERSION);
  }

  stopTrace() {
    delete this._traceBuffer;
  }

  _doConnect(url) {
    // When the socket is open, this client will send the CONNECT WireMessage using the saved parameters.
    if(this.connectOptions.useSSL) {
      const uriParts = url.split(":");
      if(uriParts[0] === "ws") {
        uriParts[0] += "s";
      } else if(uriParts[0] === "tcp") {
        uriParts[0] = "tls";
      }
      url = uriParts.join(":");
    }
    this._uri = url;
    this.connected = false;
    
    this.socket.on("open", this._onSocketOpen, this);
    this.socket.on("message", this._onSocketMessage, this);
    this.socket.on("error", this._onSocketError, this);
    this.socket.on("close", this._onSocketClose, this);

    this.sendPinger = new Pinger(this, this.connectOptions.keepAliveInterval);
    this.receivePinger = new Pinger(this, this.connectOptions.keepAliveInterval);

    this.socket.connect({
      url,
      mqttVersion:  this.connectOptions.mqttVersion,
    });

    if(this._connectTimeout) {
      global.clearTimeout(this._connectTimeout);
      this._connectTimeout = null;
    }
    this._connectTimeout = global.setTimeout(() => (
      this._disconnected(ERROR.CONNECT_TIMEOUT.code, format(ERROR.CONNECT_TIMEOUT))
    ), (this.connectOptions.timeout || 30) * 1000);
  }

  // Schedule a new message to be sent over the Sockets
  // connection. CONNECT messages cause Socket connection
  // to be started. All other messages are queued internally
  // until this has happened. When connection starts, process
  // all outstanding messages.
  _scheduleMessage(message) {
    // Add messages in fifo order to array, by adding to start
    this._msg_queue.unshift(message);
    // Process outstanding messages in the queue if we have an  open socket, and have received CONNACK.
    if(this.connected) {
      this._processQueue();
    }
  }

  store(prefix, wireMessage) {
    const storedMessage = {type: wireMessage.type, messageIdentifier: wireMessage.messageIdentifier, version: 1};

    switch (wireMessage.type) {
      case MESSAGE_TYPE.PUBLISH: {
        if(wireMessage.pubRecReceived) {
          storedMessage.pubRecReceived = true;
        }

        // Convert the payload to a hex string.
        storedMessage.payloadMessage = {};
        let hex = "";
        const messageBytes = wireMessage.payloadMessage.payloadBytes;
        for(let i = 0; i < messageBytes.length; i++) {
          if(messageBytes[i] <= 0xF) {
            hex = hex + "0" + messageBytes[i].toString(16);
          } else {
            hex = hex + messageBytes[i].toString(16);
          }
        }
        storedMessage.payloadMessage.payloadHex = hex;

        storedMessage.payloadMessage.qos = wireMessage.payloadMessage.qos;
        storedMessage.payloadMessage.destinationName = wireMessage.payloadMessage.destinationName;
        if(wireMessage.payloadMessage.duplicate) {
          storedMessage.payloadMessage.duplicate = true;
        }
        if(wireMessage.payloadMessage.retained) {
          storedMessage.payloadMessage.retained = true;
        }

        // Add a sequence number to sent messages.
        if(prefix.indexOf("Sent:") === 0) {
          if(wireMessage.sequence === undefined) {
            wireMessage.sequence = ++this._sequence;
          }
          storedMessage.sequence = wireMessage.sequence;
        }
        break;
      }
      default:
        throw Error(format(ERROR.INVALID_STORED_DATA, [prefix + wireMessage.messageIdentifier, storedMessage]));
    }
    this.storage.setItem(prefix, wireMessage.messageIdentifier, storedMessage);
  }

  restore(key, storedMessage) {
    const wireMessage = new WireMessage(storedMessage.type, storedMessage);

    switch (storedMessage.type) {
      case MESSAGE_TYPE.PUBLISH: {
        // Replace the payload message with a Message object.
        let hex = storedMessage.payloadMessage.payloadHex;
        const buffer = new ArrayBuffer((hex.length) / 2);
        const byteStream = new Uint8Array(buffer);
        let i = 0;
        while(hex.length >= 2) {
          const x = parseInt(hex.substring(0, 2), 16);
          hex = hex.substring(2, hex.length);
          byteStream[i++] = x;
        }
        const payloadMessage = new Message(byteStream);

        payloadMessage.qos = storedMessage.payloadMessage.qos;
        payloadMessage.destinationName = storedMessage.payloadMessage.destinationName;
        if(storedMessage.payloadMessage.duplicate) {
          payloadMessage.duplicate = true;
        }
        if(storedMessage.payloadMessage.retained) {
          payloadMessage.retained = true;
        }
        wireMessage.payloadMessage = payloadMessage;

        break;
      }
      default:
        throw Error(format(ERROR.INVALID_STORED_DATA, [JSON.stringify(storedMessage)]));
    }

    if(key === "Sent:") {
      wireMessage.payloadMessage.duplicate = true;
      this._sentMessages[wireMessage.messageIdentifier] = wireMessage;
    } else if(key === "Received:") {
      this._receivedMessages[wireMessage.messageIdentifier] = wireMessage;
    }
  }

  _processQueue() {
    let wireMessage = null;

    // Send all queued messages down socket connection
    while((wireMessage = this._msg_queue.pop())) {
      this._socketSend(wireMessage);
      if(wireMessage.type === MESSAGE_TYPE.PUBLISH) {
        if(wireMessage.payloadMessage.qos === 0) {
          // Notify listeners that message was successfully sent
          // otherwise, _handleMessage will notify about delivery
          this.emit("delivered", wireMessage);
        }
      } else if(!this._sentMessages[wireMessage.messageIdentifier]) {
        this.emit("delivered", wireMessage);
      }
    }
  }

  /**
   * Expect an ACK response for this message. Add message to the set of in progress
   * messages and set an unused identifier in this message.
   * @ignore
   */
  _requiresAck(wireMessage) {
    const messageCount = Object.keys(this._sentMessages).length;
    if(messageCount > this.maxMessageIdentifier) {
      throw Error("Too many messages:" + messageCount);
    }

    while(this._sentMessages[this._message_identifier] !== undefined) {
      this._message_identifier++;
    }
    wireMessage.messageIdentifier = this._message_identifier;
    this._sentMessages[wireMessage.messageIdentifier] = wireMessage;
    if(wireMessage.type === MESSAGE_TYPE.PUBLISH) {
      this.store("Sent:", wireMessage);
    }
    if(this._message_identifier === this.maxMessageIdentifier) {
      this._message_identifier = 1;
    }
  }

  /**
   * Called when the underlying Socket has been opened.
   * @ignore
   */
  _onSocketOpen() {
    // Create the CONNECT message object.
    const wireMessage = new WireMessage(MESSAGE_TYPE.CONNECT, this.connectOptions);
    wireMessage.clientId = this.clientId;
    this._socketSend(wireMessage);
  }

  /**
   * Called when the underlying Socket has received a complete packet.
   * @ignore
   */
  _onSocketMessage(event) {
    this._trace("Client._onSocketMessage", event.data);
    const messages = this._deframeMessages(event.data);
    for(let i = 0; i < messages.length; i += 1) {
      this._handleMessage(messages[i]);
    }
  }

  _deframeMessages(data) {
    let byteArray = new Uint8Array(data);
    const messages = [];
    if(this.receiveBuffer) {
      const newData = new Uint8Array(this.receiveBuffer.length + byteArray.length);
      newData.set(this.receiveBuffer);
      newData.set(byteArray, this.receiveBuffer.length);
      byteArray = newData;
      delete this.receiveBuffer;
    }
    try {
      let offset = 0;
      while(offset < byteArray.length) {
        const result = decodeMessage(byteArray, offset);
        const wireMessage = result[0];
        offset = result[1];
        if(wireMessage !== null) {
          messages.push(wireMessage);
        } else {
          break;
        }
      }
      if(offset < byteArray.length) {
        this.receiveBuffer = byteArray.subarray(offset);
      }
    } catch (error) {
      const errorStack = ((error.hasOwnProperty("stack") == "undefined") ? error.stack.toString() : "No Error Stack Available");
      this._disconnected(ERROR.INTERNAL_ERROR.code, format(ERROR.INTERNAL_ERROR, [error.message, errorStack]));
      return;
    }
    return messages;
  }

  _handleMessage(wireMessage) {
    this._trace("Client._handleMessage", wireMessage);

    try {
      switch (wireMessage.type) {
        case MESSAGE_TYPE.CONNACK: {
          global.clearTimeout(this._connectTimeout);
          if(this._reconnectTimeout) {
            global.clearTimeout(this._reconnectTimeout);
          }

          // If we have started using clean session then clear up the local state.
          if(this.connectOptions.cleanSession) {
            Object.values(this._sentMessages).forEach((sentMessage) => (
              this.storage.removeItem("Sent:", sentMessage.messageIdentifier)
            ));
            this._sentMessages = {};
            Object.values(this._receivedMessages).forEach((receivedMessage) => (
              this.storage.removeItem("Received:", receivedMessage.messageIdentifier)
            ));
            this._receivedMessages = {};
          }
          // Client connected and ready for business.
          if(wireMessage.returnCode === 0) {
            this.connected = true;
            // Jump to the end of the list of uris and stop looking for a good host.

            if(this.connectOptions.uris) {
              this.hostIndex = this.connectOptions.uris.length;
            }
          } else {
            this._disconnected(ERROR.CONNACK_RETURNCODE.code, format(ERROR.CONNACK_RETURNCODE, [wireMessage.returnCode, CONNACK_RC[wireMessage.returnCode]]));
            break;
          }

          // Resend messages.
          let sequencedMessages = [];
          for(const msgId in this._sentMessages) {
            if(this._sentMessages.hasOwnProperty(msgId)) {
              sequencedMessages.push(this._sentMessages[msgId]);
            }
          }

          // Also schedule qos 0 buffered messages if any
          if(this._buffered_msg_queue.length > 0) {
            let msg = null;
            while((msg = this._buffered_msg_queue.pop())) {
              sequencedMessages.push(msg);
            }
          }

          // Sort sentMessages into the original sent order.
          sequencedMessages = sequencedMessages.sort(function(a, b) {
            return a.sequence - b.sequence;
          });
          for(let i = 0, len = sequencedMessages.length; i < len; i++) {
            const sentMessage = sequencedMessages[i];
            if(sentMessage.type == MESSAGE_TYPE.PUBLISH && sentMessage.pubRecReceived) {
              const pubRelMessage = new WireMessage(MESSAGE_TYPE.PUBREL, {
                messageIdentifier: sentMessage.messageIdentifier
              });
              this._scheduleMessage(pubRelMessage);
            } else {
              this._scheduleMessage(sentMessage);
            }
          }

          let reconnected = false;
          if(this._reconnecting) {
            reconnected = true;
            this._reconnectInterval = 1;
            this._reconnecting = false;
          }

          // Fire the connected event.
          this.emit("connected", reconnected, this._uri);

          // Process all queued messages now that the connection is established.
          this._processQueue();
          break;
        }
        case MESSAGE_TYPE.PUBLISH:
          this._receivePublish(wireMessage);
          break;

        case MESSAGE_TYPE.PUBACK: {
          const sentMessage = this._sentMessages[wireMessage.messageIdentifier];
          // If this is a re flow of a PUBACK after we have restarted receivedMessage will not exist.
          if(sentMessage) {
            delete this._sentMessages[wireMessage.messageIdentifier];
            this.storage.removeItem("Sent:", wireMessage.messageIdentifier);
            this.emit("delivered", sentMessage);
          }
          break;
        }
        case MESSAGE_TYPE.PUBREC: {
          const sentMessage = this._sentMessages[wireMessage.messageIdentifier];
          // If this is a re flow of a PUBREC after we have restarted receivedMessage will not exist.
          if(sentMessage) {
            sentMessage.pubRecReceived = true;
            const pubRelMessage = new WireMessage(MESSAGE_TYPE.PUBREL, {
              messageIdentifier: wireMessage.messageIdentifier
            });
            this.store("Sent:", sentMessage);
            this._scheduleMessage(pubRelMessage);
          }
          break;
        }
        case MESSAGE_TYPE.PUBREL: {
          const receivedMessage = this._receivedMessages[wireMessage.messageIdentifier];
          this.storage.removeItem("Received:", wireMessage.messageIdentifier);
          // If this is a re flow of a PUBREL after we have restarted receivedMessage will not exist.
          if(receivedMessage) {
            this.emit("arrived", receivedMessage);
            delete this._receivedMessages[wireMessage.messageIdentifier];
          }
          // Always flow PubComp, we may have previously flowed PubComp but the server lost it and restarted.
          const pubCompMessage = new WireMessage(MESSAGE_TYPE.PUBCOMP, {
            messageIdentifier: wireMessage.messageIdentifier
          });
          this._scheduleMessage(pubCompMessage);

          break;
        }
        case MESSAGE_TYPE.PUBCOMP: {
          const sentMessage = this._sentMessages[wireMessage.messageIdentifier];
          delete this._sentMessages[wireMessage.messageIdentifier];
          this.storage.removeItem("Sent:", wireMessage.messageIdentifier);
          this.emit("delivered", sentMessage);
          break;
        }
        case MESSAGE_TYPE.SUBACK:
        case MESSAGE_TYPE.UNSUBACK: {
          const sentMessage = this._sentMessages[wireMessage.messageIdentifier];
          if(sentMessage) {
            // This will need to be fixed when we add multiple topic support
            this.emit("delivered", sentMessage, wireMessage.returnCode);
            delete this._sentMessages[wireMessage.messageIdentifier];
          }
          break;
        }
        case MESSAGE_TYPE.PINGRESP:
          /* The sendPinger or receivePinger may have sent a ping, the receivePinger has already been reset. */
          this.sendPinger.reset();
          break;

        case MESSAGE_TYPE.DISCONNECT:
          // Clients do not expect to receive disconnect packets.
          this._disconnected(ERROR.INVALID_MQTT_MESSAGE_TYPE.code, format(ERROR.INVALID_MQTT_MESSAGE_TYPE, [wireMessage.type]));
          break;

        default:
          this._disconnected(ERROR.INVALID_MQTT_MESSAGE_TYPE.code, format(ERROR.INVALID_MQTT_MESSAGE_TYPE, [wireMessage.type]));
      }
    } catch (error) {
      const errorStack = ((error.hasOwnProperty("stack") == "undefined") ? error.stack.toString() : "No Error Stack Available");
      this._disconnected(ERROR.INTERNAL_ERROR.code, format(ERROR.INTERNAL_ERROR, [error.message, errorStack]));
    }
  }

  /** @ignore */
  _onSocketError(error) {
    if(!this._reconnecting) {
      this._disconnected(ERROR.SOCKET_ERROR.code, format(ERROR.SOCKET_ERROR, [error.data.message || error.data]));
    }
  }

  /** @ignore */
  _onSocketClose() {
    if(!this._reconnecting) {
      this._disconnected(ERROR.SOCKET_CLOSE.code, format(ERROR.SOCKET_CLOSE));
    }
  }

  /** @ignore */
  _socketSend(wireMessage) {
    if(wireMessage.type == 1) {
      const wireMessageMasked = _traceMask(wireMessage, "password");
      this._trace("Client._socketSend", wireMessageMasked);
    } else this._trace("Client._socketSend", wireMessage);

    this.socket.send(wireMessage.encode());
    /* We have proved to the server we are alive. */
    this.sendPinger.reset();
  }

  /** @ignore */
  _receivePublish(wireMessage) {
    switch (wireMessage.payloadMessage.qos) {
      case "undefined":
      case 0:
        this.emit("arrived", wireMessage);
        break;

      case 1: {
        const pubAckMessage = new WireMessage(MESSAGE_TYPE.PUBACK, {messageIdentifier: wireMessage.messageIdentifier});
        this._scheduleMessage(pubAckMessage);
        this.emit("arrived", wireMessage);
        break;
      }
      case 2: {
        this._receivedMessages[wireMessage.messageIdentifier] = wireMessage;
        this.store("Received:", wireMessage);
        const pubRecMessage = new WireMessage(MESSAGE_TYPE.PUBREC, {messageIdentifier: wireMessage.messageIdentifier});
        this._scheduleMessage(pubRecMessage);

        break;
      }
      default:
        throw Error("Invaild qos=" + wireMessage.payloadMessage.qos);
    }
  }

  /**
   * Attempts to reconnect the client to the server.
   * For each reconnect attempt, will double the reconnect interval
   * up to 128 seconds.
   */
  _reconnect() {
    this._trace("Client._reconnect");
    if(!this.connected) {
      this._reconnecting = true;
      this.sendPinger.cancel();
      this.receivePinger.cancel();
      if(this._reconnectInterval < 128) {
        this._reconnectInterval = this._reconnectInterval * 2;
      }
      if(this.connectOptions.uris) {
        this.hostIndex = 0;
        this._doConnect(this.connectOptions.uris[0]);
      } else {
        this._doConnect(this.uri);
      }
    }
  }

  /**
   * Client has disconnected either at its own request or because the server
   * or network disconnected it. Remove all non-durable state.
   * @param {errorCode} [number] the error number.
   * @param {errorText} [string] the error text.
   * @ignore
   */
  _disconnected(errorCode, errorText) {
    this._trace("Client._disconnected", errorCode, errorText);

    if(errorCode !== undefined && this._reconnecting) {
      // Continue automatic reconnect process
      this._reconnectTimeout = global.setTimeout(() => this._reconnect(), this._reconnectInterval * 1000);
      return;
    }

    this.sendPinger.cancel();
    this.receivePinger.cancel();
    if(this._connectTimeout) {
      global.clearTimeout(this._connectTimeout);
      this._connectTimeout = null;
    }

    // Clear message buffers.
    this._msg_queue = [];
    this._buffered_msg_queue = [];

    this.socket.removeListener("open", this._onSocketOpen, this);
    this.socket.removeListener("message", this._onSocketMessage, this);
    this.socket.removeListener("error", this._onSocketError, this);
    this.socket.removeListener("close", this._onSocketClose, this);
    this.socket.close();

    if(this.connectOptions.uris && this.hostIndex < this.connectOptions.uris.length - 1) {
      // Try the next host.
      this.hostIndex++;
      this._doConnect(this.connectOptions.uris[this.hostIndex]);
      return;
    }
    
    if(errorCode === undefined) {
      errorCode = ERROR.OK.code;
      errorText = format(ERROR.OK);
    }

    // Run any application callbacks last as they may attempt to reconnect and hence create a new socket.
    if(this.connected) {
      this.connected = false;
      // Execute the connectionLostCallback if there is one, and we were connected.
      this.emit("connectionLost", {
        errorCode:    errorCode,
        errorMessage: errorText,
        reconnect:    this.connectOptions.reconnect,
        uri:          this._uri
      });
      if(errorCode !== ERROR.OK.code && this.connectOptions.reconnect) {
        // Start automatic reconnect process for the very first time since last successful connect.
        this._reconnectInterval = 1;
        this._reconnect();
      }
    } else {
      // Otherwise we never had a connection, so indicate that the connect has failed.
      if(this.connectOptions.mqttVersion === 4 && this.connectOptions.mqttVersionExplicit === false) {
        this._trace("Failed to connect V4, dropping back to V3");
        this.connectOptions.mqttVersion = 3;
        if(this.connectOptions.uris) {
          this.hostIndex = 0;
          this._doConnect(this.connectOptions.uris[0]);
        } else {
          this._doConnect(this.uri);
        }
      } else {
        this.emit("error", {
          errorCode:          errorCode,
          errorMessage:       errorText
        });
      }
    }
  }

  /** @ignore */
  _trace() {
    // Pass trace message back to client's callback function
    if(this.traceFunction) {
      for(const i in arguments) {
        if(typeof arguments[i] !== "undefined") {
          arguments.splice(i, 1, JSON.stringify(arguments[i]));
        }
      }
      const record = Array.prototype.slice.call(arguments).join("");
      this.traceFunction({severity: "Debug", message: record	});
    }

    // buffer style trace
    if(this._traceBuffer !== null) {
      for(let i = 0, max = arguments.length; i < max; i++) {
        if(this._traceBuffer.length == this._MAX_TRACE_ENTRIES) {
          this._traceBuffer.shift();
        }
        if(i === 0) this._traceBuffer.push(arguments[i]);
        else if(typeof arguments[i] === "undefined") this._traceBuffer.push(arguments[i]);
        else this._traceBuffer.push("  " + JSON.stringify(arguments[i]));
      }
    }
  }
}
