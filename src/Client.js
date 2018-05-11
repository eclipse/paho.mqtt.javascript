// ------------------------------------------------------------------------
// Public Programming interface.
// ------------------------------------------------------------------------

/**
* The JavaScript application communicates to the server using a {@link Paho.Client} object.
* <p>
* Most applications will create just one Client object and then call its connect() method,
* however applications can create more than one Client object if they wish.
* In this case the combination of host, port and clientId attributes must be different for each Client object.
* <p>
* The send, subscribe and unsubscribe methods are implemented as asynchronous JavaScript methods
* (even though the underlying protocol exchange might be synchronous in nature).
* This means they signal their completion by calling back to the application,
* via Success or Failure callback functions provided by the application on the method in question.
* Such callbacks are called at most once per method invocation and do not persist beyond the lifetime
* of the script that made the invocation.
* <p>
* In contrast there are some callback functions, most notably <i>onMessageArrived</i>,
* that are defined on the {@link Paho.Client} object.
* These may get called multiple times, and aren't directly related to specific method invocations made by the client.
*
* @name Paho.Client
*
* @constructor
*
* @param {string} host - the address of the messaging server, as a fully qualified WebSocket URI, as a DNS name or dotted decimal IP address.
* @param {number} port - the port number to connect to - only required if host is not a URI
* @param {string} path - the path on the host to connect to - only used if host is not a URI. Default: '/mqtt'.
* @param {string} clientId - the Messaging client identifier, between 1 and 23 characters in length.
*
* @property {string} host - <i>read only</i> the server's DNS hostname or dotted decimal IP address.
* @property {number} port - <i>read only</i> the server's port.
* @property {string} path - <i>read only</i> the server's path.
* @property {string} clientId - <i>read only</i> used when connecting to the server.
* @property {function} onConnectionLost - called when a connection has been lost.
*                            after a connect() method has succeeded.
*                            Establish the call back used when a connection has been lost. The connection may be
*                            lost because the client initiates a disconnect or because the server or network
*                            cause the client to be disconnected. The disconnect call back may be called without
*                            the connectionComplete call back being invoked if, for example the client fails to
*                            connect.
*                            A single response object parameter is passed to the onConnectionLost callback containing the following fields:
*                            <ol>
*                            <li>errorCode
*                            <li>errorMessage
*                            </ol>
* @property {function} onMessageDelivered - called when a message has been delivered.
*                            All processing that this Client will ever do has been completed. So, for example,
*                            in the case of a Qos=2 message sent by this client, the PubComp flow has been received from the server
*                            and the message has been removed from persistent storage before this callback is invoked.
*                            Parameters passed to the onMessageDelivered callback are:
*                            <ol>
*                            <li>{@link Paho.Message} that was delivered.
*                            </ol>
* @property {function} onMessageArrived - called when a message has arrived in this Paho.client.
*                            Parameters passed to the onMessageArrived callback are:
*                            <ol>
*                            <li>{@link Paho.Message} that has arrived.
*                            </ol>
* @property {function} onConnected - called when a connection is successfully made to the server.
*                                  after a connect() method.
*                                  Parameters passed to the onConnected callback are:
*                                  <ol>
*                                  <li>reconnect (boolean) - If true, the connection was the result of a reconnect.</li>
*                                  <li>URI (string) - The URI used to connect to the server.</li>
*                                  </ol>
* @property {boolean} disconnectedPublishing - if set, will enable disconnected publishing in
*                                            in the event that the connection to the server is lost.
* @property {number} disconnectedBufferSize - Used to set the maximum number of messages that the disconnected
*                                             buffer will hold before rejecting new messages. Default size: 5000 messages
* @property {function} trace - called whenever trace is called. TODO
*/

import { ERROR, format } from './definitions';
import ClientImpl from './ClientImpl';
import Message from './Message';

