/* eslint-disable no-console */
const settings = require("./client-harness");

const testMqttVersion = settings.mqttVersion,
      testPath        = settings.path,
      testPort        = settings.port,
      testServer      = settings.server,
      testUseSSL      = settings.useSSL,
      topicPrefix     = settings.topicPrefix;

//define a default clientID
const clientId = "testClient1";

describe("SendReceive", function() {

  //*************************************************************************
  // Client wrapper - define a client wrapper to ease testing
  //*************************************************************************
  const MqttClient = function(clientId) {
    const client = new Paho.Client(testServer, testPort, testPath, clientId);
    //states
    let connected = false;
    let subscribed = false;
    let messageReceived = false;
    let messageDelivered = false;
    let receivedMessage = null;

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

    const onMessageArrived = function(msg) {
      console.log("%s received msg: %s", clientId, msg.payloadString);
      messageReceived = true;
      receivedMessage = msg;
    };

    const onMessageDelivered = function(msg) {
      console.log("%s delivered message: %s", clientId, msg.payloadString);
      messageDelivered = true;
    };

    //set callbacks
    client.onMessageArrived = onMessageArrived;
    client.onConnectionLost = onDisconnect;
    client.onMessageDelivered = onMessageDelivered;

    //functions
    //connect and verify
    this.connect = function(connectOptions) {
      connectOptions = connectOptions || {};
      if (!connectOptions.hasOwnProperty("onSuccess")) {
        connectOptions.onSuccess = onConnect;
        connectOptions.mqttVersion = testMqttVersion;
        connectOptions.useSSL = testUseSSL;
      }
      runs(() => client.connect(connectOptions));

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
      runs(() => {
        client.subscribe(topic, {
          qos: qos,
          onSuccess: onSubscribe
        });
      });

      waitsFor(() => subscribed, "the client should subscribe", 2000);

      runs(() => {
        expect(subscribed).toBe(true);
        //reset state
        subscribed = false;
      });
    };

    //unsubscribe and verify
    this.unsubscribe = function(topic) {
      runs(() => {
        client.unsubscribe(topic, {
          onSuccess: onUnsubscribe
        });
      });

      waitsFor(() => !subscribed, "the client should subscribe", 2000);

      runs(() => expect(subscribed).not.toBe(true));
    };

    //publish and verify
    this.publish = function(topic, qos, payload) {
      runs(() => {
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

      runs(() => {
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

  it("should connect to a server and disconnect from a server", function() {
    const client = new MqttClient(clientId);

    //connect and verify
    client.connect({
      mqttVersion: testMqttVersion,
      useSSL: testUseSSL
    });

    //disconnect and verify
    client.disconnect();
  });


  it("should pub/sub using largish messages", function() {
    const client = new MqttClient(clientId);

    //connect and verify
    client.connect({
      mqttVersion: testMqttVersion,
      useSSL: testUseSSL
    });

    //subscribe and verify
    const testTopic = topicPrefix + "pubsub/topic";
    const subscribedQoS = 0;
    client.subscribe(testTopic, subscribedQoS);

    //unsubscribe and verify
    client.unsubscribe(testTopic);

    //subscribe again
    client.subscribe(testTopic, subscribedQoS);

    //publish a large message to the topic and verify
    const largeSize  = 10000,
          publishQoS = 0;
    let payload = "";
    for (let i = 0; i < largeSize; i++) {
      payload += "s";
    }
    client.publish(testTopic, publishQoS, payload);

    //receive and verify
    client.receive(testTopic, publishQoS, subscribedQoS, payload);

    //disconnect and verify
    client.disconnect();
  });


  it("should preserve QOS values between publishers and subscribers", function() {
    const client = new MqttClient(clientId);

    //connect and verify
    client.connect({
      mqttVersion: testMqttVersion,
      useSSL: testUseSSL
    });

    //subscribe and verify
    const subscribedQoSs = [0, 1, 2],
          testTopics     = ["pubsub/topic1", "pubsub/topic2", "pubsub/topic3"];
    for (let i = 0; i < testTopics.length; i++) {
      client.subscribe(topicPrefix + testTopics[i], subscribedQoSs[i]);
    }

    //publish, receive and verify
    for (let i = 0; i < testTopics.length; i++) {
      const payload = "msg-" + i;
      for (let qos = 0; qos < 3; qos++) {
        client.publish(topicPrefix + testTopics[i], qos, payload);
        //receive and verify
        client.receive(topicPrefix + testTopics[i], qos, subscribedQoSs[i], payload);
      }
    }

    //disconnect and verify
    client.disconnect();
  });

  it("should work using multiple publishers and subscribers.", function() {
    //create publishers and connect
    const publishers = [],
          publishersNum = 2,
          //topic to publish
          topic = topicPrefix + "multiplePubSub/topic";

    for (let i = 0; i < publishersNum; i++) {
      publishers[i] = new MqttClient("publisher-" + i);
      publishers[i].connect({
        mqttVersion: testMqttVersion,
        useSSL: testUseSSL
      });
    }

    //create subscribers and connect
    const subscribedQoS = 0,
          subscribers = [],
          subscribersNum = 10;
    for (let i = 0; i < subscribersNum; i++) {
      subscribers[i] = new MqttClient("subscriber-" + i);
      subscribers[i].connect({
        mqttVersion: testMqttVersion,
        useSSL: testUseSSL
      });
      subscribers[i].subscribe(topic, subscribedQoS);
    }

    //do publish and receive with verify
    const pubishMsgNum = 10,
          publishQoS   = 0;
    for (let m = 0; m < pubishMsgNum; m++) {
      const payload = "multi-pub-sub-msg-" + m;
      for (let i = 0; i < publishersNum; i++) {
        publishers[i].publish(topic, publishQoS, payload);
        for (let j = 0; j < subscribersNum; j++) {
          subscribers[j].receive(topic, publishQoS, subscribedQoS, payload);
        }
      }
    }

    //disconnect publishers and subscribers
    for (let i = 0; i < publishersNum; i++) {
      publishers[i].disconnect();
    }
    for (let i = 0; i < subscribersNum; i++) {
      subscribers[i].disconnect();
    }

  });

  it("should clean up before re-connecting if cleanSession flag is set.", function() {
    //connect with cleanSession flag=false and verify
    const client = new MqttClient("client-1");
    client.connect({
      cleanSession: false,
      mqttVersion: testMqttVersion,
      useSSL: testUseSSL
    });

    //subscribe and verify
    const subscribedQoS = 0,
          testTopic = topicPrefix + "cleanSession/topic1";
    client.subscribe(testTopic, subscribedQoS);

    //publish and verify
    const payload = "cleanSession-msg",
          publishQoS = 1;
    client.publish(testTopic, publishQoS, payload);
    client.receive(testTopic, publishQoS, subscribedQoS, payload);
    //disconnect
    client.disconnect();

    // Send a message from another client, to our durable subscription.
    const anotherClient = new MqttClient("anotherClient-1");
    anotherClient.connect({
      cleanSession: true,
      mqttVersion: testMqttVersion,
      useSSL: testUseSSL
    });
    anotherClient.subscribe(testTopic, subscribedQoS);
    anotherClient.publish(testTopic, publishQoS, payload);
    anotherClient.receive(testTopic, publishQoS, subscribedQoS, payload);
    anotherClient.disconnect();

    //reconnect
    client.connect({
      cleanSession: true,
      mqttVersion: testMqttVersion,
      useSSL: testUseSSL
    });
    //check no msg is received
    client.receiveNone();

    //do another publish and check if msg is received, because subscription should be cancelled
    client.publish(testTopic, publishQoS, payload);
    //check no msg is received
    client.receiveNone();
    //disconnect
    client.disconnect();
  });


});
