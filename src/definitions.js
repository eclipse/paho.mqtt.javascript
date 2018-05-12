/**
 * Unique message type identifiers, with associated
 * associated integer values.
 * @private
 */
const ERROR = {
  OK:                        {code: 0, text: "AMQJSC0000I OK."},
  CONNECT_TIMEOUT:           {code: 1, text: "AMQJSC0001E Connect timed out."},
  SUBSCRIBE_TIMEOUT:         {code: 2, text: "AMQJS0002E Subscribe timed out."},
  UNSUBSCRIBE_TIMEOUT:       {code: 3, text: "AMQJS0003E Unsubscribe timed out."},
  PING_TIMEOUT:              {code: 4, text: "AMQJS0004E Ping timed out."},
  INTERNAL_ERROR:            {code: 5, text: "AMQJS0005E Internal error. Error Message: {0}, Stack trace: {1}"},
  CONNACK_RETURNCODE:        {code: 6, text: "AMQJS0006E Bad Connack return code:{0} {1}."},
  SOCKET_ERROR:              {code: 7, text: "AMQJS0007E Socket error:{0}."},
  SOCKET_CLOSE:              {code: 8, text: "AMQJS0008I Socket closed."},
  MALFORMED_UTF:             {code: 9, text: "AMQJS0009E Malformed UTF data:{0} {1} {2}."},
  UNSUPPORTED:               {code: 10, text: "AMQJS0010E {0} is not supported by this browser."},
  INVALID_STATE:             {code: 11, text: "AMQJS0011E Invalid state {0}."},
  INVALID_TYPE:              {code: 12, text: "AMQJS0012E Invalid type {0} for {1}."},
  INVALID_ARGUMENT:          {code: 13, text: "AMQJS0013E Invalid argument {0} for {1}."},
  UNSUPPORTED_OPERATION:     {code: 14, text: "AMQJS0014E Unsupported operation."},
  INVALID_STORED_DATA:       {code: 15, text: "AMQJS0015E Invalid data in local storage key={0} value={1}."},
  INVALID_MQTT_MESSAGE_TYPE: {code: 16, text: "AMQJS0016E Invalid MQTT message type {0}."},
  MALFORMED_UNICODE:         {code: 17, text: "AMQJS0017E Malformed Unicode string:{0} {1}."},
  BUFFER_FULL:               {code: 18, text: "AMQJS0018E Message buffer is full, maximum buffer size: {0}."}
};

/**
* Unique message type identifiers, with associated
* associated integer values.
* @private
*/
const MESSAGE_TYPE = {
  CONNECT:     1,
  CONNACK:     2,
  PUBLISH:     3,
  PUBACK:      4,
  PUBREC:      5,
  PUBREL:      6,
  PUBCOMP:     7,
  SUBSCRIBE:   8,
  SUBACK:      9,
  UNSUBSCRIBE: 10,
  UNSUBACK:    11,
  PINGREQ:     12,
  PINGRESP:    13,
  DISCONNECT:  14
};

/**
* Format an error message text.
* @private
* @param {error} ERROR value above.
* @param {substitutions} [array] substituted into the text.
* @return the text with the substitutions made.
*/
const format = function(error, substitutions) {
  let text = error.text;
  if(substitutions) {
    let field,
        start;
    for(let i = 0; i < substitutions.length; i++) {
      field = "{" + i + "}";
      start = text.indexOf(field);
      if(start > 0) {
        const part1 = text.substring(0, start);
        const part2 = text.substring(start + field.length);
        text = part1 + substitutions[i] + part2;
      }
    }
  }
  return text;
};

