/* eslint-disable no-console */
const settings = require("./client-harness");

const testMqttVersion = settings.mqttVersion,
      testPath        = settings.path,
      testPort        = settings.port,
      testServer      = settings.server,
      testUseSSL      = settings.useSSL,
      topicPrefix     = settings.topicPrefix;

const genStr = function(str) {
  const time = new Date();
  return str + "." + time.getTime();
};

describe("BasicTest", function() {
  //var client = null;
  let connected          = false,
      disconnectError    = null,
      disconnectErrorMsg = null,
      isMessageDelivered = false,
      isMessageReceived  = false,
      strMessageReceived = "",
      strTopicReceived   = "",
      subscribed         = false;
  // eslint-disable-next-line no-invalid-this
  const clientId         = this.description,
        strMessageSend   = "Hello",
        strMessageSend2  = "你好", // Hello in Traditional Chinese and a good UTF-8 test
        strTopic         = topicPrefix + "/" + makeid() + "/World",
        strTopic2        = topicPrefix + "/" + makeid() + "/Mars";

  settings.printConfig(settings);

  function makeid() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (let i = 0; i < 5; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  function onConnectSuccess() {
    //console.log("connected %s",responseObj);
    connected = true;
  }

  function onConnectionLost(err) {
    connected = false;
    if (err) {
      disconnectError = err.errorCode;
      disconnectErrorMsg = err.errorMessage;
    }
    console.log("connection lost. ErrorCode: %s, ErrorMsg: %s", disconnectError, disconnectErrorMsg);
  }

  function onConnectFailure(err) {
    connected = false;
    console.error("Connect fail. ErrorCode: %s, ErrorMsg: %s", err.errCode, err.errorMessage);
  }

  function onSubscribeSuccess() {
    subscribed = true;
    //console.log("subscribed",subscribed);
  }

  function onSubscribeFailure(err) {
    subscribed = false;
    console.error("subscribe fail. ErrorCode: %s, ErrorMsg: %s", err.errCode, err.errorMessage);
  }

  function onUnsubscribeSuccess() {
    subscribed = false;
    //console.log("unsubscribed",subscribed);
  }

  function messageDelivered(message) {
    console.log("messageDelivered. topic:%s, duplicate:%s, payloadString:%s,qos:%s,retained:%s", message.destinationName, message.duplicate, message.payloadString, message.qos, message.retained);
    isMessageDelivered = true;
    //message.invocationContext.onMessageArrived = null;
  }

  function messageArrived(message) {
    console.log("messageArrived.", "topic:", message.destinationName, " ;content:", message.payloadString);
    isMessageReceived = true;
    strMessageReceived = message.payloadString;
    strTopicReceived = message.destinationName;

    //reponse.invocationContext.onMessageArrived = null;
  }

  beforeEach(function() {
    connected = false;
    disconnectError = null;
    disconnectErrorMsg = null;
    //if(!client){
    //	client = new Paho.Client(testServer, testPort, clientId);
    //}
  });

  /*afterEach(function(){
  	if(client){
  		client.disconnect();
  	}
  });
  */
  it("it should create and connect and disconnect to a server.", function() {
    const client = new Paho.Client(testServer, testPort, testPath, genStr(clientId));
    client.on("connectionLost", onConnectionLost);
    client.on("connected", onConnectSuccess);
    client.on("error", onConnectFailure);
    expect(client).not.toBe(null);

    console.log("Connecting...");
    runs(() => client.connect({
      mqttVersion: testMqttVersion,
      useSSL: testUseSSL
    }));
    waitsFor(() => connected, "the client should connect", 2000);
    runs(() => expect(connected).toBe(true));

    console.log("Disconnecting...");
    runs(() => client.disconnect());
    waitsFor(() => (connected == false), "the client should disconnect", 2000);
    runs(() => expect(connected).not.toBe(true));

    console.log("Re-Connecting...");
    runs(() => client.connect({
      mqttVersion: testMqttVersion,
      useSSL: testUseSSL
    }));

    waitsFor(() => connected, "the client should re-connect", 2000);

    runs(() => expect(connected).toBe(true));
  });

  it("it should fallback from MQTTv3.1.1 to v3.1", function() {
    const client = new Paho.Client(testServer, testPort, testPath, genStr(clientId));
    client.on("connected", onConnectSuccess);
    client.on("error", onConnectFailure);
    client.on("connectionLost", onConnectionLost);
    expect(client).not.toBe(null);

    console.log("Connecting...");
    runs(() => client.connect({
      timeout: 1,
      useSSL: testUseSSL
    }));
    waitsFor(() => connected, "the client should connect", 4000);
    runs(() => expect(connected).toBe(true));

    console.log("Disconnecting...");
    runs(() => client.disconnect());
    waitsFor(() => (connected == false), "the client should disconnect", 2000);
    runs(() => expect(connected).not.toBe(true));
  });

  it("it should connect to a list of server(HA connection).", function() {
    const client = new Paho.Client(testServer, testPort, testPath, genStr(clientId));
    client.on("connected", onConnectSuccess);
    client.on("error", onConnectFailure);
    client.on("connectionLost", onConnectionLost);
    expect(client).not.toBe(null);

    console.log("should connect to a available server from list");
    runs(() => client.connect({
      hosts: ["localhost", testServer],
      ports: [2000, testPort],
      protocols: ["ws", "ws"],
      mqttVersion: testMqttVersion,
      useSSL: testUseSSL
    }));

    waitsFor(() => connected, "the client should connect", 2000);

    runs(() => expect(connected).toBe(true)); //client.disconnect();
  });

  it("it should publish and subscribe.", function() {
    const client = new Paho.Client(testServer, testPort, testPath, genStr(clientId));
    client.on("connected", onConnectSuccess);
    client.on("error", onConnectFailure);
    client.on("arrived", messageArrived);
    client.on("delivered", messageDelivered);

    runs(() => client.connect({
      mqttVersion: testMqttVersion,
      useSSL: testUseSSL
    }));
    waitsFor(() => connected, "the client should connect", 5000);
    runs(() => expect(connected).toBe(true));

    console.log("Subscribe a topic...");
    runs(() => client.subscribe(strTopic, {
      onSuccess: onSubscribeSuccess,
      onFailure: onSubscribeFailure
    }));

    waitsFor(() => subscribed, "the client should subscribe", 2000);

    runs(() => expect(subscribed).toBe(true));

    console.log("Send and receive message...");
    runs(() => {
      const message = new Paho.Message(strMessageSend);
      message.destinationName = strTopic;
      client.send(message);
    });
    waitsFor(() => isMessageReceived, "the client should send and receive a message", 2000);
    runs(() => {
      //to do Check message sent
      expect(isMessageDelivered).toBe(true);
      //Check msg received
      expect(isMessageReceived).toBe(true);
      //Check message
      expect(strMessageReceived).toEqual(strMessageSend);
      //Check topic
      expect(strTopicReceived).toEqual(strTopic);
      //disconnect
      //client.disconnect();
    });

    console.log("Unsubscribe a topic...");
    runs(() => client.unsubscribe(strTopic, {
      onSuccess: onUnsubscribeSuccess
    }));
    waitsFor(() => !subscribed, "the client should subscribe", 2000);
    runs(() => expect(subscribed).toBe(false));
      //disconnect
      //client.disconnect();

    //should not receive a message after unsubscribe
    runs(() => {
      //console.log('isMessageReceived',isMessageReceived);
      isMessageDelivered = false;
      isMessageReceived = false;
      strMessageReceived = "";
      strTopicReceived = "";

      const message = new Paho.Message(genStr(strMessageSend));
      message.destinationName = strTopic;
      client.send(message);
    });
    waitsFor(() => isMessageDelivered, "the client should send and receive a message", 2000);

    runs(() => {
      //to do Check message sent
      expect(isMessageDelivered).toBe(true);
      //Check msg received
      expect(isMessageReceived).toBe(false);
      //Check message
      expect(strMessageReceived).toEqual("");
      //Check topic
      expect(strTopicReceived).toEqual("");
      //disconnect
      //client.disconnect();
    });
  });

  it("check message properties.", function() {
    const strDes = topicPrefix + "/test",
          strMsg = "test Msg";
    const message = new Paho.Message(strMsg);
    message.destinationName = strDes;

    console.log("Check default for message with payload.");
    expect(message.qos).toBe(0);
    expect(message.duplicate).toBe(false);
    expect(message.retained).toBe(false);
    expect(message.payloadString).toEqual(strMsg);
    expect(message.payloadBytes.length).toBeGreaterThan(0);
    expect(message.destinationName).toEqual(strDes);

    console.log("Check empty msg to throw error");
    expect(() => new Paho.Message()).toThrow();

    console.log("Check message qos");
    message.qos = 0;
    expect(message.qos).toBe(0);
    message.qos = 1;
    expect(message.qos).toBe(1);
    message.qos = 2;
    expect(message.qos).toBe(2);

    //illegal argument exception
    expect(function() {
      message.qos = -1;
    }).toThrow();
    expect(function() {
      message.qos = 1;
    }).not.toThrow();

    console.log("Check payload");
    const strPayload = "payload is a string";
    message.payloadString = strPayload;
    console.log("not allowed to set payload");
    expect(message.payloadString).not.toEqual(strPayload);

    console.log("Check retained");
    message.retained = false;
    expect(message.retained).toBe(false);
    message.retained = true;
    expect(message.retained).toBe(true);

    console.log("Check duplicate");
    message.duplicate = false;
    expect(message.duplicate).toBe(false);
    message.duplicate = true;
    expect(message.duplicate).toBe(true);

    //to do , check payload
    /*
    var buffer = new ArrayBuffer(4);
    var uintArr = new Uint8Array(buffer);
    dataView = new DataView(buffer);
    dataView.setInt32(0,0x48656c6c);
    //dataView.setInt
    console.log(dataView.getInt32(0).toString(16));
    //var arrbufPayload = new ArrayBuffer
    var msg = new Paho.Message(buffer);
    console.log(msg.payloadBytes,msg.payloadString);
    */
  });

  it("it should subscribe to multiple topics.", function() {

    const client = new Paho.Client(testServer, testPort, testPath, genStr(clientId));
    client.on("connected", onConnectSuccess);
    client.on("error", onConnectFailure);
    client.on("arrived", messageArrived);
    client.on("delivered", messageDelivered);

    runs(() => client.connect({
      mqttVersion: testMqttVersion,
      useSSL: testUseSSL
    }));
    waitsFor(() => connected, "the client should connect", 5000);
    runs(() => expect(connected).toBe(true));

    console.log("Subscribe multiple topics...");
    runs(() => client.subscribe([strTopic, strTopic2], {
      onSuccess: onSubscribeSuccess,
      onFailure: onSubscribeFailure
    }));

    waitsFor(() => subscribed, "the client should subscribe to multiple topics.", 2000);

    runs(() => expect(subscribed).toBe(true));

    console.log("Send and receive message to the first topic...");
    runs(() => {
      const message = new Paho.Message(strMessageSend);
      message.destinationName = strTopic;
      client.send(message);
    });

    waitsFor(() => isMessageReceived, "the client should send and receive a message", 2000);
    runs(() => {
      //to do Check message sent
      expect(isMessageDelivered).toBe(true);
      //Check msg received
      expect(isMessageReceived).toBe(true);
      //Check message
      expect(strMessageReceived).toEqual(strMessageSend);
      //Check topic
      expect(strTopicReceived).toEqual(strTopic);
      //disconnect
      //client.disconnect();
    });

    waitsFor(() => isMessageReceived, "Send and receive message to the second topic...", 2000);
    runs(() => {
      isMessageReceived = false;
      const message= new Paho.Message(strMessageSend2);
      message.destinationName = strTopic2;
      client.send(message);
    });

   

    waitsFor(() => isMessageReceived, "the client should send and receive a message", 2000);
    runs(() => {
      //to do Check message sent
      expect(isMessageDelivered).toBe(true);
      //Check msg received
      expect(isMessageReceived).toBe(true);
      //Check message
      expect(strMessageReceived).toEqual(strMessageSend2);
      //Check topic
      expect(strTopicReceived).toEqual(strTopic2);
      //disconnect
      //client.disconnect();
    });

    console.log("Unsubscribe from both topics...");
    runs(() => client.unsubscribe([strTopic, strTopic2], {
      onSuccess: onUnsubscribeSuccess
    }));
    waitsFor(() => !subscribed, "the client should subscribe", 2000);
    runs(() => expect(subscribed).toBe(false));
      //disconnect
      //client.disconnect();
  });
});
