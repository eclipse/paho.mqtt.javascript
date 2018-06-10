/* eslint-disable no-console */
const settings = require("./client-harness");

const testMqttVersion = settings.mqttVersion,
      testPath        = settings.path,
      testPort        = settings.port,
      testServer      = settings.server,
      testUseSSL      = settings.useSSL,
      topicPrefix     = settings.topicPrefix;


describe("LiveTakeOver", function() {

  //*************************************************************************
  // Client wrapper - define a client wrapper to ease testing
  //*************************************************************************
  const MqttClient = function(clientId) {
    const client = new Paho.Client(testServer, testPort, testPath, clientId);
    //states
    let connected = false,
        messageDelivered = false,
        messageReceived = false,
        receivedMessage = null,
        subscribed = false;

    this.states = {
      connected: connected
    };

    //reset all states
    this.resetStates = function() {
      connected = false;
      subscribed = false;
      messageReceived = false;
      messageDelivered = false;
      receivedMessage = null;
    };

    //callbacks
    const onConnect = function() {
      console.log("%s connected", clientId);
      connected = true;
    };

    const onDisconnect = function() {
      console.log("%s disconnected", clientId);
      connected = false;
    };

    const onSubscribe = function() {
      console.log("%s subscribed", clientId);
      subscribed = true;
    };

    const onUnsubscribe = function() {
      console.log("%s unsubscribed", clientId);
      subscribed = false;
    };

    const onMessageArrived = function(message) {
      console.log("%s received msg: %s", clientId, message.payloadString);
      messageReceived = true;
      receivedMessage = message;
    };

    const onMessageDelivered = function(message) {
      console.log("%s delivered message: %s", clientId, message.payloadString);
      messageDelivered = true;
    };

    //set callbacks
    client.on("arrived", onMessageArrived);
    client.on("connected", onConnect);
    client.on("connectionLost", onDisconnect);
    client.on("delivered", onMessageDelivered);

    //functions
    //connect and verify
    this.connect = function(connectOptions) {
      connectOptions = connectOptions || {};
      connectOptions.mqttVersion = testMqttVersion;
      connectOptions.useSSL = testUseSSL;
      runs(function() {
        client.connect(connectOptions);
      });

      waitsFor(() => connected, "the client should connect", 10000);

      runs(() => {
        expect(connected).toBe(true);
        //reset state
        connected = false;
      });
    };

    //disconnect and verify
    this.disconnect = function() {
      runs(() => client.disconnect());

      waitsFor(() => !connected, "the client should disconnect", 10000);

      runs(() => expect(connected).not.toBe(true));
    };

    //subscribe and verify
    this.subscribe = function(topic, qos) {
      runs(() => client.subscribe(topic, {
        qos: qos,
        onSuccess: onSubscribe
      }));

      waitsFor(() => subscribed, "the client should subscribe", 2000);

      runs(() => {
        expect(subscribed).toBe(true);
        //reset state
        subscribed = false;
      });
    };

    //unsubscribe and verify
    this.unsubscribe = function(topic) {
      runs(() => client.unsubscribe(topic, {
        onSuccess: onUnsubscribe
      }));

      waitsFor(() => !subscribed, "the client should subscribe", 2000);

      runs(() => expect(subscribed).not.toBe(true));
    };

    //publish and verify
    this.publish = function(topic, qos, payload) {
      runs(function() {
        const message = new Paho.Message(payload);
        message.destinationName = topic;
        message.qos = qos;
        client.send(message);
      });

      waitsFor(() => messageDelivered, "the client should delivered a message", 10000);

      runs(() => {
        //reset state
        messageDelivered = false;
      });
    };


    //verify no message received
    this.receiveNone = function() {
      waits(2000);
      runs(() => {
        expect(messageReceived).toBe(false);
        expect(receivedMessage).toBeNull();
      });
    };

    //verify the receive message
    this.receive = function(expectedTopic, publishedQoS, subscribedQoS, expectedPayload) {

      waitsFor(() => messageReceived, "the client should send and receive a message", 10000);

      runs(function() {
        expect(messageReceived).toBe(true);
        expect(receivedMessage).not.toBeNull();
        expect(receivedMessage.qos).toBe(Math.min(publishedQoS, subscribedQoS));
        expect(receivedMessage.destinationName).toBe(expectedTopic);
        if (typeof expectedPayload === "string") {
          expect(receivedMessage.payloadString).toEqual(expectedPayload);
        } else {
          expect(receivedMessage.payloadBytes).toEqual(expectedPayload);
        }

        //reset state after each publish
        messageReceived = false;
        receivedMessage = null;
      });
    };
  };

  //*************************************************************************
  // Tests
  //*************************************************************************

  it("should be taken over by another client for the actively doing work.", function() {
    const clientId = "TakeOverClient1",
          payload = "TakeOverPayload",
          publishQoS = 1,
          subscribedQoS = 2,
          testTopic = topicPrefix + "FirstClient/Topic";

    //will msg
    const willMessage = new Paho.Message("will-payload");
    willMessage.destinationName = topicPrefix + "willTopic";
    willMessage.qos = 2;
    willMessage.retained = true;

    const client1 = new MqttClient(clientId);
    client1.connect({
      cleanSession: false,
      willMessage: willMessage,
      mqttVersion: testMqttVersion,
      useSSL: testUseSSL
    });

    //subscribe
    client1.subscribe(testTopic, subscribedQoS);

    //publish some messwage
    for (let i = 0; i < 9; i++) {
      client1.publish(testTopic, publishQoS, payload);
      client1.receive(testTopic, publishQoS, subscribedQoS, payload);
    }

    // Now lets take over the connection
    // Create a second MQTT client connection with the same clientid. The
    // server should spot this and kick the first client connection off.
    const client2 = new MqttClient(clientId);
    client2.connect({
      cleanSession: false,
      willMessage: willMessage,
      mqttVersion: testMqttVersion,
      useSSL: testUseSSL
    });

    waitsFor(() => !client1.states.connected, "the previous client should be disconnected", 10000);

    // We should have taken over the first Client's subscription...
    //Now check we have grabbed his subscription by publishing.
    client2.publish(testTopic, publishQoS, payload);
    client2.receive(testTopic, publishQoS, subscribedQoS, payload);

    //disconnect
    client2.disconnect();
  });
});