/**
* Takes a String and writes it into an array as UTF8 encoded bytes.
* @private
*/
function stringToUTF8(input, output, start) {
  let pos = start;
  for(let i = 0; i < input.length; i++) {
    let charCode = input.charCodeAt(i);

    // Check for a surrogate pair.
    if(charCode >= 0xD800 && charCode <= 0xDBFF) {
      const lowCharCode = input.charCodeAt(++i);
      if(isNaN(lowCharCode)) {
        throw new Error(format(ERROR.MALFORMED_UNICODE, [charCode, lowCharCode]));
      }
      charCode = ((charCode - 0xD800) << 10) + (lowCharCode - 0xDC00) + 0x10000;
    }

    if(charCode <= 0x7F) {
      output[pos++] = charCode;
    } else if(charCode <= 0x7FF) {
      output[pos++] = charCode >> 6  & 0x1F | 0xC0;
      output[pos++] = charCode     & 0x3F | 0x80;
    } else if(charCode <= 0xFFFF) {
      output[pos++] = charCode >> 12 & 0x0F | 0xE0;
      output[pos++] = charCode >> 6  & 0x3F | 0x80;
      output[pos++] = charCode     & 0x3F | 0x80;
    } else {
      output[pos++] = charCode >> 18 & 0x07 | 0xF0;
      output[pos++] = charCode >> 12 & 0x3F | 0x80;
      output[pos++] = charCode >> 6  & 0x3F | 0x80;
      output[pos++] = charCode     & 0x3F | 0x80;
    }
  }
  return output;
}

function parseUTF8(input, offset, length) {
  let output = "";
  let utf16;
  let pos = offset;

  while(pos < offset + length) {
    const byte1 = input[pos++];
    if(byte1 < 128) {
      utf16 = byte1;
    } else {
      const byte2 = input[pos++] - 128;
      if(byte2 < 0) {
        throw new Error(format(ERROR.MALFORMED_UTF, [byte1.toString(16), byte2.toString(16), ""]));
      }
      if(byte1 < 0xE0)             // 2 byte character
      {
        utf16 = 64 * (byte1 - 0xC0) + byte2;
      } else {
        const byte3 = input[pos++] - 128;
        if(byte3 < 0) {
          throw new Error(format(ERROR.MALFORMED_UTF, [byte1.toString(16), byte2.toString(16), byte3.toString(16)]));
        }
        if(byte1 < 0xF0)        // 3 byte character
        {
          utf16 = 4096 * (byte1 - 0xE0) + 64 * byte2 + byte3;
        } else {
          const byte4 = input[pos++] - 128;
          if(byte4 < 0) {
            throw new Error(format(ERROR.MALFORMED_UTF, [byte1.toString(16), byte2.toString(16), byte3.toString(16), byte4.toString(16)]));
          }
          if(byte1 < 0xF8)        // 4 byte character
          {
            utf16 = 262144 * (byte1 - 0xF0) + 4096 * byte2 + 64 * byte3 + byte4;
          } else                     // longer encodings are not supported
          {
            throw new Error(format(ERROR.MALFORMED_UTF, [byte1.toString(16), byte2.toString(16), byte3.toString(16), byte4.toString(16)]));
          }
        }
      }
    }

    if(utf16 > 0xFFFF)   // 4 byte character - express as a surrogate pair
    {
      utf16 -= 0x10000;
      output += String.fromCharCode(0xD800 + (utf16 >> 10)); // lead character
      utf16 = 0xDC00 + (utf16 & 0x3FF);  // trail character
    }
    output += String.fromCharCode(utf16);
  }
  return output;
}

/**
* Takes a String and calculates its length in bytes when encoded in UTF8.
* @private
*/
function UTF8Length(input) {
  let output = 0;
  for(let i = 0; i < input.length; i++) {
    const charCode = input.charCodeAt(i);
    if(charCode > 0x7FF) {
      // Surrogate pair means its a 4 byte character
      if(charCode >= 0xD800 && charCode <= 0xDBFF) {
        i++;
        output++;
      }
      output += 3;
    } else if(charCode > 0x7F) {
      output += 2;
    } else {
      output++;
    }
  }
  return output;
}

module.exports = {
  ERROR,
  MESSAGE_TYPE,
  format,
  stringToUTF8,
  UTF8Length,
  parseUTF8
};
