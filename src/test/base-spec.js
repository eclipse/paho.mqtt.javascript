var settings = require('./client-harness')

var testServer = settings.server
var testPort = settings.port
var testPath = settings.path
var testMqttVersion = settings.mqttVersion
var topicPrefix = settings.topicPrefix
var testUseSSL = settings.useSSL


describe('client', function() {
  var client = this;
  var connected = false;
  var subscribed = false;
  var messageReceived = false;

  function onConnect() {
    connected = true;
  };

  function onSubscribe() {
    subscribed = true;
  };

  function messageArrived(response) {
    messageReceived = true;
    //reponse.invocationContext.onMessageArrived = null;
  };

  it('should create a new client', function() {
    client = new settings.Paho.Client(testServer, testPort, testPath, "testclientid");
    client.onMessageArrived = messageArrived;

    expect(client).not.toBe(null);
    expect(client.host).toBe(testServer);
    expect(client.port).toBe(testPort);
    expect(client.path).toBe(testPath);
  });

  it('should connect to a server', function() {
    runs(function() {
      client.connect({
        onSuccess: onConnect,
        mqttVersion: testMqttVersion,
        useSSL: testUseSSL
      });
    });

    waitsFor(function() {
      return connected;
    }, "the client should connect", 10000);

    runs(function() {
      expect(connected).toBe(true);
    });
  });

  it('should subscribe to a topic', function() {
    runs(function() {
      client.subscribe(topicPrefix + "/World", {
        onSuccess: onSubscribe
      });
    });

    waitsFor(function() {
      return subscribed;
    }, "the client should subscribe", 2000);

    runs(function() {
      expect(subscribed).toBe(true);
    });
  });

  it('should send and receive a message', function() {
    runs(function() {
      message = new settings.Paho.Message("Hello");
      message.destinationName = topicPrefix + "/World";
      client.send(message);
    })

    waitsFor(function() {
      return messageReceived;
    }, "the client should send and receive a message", 2000);

    runs(function() {
      expect(messageReceived).toBe(true);
    })
  });
})