/**
* Validate an object's parameter names to ensure they
* match a list of expected variables name for this option
* type. Used to ensure option object passed into the API don't
* contain erroneous parameters.
* @param {Object} obj - User options object
* @param {Object} keys - valid keys and types that may exist in obj.
* @throws {Error} Invalid option parameter found.
* @private
*/
const validate = function(obj, keys) {
  for(const key in obj) {
    if(obj.hasOwnProperty(key)) {
      if(keys.hasOwnProperty(key)) {
        if(typeof obj[key] !== keys[key]) {
          throw new Error(format(ERROR.INVALID_TYPE, [typeof obj[key], key]));
        }
      } else {
        let errorStr = 'Unknown property, ' + key + '. Valid properties are:';
        for(const validKey in keys) {
          if(keys.hasOwnProperty(validKey)) {
            errorStr = errorStr + ' ' + validKey;
          }
        }
        throw new Error(errorStr);
      }
    }
  }
};

export default class {
  constructor(host, port, path, clientId) {
    let uri;

    if(typeof host !== 'string') {
      throw new Error(format(ERROR.INVALID_TYPE, [typeof host, 'host']));
    }

    if(arguments.length == 2) {
      // host: must be full ws:// uri
      // port: clientId
      clientId = port;
      uri = host;
      const match = uri.match(/^(wss?):\/\/((\[(.+)\])|([^/]+?))(:(\d+))?(\/.*)$/);
      if(match) {
        host = match[4] || match[2];
        port = parseInt(match[7]);
        path = match[8];
      } else {
        throw new Error(format(ERROR.INVALID_ARGUMENT, [host, 'host']));
      }
    } else {
      if(arguments.length == 3) {
        clientId = path;
        path = '/mqtt';
      }
      if(typeof port !== 'number' || port < 0) {
        throw new Error(format(ERROR.INVALID_TYPE, [typeof port, 'port']));
      }
      if(typeof path !== 'string') {
        throw new Error(format(ERROR.INVALID_TYPE, [typeof path, 'path']));
      }

      const ipv6AddSBracket = (host.indexOf(':') !== -1 && host.slice(0, 1) !== '[' && host.slice(-1) !== ']');
      uri = 'ws://' + (ipv6AddSBracket ? '[' + host + ']' : host) + ':' + port + path;
    }

    let clientIdLength = 0;
    for(let i = 0; i < clientId.length; i++) {
      const charCode = clientId.charCodeAt(i);
      if(charCode >= 0xD800 && charCode <= 0xDBFF)  {
        i++; // Surrogate pair.
      }
      clientIdLength++;
    }
    if(typeof clientId !== 'string' || clientIdLength > 65535) {
      throw new Error(format(ERROR.INVALID_ARGUMENT, [clientId, 'clientId']));
    }

    this.client = new ClientImpl(uri, host, port, path, clientId);

    // Public Properties
    Object.defineProperties(this, {
      host: {
        get: function() {
          return host;
        },
        set: function() {
          throw new Error(format(ERROR.UNSUPPORTED_OPERATION));
        }
      },
      port: {
        get: function() {
          return port;
        },
        set: function() {
          throw new Error(format(ERROR.UNSUPPORTED_OPERATION));
        }
      },
      path: {
        get: function() {
          return path;
        },
        set: function() {
          throw new Error(format(ERROR.UNSUPPORTED_OPERATION));
        }
      },
      uri: {
        get: function() {
          return uri;
        },
        set: function() {
          throw new Error(format(ERROR.UNSUPPORTED_OPERATION));
        }
      },
      clientId: {
        get: () => this.client.clientId,
        set: function() {
          throw new Error(format(ERROR.UNSUPPORTED_OPERATION));
        }
      },
      onConnected: {
        get: () => this.client.onConnected,
        set: (newOnConnected) => {
          if(typeof newOnConnected === 'function') {
            this.client.onConnected = newOnConnected;
          } else {
            throw new Error(format(ERROR.INVALID_TYPE, [typeof newOnConnected, 'onConnected']));
          }
        }
      },
      disconnectedPublishing: {
        get: () => this.client.disconnectedPublishing,
        set: (newDisconnectedPublishing) => {
          this.client.disconnectedPublishing = newDisconnectedPublishing;
        }
      },
      disconnectedBufferSize: {
        get: () => this.client.disconnectedBufferSize,
        set: (newDisconnectedBufferSize) => {
          this.client.disconnectedBufferSize = newDisconnectedBufferSize;
        }
      },
      onConnectionLost: {
        get: () => this.client.onConnectionLost,
        set: (newOnConnectionLost) => {
          if(typeof newOnConnectionLost === 'function') {
            this.client.onConnectionLost = newOnConnectionLost;
          } else {
            throw new Error(format(ERROR.INVALID_TYPE, [typeof newOnConnectionLost, 'onConnectionLost']));
          }
        }
      },
      onMessageDelivered: {
        get: () => this.client.onMessageDelivered,
        set: (newOnMessageDelivered) => {
          if(typeof newOnMessageDelivered === 'function') {
            this.client.onMessageDelivered = newOnMessageDelivered;
          } else {
            throw new Error(format(ERROR.INVALID_TYPE, [typeof newOnMessageDelivered, 'onMessageDelivered']));
          }
        }
      },
      onMessageArrived: {
        get: () => this.client.onMessageArrived,
        set: (newOnMessageArrived) => {
          if(typeof newOnMessageArrived === 'function') {
            this.client.onMessageArrived = newOnMessageArrived;
          } else {
            throw new Error(format(ERROR.INVALID_TYPE, [typeof newOnMessageArrived, 'onMessageArrived']));
          }
        }
      },
      trace: {
        get: () => this.client.traceFunction,
        set: (trace) => {
          if(typeof trace === 'function') {
            this.client.traceFunction = trace;
          } else {
            throw new Error(format(ERROR.INVALID_TYPE, [typeof trace, 'onTrace']));
          }
        }
      }
    });
  }
  /**
     * Connect this Messaging client to its server.
     *
     * @name Paho.Client#connect
     * @function
     * @param {object} connectOptions - Attributes used with the connection.
     * @param {number} connectOptions.timeout - If the connect has not succeeded within this
     *                    number of seconds, it is deemed to have failed.
     *                    The default is 30 seconds.
     * @param {string} connectOptions.userName - Authentication username for this connection.
     * @param {string} connectOptions.password - Authentication password for this connection.
     * @param {Paho.Message} connectOptions.willMessage - sent by the server when the client
     *                    disconnects abnormally.
     * @param {number} connectOptions.keepAliveInterval - the server disconnects this client if
     *                    there is no activity for this number of seconds.
     *                    The default value of 60 seconds is assumed if not set.
     * @param {boolean} connectOptions.cleanSession - if true(default) the client and server
     *                    persistent state is deleted on successful connect.
     * @param {boolean} connectOptions.useSSL - if present and true, use an SSL Websocket connection.
     * @param {object} connectOptions.invocationContext - passed to the onSuccess callback or onFailure callback.
     * @param {function} connectOptions.onSuccess - called when the connect acknowledgement
     *                    has been received from the server.
     * A single response object parameter is passed to the onSuccess callback containing the following fields:
     * <ol>
     * <li>invocationContext as passed in to the onSuccess method in the connectOptions.
     * </ol>
     * @param {function} connectOptions.onFailure - called when the connect request has failed or timed out.
     * A single response object parameter is passed to the onFailure callback containing the following fields:
     * <ol>
     * <li>invocationContext as passed in to the onFailure method in the connectOptions.
     * <li>errorCode a number indicating the nature of the error.
     * <li>errorMessage text describing the error.
     * </ol>
     * @param {array} connectOptions.hosts - If present this contains either a set of hostnames or fully qualified
     * WebSocket URIs (ws://iot.eclipse.org:80/ws), that are tried in order in place
     * of the host and port paramater on the construtor. The hosts are tried one at at time in order until
     * one of then succeeds.
     * @param {array} connectOptions.ports - If present the set of ports matching the hosts. If hosts contains URIs, this property
     * is not used.
     * @param {boolean} connectOptions.reconnect - Sets whether the client will automatically attempt to reconnect
     * to the server if the connection is lost.
     *<ul>
     *<li>If set to false, the client will not attempt to automatically reconnect to the server in the event that the
     * connection is lost.</li>
     *<li>If set to true, in the event that the connection is lost, the client will attempt to reconnect to the server.
     * It will initially wait 1 second before it attempts to reconnect, for every failed reconnect attempt, the delay
     * will double until it is at 2 minutes at which point the delay will stay at 2 minutes.</li>
     *</ul>
     * @param {number} connectOptions.mqttVersion - The version of MQTT to use to connect to the MQTT Broker.
     *<ul>
     *<li>3 - MQTT V3.1</li>
     *<li>4 - MQTT V3.1.1</li>
     *</ul>
     * @param {boolean} connectOptions.mqttVersionExplicit - If set to true, will force the connection to use the
     * selected MQTT Version or will fail to connect.
     * @param {array} connectOptions.uris - If present, should contain a list of fully qualified WebSocket uris
     * (e.g. ws://iot.eclipse.org:80/ws), that are tried in order in place of the host and port parameter of the construtor.
     * The uris are tried one at a time in order until one of them succeeds. Do not use this in conjunction with hosts as
     * the hosts array will be converted to uris and will overwrite this property.
     * @throws {InvalidState} If the client is not in disconnected state. The client must have received connectionLost
     * or disconnected before calling connect for a second or subsequent time.
     */
  connect(connectOptions) {
    connectOptions = connectOptions || {};
    validate(connectOptions,  {
      timeout:             'number',
      userName:            'string',
      password:            'string',
      willMessage:         'object',
      keepAliveInterval:   'number',
      cleanSession:        'boolean',
      useSSL:              'boolean',
      invocationContext:   'object',
      onSuccess:           'function',
      onFailure:           'function',
      hosts:               'object',
      ports:               'object',
      reconnect:           'boolean',
      mqttVersion:         'number',
      mqttVersionExplicit: 'boolean',
      uris:                'object'
    });

    // If no keep alive interval is set, assume 60 seconds.
    if(connectOptions.keepAliveInterval === undefined) {
      connectOptions.keepAliveInterval = 60;
    }

    if(connectOptions.mqttVersion > 4 || connectOptions.mqttVersion < 3) {
      throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.mqttVersion, 'connectOptions.mqttVersion']));
    }

    if(connectOptions.mqttVersion === undefined) {
      connectOptions.mqttVersionExplicit = false;
      connectOptions.mqttVersion = 4;
    } else {
      connectOptions.mqttVersionExplicit = true;
    }

    // Check that if password is set, so is username
    if(connectOptions.password !== undefined && connectOptions.userName === undefined) {
      throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.password, 'connectOptions.password']));
    }

    if(connectOptions.willMessage) {
      if(!(connectOptions.willMessage instanceof Message)) {
        throw new Error(format(ERROR.INVALID_TYPE, [connectOptions.willMessage, 'connectOptions.willMessage']));
      }
      // The will message must have a payload that can be represented as a string.
      // Cause the willMessage to throw an exception if this is not the case.
      connectOptions.willMessage.stringPayload = null;

      if(typeof connectOptions.willMessage.destinationName === 'undefined') {
        throw new Error(format(ERROR.INVALID_TYPE, [typeof connectOptions.willMessage.destinationName, 'connectOptions.willMessage.destinationName']));
      }
    }
    if(typeof connectOptions.cleanSession === 'undefined') {
      connectOptions.cleanSession = true;
    }
    if(connectOptions.hosts) {
      if(!(connectOptions.hosts instanceof Array)) {
        throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.hosts, 'connectOptions.hosts']));
      }
      if(connectOptions.hosts.length < 1) {
        throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.hosts, 'connectOptions.hosts']));
      }

      let usingURIs = false;
      for(var i = 0; i < connectOptions.hosts.length; i++) {
        if(typeof connectOptions.hosts[i] !== 'string') {
          throw new Error(format(ERROR.INVALID_TYPE, [typeof connectOptions.hosts[i], 'connectOptions.hosts[' + i + ']']));
        }
        if(/^(wss?):\/\/((\[(.+)\])|([^/]+?))(:(\d+))?(\/.*)$/.test(connectOptions.hosts[i])) {
          if(i === 0) {
            usingURIs = true;
          } else if(!usingURIs) {
            throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.hosts[i], 'connectOptions.hosts[' + i + ']']));
          }
        } else if(usingURIs) {
          throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.hosts[i], 'connectOptions.hosts[' + i + ']']));
        }
      }

      if(!usingURIs) {
        if(!connectOptions.ports) {
          throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.ports, 'connectOptions.ports']));
        }
        if(!(connectOptions.ports instanceof Array)) {
          throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.ports, 'connectOptions.ports']));
        }
        if(connectOptions.hosts.length !== connectOptions.ports.length) {
          throw new Error(format(ERROR.INVALID_ARGUMENT, [connectOptions.ports, 'connectOptions.ports']));
        }

        connectOptions.uris = [];

        for(i = 0; i < connectOptions.hosts.length; i++) {
          if(typeof connectOptions.ports[i] !== 'number' || connectOptions.ports[i] < 0) {
            throw new Error(format(ERROR.INVALID_TYPE, [typeof connectOptions.ports[i], 'connectOptions.ports[' + i + ']']));
          }
          const host = connectOptions.hosts[i];
          const port = connectOptions.ports[i];

          const ipv6 = (host.indexOf(':') !== -1);
          this.uri = 'ws://' + (ipv6 ? '[' + host + ']' : host) + ':' + port + this.path;
          connectOptions.uris.push(this.uri);
        }
      } else {
        connectOptions.uris = connectOptions.hosts;
      }
    }

    this.client.connect(connectOptions);
  }

  /**
     * Subscribe for messages, request receipt of a copy of messages sent to the destinations described by the filter.
     *
     * @name Paho.Client#subscribe
     * @function
     * @param {string} filter describing the destinations to receive messages from.
     * <br>
     * @param {object} subscribeOptions - used to control the subscription
     *
     * @param {number} subscribeOptions.qos - the maximum qos of any publications sent
     *                                  as a result of making this subscription.
     * @param {object} subscribeOptions.invocationContext - passed to the onSuccess callback
     *                                  or onFailure callback.
     * @param {function} subscribeOptions.onSuccess - called when the subscribe acknowledgement
     *                                  has been received from the server.
     *                                  A single response object parameter is passed to the onSuccess callback containing the following fields:
     *                                  <ol>
     *                                  <li>invocationContext if set in the subscribeOptions.
     *                                  </ol>
     * @param {function} subscribeOptions.onFailure - called when the subscribe request has failed or timed out.
     *                                  A single response object parameter is passed to the onFailure callback containing the following fields:
     *                                  <ol>
     *                                  <li>invocationContext - if set in the subscribeOptions.
     *                                  <li>errorCode - a number indicating the nature of the error.
     *                                  <li>errorMessage - text describing the error.
     *                                  </ol>
     * @param {number} subscribeOptions.timeout - which, if present, determines the number of
     *                                  seconds after which the onFailure calback is called.
     *                                  The presence of a timeout does not prevent the onSuccess
     *                                  callback from being called when the subscribe completes.
     * @throws {InvalidState} if the client is not in connected state.
     */
  subscribe(filter, subscribeOptions) {
    if(typeof filter !== 'string' && filter.constructor !== Array) {
      throw new Error('Invalid argument:' + filter);
    }
    subscribeOptions = subscribeOptions || {};
    validate(subscribeOptions,  {qos:               'number',
      invocationContext: 'object',
      onSuccess:         'function',
      onFailure:         'function',
      timeout:           'number'
    });
    if(subscribeOptions.timeout && !subscribeOptions.onFailure) {
      throw new Error('subscribeOptions.timeout specified with no onFailure callback.');
    }
    if(typeof subscribeOptions.qos !== 'undefined' && !(subscribeOptions.qos === 0 || subscribeOptions.qos === 1 || subscribeOptions.qos === 2)) {
      throw new Error(format(ERROR.INVALID_ARGUMENT, [subscribeOptions.qos, 'subscribeOptions.qos']));
    }
    this.client.subscribe(filter, subscribeOptions);
  }

  /**
     * Unsubscribe for messages, stop receiving messages sent to destinations described by the filter.
     *
     * @name Paho.Client#unsubscribe
     * @function
     * @param {string} filter - describing the destinations to receive messages from.
     * @param {object} unsubscribeOptions - used to control the subscription
     * @param {object} unsubscribeOptions.invocationContext - passed to the onSuccess callback
     or onFailure callback.
     * @param {function} unsubscribeOptions.onSuccess - called when the unsubscribe acknowledgement has been received from the server.
     *                                    A single response object parameter is passed to the
     *                                    onSuccess callback containing the following fields:
     *                                    <ol>
     *                                    <li>invocationContext - if set in the unsubscribeOptions.
     *                                    </ol>
     * @param {function} unsubscribeOptions.onFailure called when the unsubscribe request has failed or timed out.
     *                                    A single response object parameter is passed to the onFailure callback containing the following fields:
     *                                    <ol>
     *                                    <li>invocationContext - if set in the unsubscribeOptions.
     *                                    <li>errorCode - a number indicating the nature of the error.
     *                                    <li>errorMessage - text describing the error.
     *                                    </ol>
     * @param {number} unsubscribeOptions.timeout - which, if present, determines the number of seconds
     *                                    after which the onFailure callback is called. The presence of
     *                                    a timeout does not prevent the onSuccess callback from being
     *                                    called when the unsubscribe completes
     * @throws {InvalidState} if the client is not in connected state.
     */
  unsubscribe(filter, unsubscribeOptions) {
    if(typeof filter !== 'string' && filter.constructor !== Array) {
      throw new Error('Invalid argument:' + filter);
    }
    unsubscribeOptions = unsubscribeOptions || {};
    validate(unsubscribeOptions,  {invocationContext: 'object',
      onSuccess:         'function',
      onFailure:         'function',
      timeout:           'number'
    });
    if(unsubscribeOptions.timeout && !unsubscribeOptions.onFailure) {
      throw new Error('unsubscribeOptions.timeout specified with no onFailure callback.');
    }
    this.client.unsubscribe(filter, unsubscribeOptions);
  }

  /**
     * Send a message to the consumers of the destination in the Message.
     *
     * @name Paho.Client#send
     * @function
     * @param {string|Paho.Message} topic - <b>mandatory</b> The name of the destination to which the message is to be sent.
     * 					   - If it is the only parameter, used as Paho.Message object.
     * @param {String|ArrayBuffer} payload - The message data to be sent.
     * @param {number} qos The Quality of Service used to deliver the message.
     * 		<dl>
     * 			<dt>0 Best effort (default).
     *     			<dt>1 At least once.
     *     			<dt>2 Exactly once.
     * 		</dl>
     * @param {Boolean} retained If true, the message is to be retained by the server and delivered
     *                     to both current and future subscriptions.
     *                     If false the server only delivers the message to current subscribers, this is the default for new Messages.
     *                     A received message has the retained boolean set to true if the message was published
     *                     with the retained boolean set to true
     *                     and the subscrption was made after the message has been published.
     * @throws {InvalidState} if the client is not connected.
     */
  send(topic, payload, qos, retained) {
    let message;

    if(arguments.length === 0) {
      throw new Error('Invalid argument.' + 'length');
    } else if(arguments.length == 1) {
      if(!(topic instanceof Message) && (typeof topic !== 'string')) {
        throw new Error('Invalid argument:' + typeof topic);
      }

      message = topic;
      if(typeof message.destinationName === 'undefined') {
        throw new Error(format(ERROR.INVALID_ARGUMENT, [message.destinationName, 'Message.destinationName']));
      }
      this.client.send(message);
    } else {
      // parameter checking in Message object
      message = new Message(payload);
      message.destinationName = topic;
      if(arguments.length >= 3) {
        message.qos = qos;
      }
      if(arguments.length >= 4) {
        message.retained = retained;
      }
      this.client.send(message);
    }
  }

  /**
     * Publish a message to the consumers of the destination in the Message.
     * Synonym for Paho.Mqtt.Client#send
     *
     * @name Paho.Client#publish
     * @function
     * @param {string|Paho.Message} topic - <b>mandatory</b> The name of the topic to which the message is to be published.
     * 					   - If it is the only parameter, used as Paho.Message object.
     * @param {String|ArrayBuffer} payload - The message data to be published.
     * @param {number} qos The Quality of Service used to deliver the message.
     * 		<dl>
     * 			<dt>0 Best effort (default).
     *     			<dt>1 At least once.
     *     			<dt>2 Exactly once.
     * 		</dl>
     * @param {Boolean} retained If true, the message is to be retained by the server and delivered
     *                     to both current and future subscriptions.
     *                     If false the server only delivers the message to current subscribers, this is the default for new Messages.
     *                     A received message has the retained boolean set to true if the message was published
     *                     with the retained boolean set to true
     *                     and the subscrption was made after the message has been published.
     * @throws {InvalidState} if the client is not connected.
     */
  publish(topic, payload, qos, retained) {
    let message;

    if(arguments.length === 0) {
      throw new Error('Invalid argument.' + 'length');
    } else if(arguments.length == 1) {
      if(!(topic instanceof Message) && (typeof topic !== 'string')) {
        throw new Error('Invalid argument:' + typeof topic);
      }

      message = topic;
      if(typeof message.destinationName === 'undefined') {
        throw new Error(format(ERROR.INVALID_ARGUMENT, [message.destinationName, 'Message.destinationName']));
      }
      this.client.send(message);
    } else {
      // parameter checking in Message object
      message = new Message(payload);
      message.destinationName = topic;
      if(arguments.length >= 3) {
        message.qos = qos;
      }
      if(arguments.length >= 4) {
        message.retained = retained;
      }
      this.client.send(message);
    }
  }

  /**
     * Normal disconnect of this Messaging client from its server.
     *
     * @name Paho.Client#disconnect
     * @function
     * @throws {InvalidState} if the client is already disconnected.
     */
  disconnect() {
    this.client.disconnect();
  }

  /**
     * Get the contents of the trace log.
     *
     * @name Paho.Client#getTraceLog
     * @function
     * @return {Object[]} tracebuffer containing the time ordered trace records.
     */
  getTraceLog() {
    return this.client.getTraceLog();
  }

  /**
     * Start tracing.
     *
     * @name Paho.Client#startTrace
     * @function
     */
  startTrace() {
    this.client.startTrace();
  }

  /**
     * Stop tracing.
     *
     * @name Paho.Client#stopTrace
     * @function
     */
  stopTrace() {
    this.client.stopTrace();
  }

  isConnected() {
    return this.client.connected;
  }
};
