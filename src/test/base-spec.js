const settings        = require("./client-harness");

const testMqttVersion = settings.mqttVersion,
      testPath        = settings.path,
      testPort        = settings.port,
      testServer      = settings.server,
      testUseSSL      = settings.useSSL,
      topicPrefix     = settings.topicPrefix;


describe("client", function() {
  let client          = null,
      connected       = false,
      messageReceived = false,
      subscribed      = false;

  function onConnect() {
    connected = true;
  }

  function onSubscribe() {
    subscribed = true;
  }

  function messageArrived(/* message */) {
    messageReceived = true;
    //message.invocationContext.onMessageArrived = null;
  }

  it("should create a new client", function() {
    client = new settings.Paho.Client(testServer, testPort, testPath, "testclientid");
    client.on("arrived", messageArrived);

    expect(client).not.toBe(null);
    expect(client.host).toBe(testServer);
    expect(client.port).toBe(testPort);
    expect(client.path).toBe(testPath);
  });

  it("should connect to a server", function() {
    client.once("connected", onConnect);
    runs(() => client.connect({
      mqttVersion: testMqttVersion,
      useSSL: testUseSSL
    }));

    waitsFor(() => connected, "the client should connect", 10000);

    runs(() => expect(connected).toBe(true));
  });

  it("should subscribe to a topic", function() {
    runs(() => client.subscribe(topicPrefix + "/World", {
      onSuccess: onSubscribe
    }));

    waitsFor(function() {
      return subscribed;
    }, "the client should subscribe", 2000);

    runs(() => expect(subscribed).toBe(true));
  });

  it("should send and receive a message", function() {
    runs(() => {
      const message = new settings.Paho.Message("Hello");
      message.destinationName = topicPrefix + "/World";
      client.send(message);
    });

    waitsFor(() => messageReceived, "the client should send and receive a message", 2000);

    runs(() => expect(messageReceived).toBe(true));
  });
});
