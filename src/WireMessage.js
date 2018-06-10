import { MESSAGE_TYPE, UTF8Length, stringToUTF8 } from "./definitions";
import EventEmitter from "eventemitter3";

/**
 * Encodes an MQTT Multi-Byte Integer
 * @private
 */
function encodeMBI(number) {
  const output = new Array(1);
  let numBytes = 0;

  do {
    let digit = number % 128;
    number = number >> 7;
    if(number > 0) {
      digit |= 0x80;
    }
    output[numBytes++] = digit;
  } while((number > 0) && (numBytes < 4));

  return output;
}

// MQTT protocol and version          6    M    Q    I    s    d    p    3
const MqttProtoIdentifierv3 = [0x00, 0x06, 0x4d, 0x51, 0x49, 0x73, 0x64, 0x70, 0x03];
// MQTT proto/version for 311         4    M    Q    T    T    4
const MqttProtoIdentifierv4 = [0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, 0x04];

function writeString(input, utf8Length, buffer, offset) {
  offset = writeUint16(utf8Length, buffer, offset);
  stringToUTF8(input, buffer, offset);
  return offset + utf8Length;
}

function writeUint16(input, buffer, offset) {
  buffer[offset++] = input >> 8;      // MSB
  buffer[offset++] = input % 256;     // LSB
  return offset;
}

/**
* Construct an MQTT wire protocol message.
* @param type MQTT packet type.
* @param options optional wire message attributes.
*
* Optional properties
*
* messageIdentifier: message ID in the range [0..65535]
* payloadMessage:	Application Message - PUBLISH only
* connectStrings:	array of 0 or more Strings to be put into the CONNECT payload
* topics:			array of strings (SUBSCRIBE, UNSUBSCRIBE)
* requestQoS:		array of QoS values [0..2]
*
* "Flag" properties
* cleanSession:	true if present / false if absent (CONNECT)
* willMessage:  	true if present / false if absent (CONNECT)
* isRetained:		true if present / false if absent (CONNECT)
* userName:		true if present / false if absent (CONNECT)
* password:		true if present / false if absent (CONNECT)
* keepAliveInterval:	integer [0..65535]  (CONNECT)
*
* @private
* @ignore
*/
export default class extends EventEmitter {
  constructor(type, options) {
    super();
    this.type = type;
    for(const name in options) {
      if(options.hasOwnProperty(name)) {
        this[name] = options[name];
      }
    }
  }

  encode() {
    // Compute the first byte of the fixed header
    let first = ((this.type & 0x0f) << 4);

    /*
     * Now calculate the length of the variable header + payload by adding up the lengths
     * of all the component parts
     */

    const topicStrLength = [];
    let destinationNameLength = 0,
        remLength = 0,
        willMessagePayloadBytes;

    // if the message contains a messageIdentifier then we need two bytes for that
    if(this.messageIdentifier !== undefined) {
      remLength += 2;
    }

    switch (this.type) {
      // If this a Connect then we need to include 12 bytes for its header
      case MESSAGE_TYPE.CONNECT:
        switch (this.mqttVersion) {
          case 3:
            remLength += MqttProtoIdentifierv3.length + 3;
            break;
          case 4:
            remLength += MqttProtoIdentifierv4.length + 3;
            break;
        }

        remLength += UTF8Length(this.clientId) + 2;
        if(this.willMessage !== undefined) {
          remLength += UTF8Length(this.willMessage.destinationName) + 2;
          // Will message is always a string, sent as UTF-8 characters with a preceding length.
          willMessagePayloadBytes = this.willMessage.payloadBytes;
          if(!(willMessagePayloadBytes instanceof Uint8Array)) {
            willMessagePayloadBytes = new Uint8Array(willMessagePayloadBytes);
          }
          remLength += willMessagePayloadBytes.byteLength + 2;
        }
        if(this.userName !== undefined) {
          remLength += UTF8Length(this.userName) + 2;
        }
        if(this.password !== undefined) {
          remLength += UTF8Length(this.password) + 2;
        }
        break;

      // Subscribe, Unsubscribe can both contain topic strings
      case MESSAGE_TYPE.SUBSCRIBE: {
        first |= 0x02; // Qos = 1;
        for(let i = 0; i < this.topics.length; i++) {
          topicStrLength[i] = UTF8Length(this.topics[i]);
          remLength += topicStrLength[i] + 2;
        }
        remLength += this.requestedQos.length; // 1 byte for each topic's Qos
        // QoS on Subscribe only
        break;
      }
      case MESSAGE_TYPE.UNSUBSCRIBE: {
        first |= 0x02; // Qos = 1;
        for(let i = 0; i < this.topics.length; i++) {
          topicStrLength[i] = UTF8Length(this.topics[i]);
          remLength += topicStrLength[i] + 2;
        }
        break;
      }
      case MESSAGE_TYPE.PUBREL:
        first |= 0x02; // Qos = 1;
        break;

      case MESSAGE_TYPE.PUBLISH: {
        if(this.payloadMessage.duplicate) first |= 0x08;
        first  = first |= (this.payloadMessage.qos << 1);
        if(this.payloadMessage.retained) first |= 0x01;
        destinationNameLength = UTF8Length(this.payloadMessage.destinationName);
        remLength += destinationNameLength + 2;
        let payloadBytes = this.payloadMessage.payloadBytes;
        remLength += payloadBytes.byteLength;
        if(payloadBytes instanceof ArrayBuffer) {
          payloadBytes = new Uint8Array(payloadBytes);
        } else if(!(payloadBytes instanceof Uint8Array)) {
          payloadBytes = new Uint8Array(payloadBytes.buffer);
        }
        break;
      }

      case MESSAGE_TYPE.DISCONNECT:
        break;

      default:
        break;
    }

    // Now we can allocate a buffer for the message

    const mbi = encodeMBI(remLength);  // Convert the length to MQTT MBI format
    let pos = mbi.length + 1;        // Offset of start of variable header
    const buffer = new ArrayBuffer(remLength + pos);
    const byteStream = new Uint8Array(buffer);    // view it as a sequence of bytes

    // Write the fixed header into the buffer
    byteStream[0] = first;
    byteStream.set(mbi, 1);

    // If this is a PUBLISH then the variable header starts with a topic
    if(this.type == MESSAGE_TYPE.PUBLISH) {
      pos = writeString(this.payloadMessage.destinationName, destinationNameLength, byteStream, pos);
    }
    // If this is a CONNECT then the variable header contains the protocol name/version, flags and keepalive time

    else if(this.type == MESSAGE_TYPE.CONNECT) {
      switch (this.mqttVersion) {
        case 3:
          byteStream.set(MqttProtoIdentifierv3, pos);
          pos += MqttProtoIdentifierv3.length;
          break;
        case 4:
          byteStream.set(MqttProtoIdentifierv4, pos);
          pos += MqttProtoIdentifierv4.length;
          break;
      }
      let connectFlags = 0;
      if(this.cleanSession) {
        connectFlags = 0x02;
      }
      if(this.willMessage !== undefined) {
        connectFlags |= 0x04;
        connectFlags |= (this.willMessage.qos << 3);
        if(this.willMessage.retained) {
          connectFlags |= 0x20;
        }
      }
      if(this.userName !== undefined) {
        connectFlags |= 0x80;
      }
      if(this.password !== undefined) {
        connectFlags |= 0x40;
      }
      byteStream[pos++] = connectFlags;
      pos = writeUint16(this.keepAliveInterval, byteStream, pos);
    }

    // Output the messageIdentifier - if there is one
    if(this.messageIdentifier !== undefined) {
      pos = writeUint16(this.messageIdentifier, byteStream, pos);
    }

    switch (this.type) {
      case MESSAGE_TYPE.CONNECT:
        pos = writeString(this.clientId, UTF8Length(this.clientId), byteStream, pos);
        if(this.willMessage !== undefined) {
          pos = writeString(this.willMessage.destinationName, UTF8Length(this.willMessage.destinationName), byteStream, pos);
          pos = writeUint16(willMessagePayloadBytes.byteLength, byteStream, pos);
          byteStream.set(willMessagePayloadBytes, pos);
          pos += willMessagePayloadBytes.byteLength;
        }
        if(this.userName !== undefined) {
          pos = writeString(this.userName, UTF8Length(this.userName), byteStream, pos);
        }
        if(this.password !== undefined) {
          pos = writeString(this.password, UTF8Length(this.password), byteStream, pos);
        }
        break;

      case MESSAGE_TYPE.PUBLISH:
        // PUBLISH has a text or binary payload, if text do not add a 2 byte length field, just the UTF characters.
        byteStream.set(this.payloadMessage.payloadBytes, pos);

        break;

      // case MESSAGE_TYPE.PUBREC:
      // case MESSAGE_TYPE.PUBREL:
      // case MESSAGE_TYPE.PUBCOMP:
      // break;

      case MESSAGE_TYPE.SUBSCRIBE: {
        // SUBSCRIBE has a list of topic strings and request QoS
        for(let i = 0; i < this.topics.length; i++) {
          pos = writeString(this.topics[i], topicStrLength[i], byteStream, pos);
          byteStream[pos++] = this.requestedQos[i];
        }
        break;
      }
      case MESSAGE_TYPE.UNSUBSCRIBE: {
        // UNSUBSCRIBE has a list of topic strings
        for(let i = 0; i < this.topics.length; i++) {
          pos = writeString(this.topics[i], topicStrLength[i], byteStream, pos);
        }
        break;
      }
      default:
        // Do nothing.
    }

    return buffer;
  }
}
