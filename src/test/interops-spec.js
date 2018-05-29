/* eslint-disable no-console */
const settings = require("./client-harness");


const testMqttVersion = settings.mqttVersion,
      testPath        = settings.path,
      testPort        = settings.port,
      testServer      = settings.server,
      testUseSSL      = settings.useSSL,
      topicPrefix     = settings.topicPrefix,
      topics          = ["TopicA", "TopicA/B", "Topic/C", "TopicA/C", "/TopicA"];
      // nosubscribetopics = ["test/nosubscribe"],
      // wildtopics        = ["TopicA/+", "+/C", "#", "/#", "/+", "+/+", "TopicA/#"];

describe("InteropsTests", function() {
  // eslint-disable-next-line no-invalid-this
  let client                = null,
      connected             = false,
      messagePublishedCount = 0,
      messageReceivedCount  = 0,
      receivingComplete     = false,
      sendingComplete       = false,
      subscribed            = false;

  beforeEach(function() {
    messageReceivedCount  = 0;
    messagePublishedCount = 0;
    receivingComplete     = false;
    sendingComplete       = false;
    subscribed            = false;
  });

  afterEach(function() {
    if (client !== null && client.isConnected()) {
      client.disconnect();
    }
    client = null;
  });

  const callbacks = {
    onConnectionLost: function(err) {
      console.log("connectionLost " + err.errorMessage);
    },
    onMessageArrived: function(message) {
      console.log("messageArrived %s %s %s %s", message.destinationName, message.payloadString, message.qos, message.retained);
      messageReceivedCount++;
      if(messageReceivedCount == 3) {
        receivingComplete = true;
      }
    },
    onConnectSuccess: function() {
      connected = true;
    },
    onConnectFailure: function(err) {
      console.log("Connect failed %s %s", err.errCode, err.errorMessage);
    },
    onDisconnectSuccess: function() {
      connected = false;
      console.log("Disconnected from server");
    },
    onDisconnectFailure: function(err) {
      console.log("Disconnect failed %s %s", err.errCode, err.errorMessage);
    },
    onMessageDelivered: function(message) {
      console.log("messageDelivered %s %s %s %s", message.destinationName, message.payloadString, message.qos, message.retained);
      messagePublishedCount++;
      if (messagePublishedCount == 3) {
        sendingComplete = true;
      }
    },
    onSubscribeSuccess: function() {
      subscribed = true;
    },
  };

  it("should connect, disconnect, subscribe, publish and receive messages", function() {
    client = new Paho.Client(testServer, testPort, testPath, "testclientid-js");
    client.on("arrived", callbacks.onMessageArrived);
    client.on("delivered", callbacks.onMessageDelivered);

    expect(client).not.toBe(null);

    runs(() => client.connect({
      onSuccess: callbacks.onConnectSuccess,
      mqttVersion: testMqttVersion,
      useSSL: testUseSSL
    }));
    waitsFor(() => client.isConnected(), "the client should connect", 5000);
    runs(() => expect(client.isConnected()).toBe(true));

    runs(() => client.disconnect());
    waitsFor(() => true, "the client should disconnect", 5000);
    runs(() => expect(client.isConnected()).toBe(false));

    runs(() => client.connect({
      onSuccess: callbacks.onConnectSuccess,
      mqttVersion: testMqttVersion,
      useSSL: testUseSSL
    }));
    waitsFor(() => client.isConnected(), "the client should connect again", 5000);
    runs(() => expect(client.isConnected()).toBe(true));

    runs(() => client.subscribe(topicPrefix + topics[0], {
      qos: 2,
      onSuccess: callbacks.onSubscribeSuccess
    }));
    waitsFor(() => subscribed, "the client should subscribe", 2000);
    runs(() => expect(subscribed).toBe(true));

    runs(function() {
      for (let i = 0; i < 3; i++) {
        const message = new Paho.Message("qos " + i);
        message.destinationName = topicPrefix + topics[0];
        message.qos = i;
        client.send(message);
      }
    });
    waitsFor(() => sendingComplete, "the client should send 3 messages", 5000);
    waitsFor(() => receivingComplete, "the client should receive 3 messages", 5000);
    runs(function() {
      expect(messagePublishedCount).toBe(3);
      expect(messageReceivedCount).toBe(3);
    });

    runs(() => client.disconnect({
      onSuccess: callbacks.onDisconnectSuccess
    }));
    waitsFor(() => connected, "the client should disconnect", 5000);
    runs(() => expect(client.isConnected()).toBe(false));
  });

  it("should connect, attempt to connect again and fail", function() {
    client = new Paho.Client(testServer, testPort, testPath, "testclientid-js");
    let exception = false;
    expect(client).not.toBe(null);

  runs(() => client.connect({
      onSuccess: callbacks.onConnectSuccess,
      mqttVersion: testMqttVersion,
      useSSL: testUseSSL
    }));
    waitsFor(() => client.isConnected(), "the client should connect", 5000);
    runs(() => expect(client.isConnected()).toBe(true));

    runs(function() {
      try {
        client.connect({
          onSuccess: callbacks.onConnectSuccess,
          mqttVersion: testMqttVersion,
          useSSL: testUseSSL
        });
      } catch (e) {
        console.log(e.message);
        if (e.message == "AMQJS0011E Invalid state already connected.") {
          exception = true;
        }
      }
    });
    runs(() => expect(exception).toBe(true));
  });

  it("should connect successfully with a 0 length clientid with cleansession true", function() {
    client = new Paho.Client(testServer, testPort, testPath, "");
    expect(client).not.toBe(null);

  runs(() => client.connect({
      cleanSession: true,
      onSuccess: callbacks.onConnectSuccess,
      mqttVersion: testMqttVersion,
      useSSL: testUseSSL
    }));
    waitsFor(() => client.isConnected(), "the client should connect", 5000);
    runs(() => expect(client.isConnected()).toBe(true));

    runs(() => client.disconnect());
    waitsFor(() => true, "the client should disconnect", 5000);
    runs(() => expect(client.isConnected()).toBe(false));
  });

  it("should fail to connect successfully with a 0 length clientid with cleansession false", function() {
    let connectFail = false;
    const failCallback = function() {
      connectFail = true;
    };
    client = new Paho.Client(testServer, testPort, testPath, "");
    expect(client).not.toBe(null);

    runs(() => client.connect({
      cleanSession: false,
      onFailure: failCallback,
      mqttVersion: testMqttVersion,
      useSSL: testUseSSL
    }));
    waitsFor(() => connectFail, "the client should fail to connect", 5000);
    runs(() => expect(client.isConnected()).toBe(false));
  });
  /*
  it('should queue up messages on the server for offline clients', function() {
  	client = new Paho.Client(testServer, testPort, testPath, "testclientid-js");
  	client.on("arrived", callbacks.onMessageArrived);

  	expect(client).not.toBe(null);

  	runs(function() {
  		client.connect({onSuccess: callbacks.onConnectSuccess, mqttVersion:testMqttVersion, cleanSession:false});
  	});
  	waitsFor(function() {
  		return client.isConnected();
  	}, "the client should connect", 5000);
  	runs(function() {
  		expect(client.isConnected()).toBe(true);
  	});

  	runs(function() {
  		client.subscribe(wildtopics[5], {qos:2, onSuccess: callbacks.onSubscribeSuccess});
  	});
  	waitsFor(function() {
  		return subscribed;
  	}, "the client should subscribe", 2000);
  	runs(function() {
  		expect(subscribed).toBe(true);
  	});

  	runs(function() {
  		client.disconnect();
  	});
  	waitsFor(function() {
  		return true;
  	}, "the client should disconnect", 5000);
  	runs(function() {
  		expect(client.isConnected()).toBe(false);
  	});

  	bClient = new Paho.Client(testServer, testPort, testPath, "testclientid-js-b");
  	client.on("delivered", callbacks.onMessageDelivered);

  	runs(function() {
  		bClient.connect({onSuccess: callbacks.onConnectSuccess, mqttVersion:testMqttVersion, cleanSession:true});
  	});
  	waitsFor(function() {
  		return bClient.isConnected();
  	}, "the client should connect again", 5000);
  	runs(function() {
  		expect(bClient.isConnected()).toBe(true);
  	});

  	runs(function (){
  		for (var i = 0; i < 3; i++) {
  			var message = new Paho.Message("qos " + i);
  			message.destinationName = topics[i+1];
  			message.qos=i;
  			bClient.send(message);
  		}
  	});
  	waitsFor(function() {
  		return sendingComplete;
  	}, "the client should send 3 messages", 5000);
  	runs(function() {
  		expect(messagePublishedCount).toBe(3);
  	});

  	runs(function() {
  		bClient.disconnect({onSuccess: callbacks.onDisconnectSuccess});
  	});
  	waitsFor(function() {
  		return connected;
  	}, "the client should disconnect", 5000);
  	runs(function() {
  		expect(bClient.isConnected()).toBe(false);
  	});

  	runs(function() {
  		client.connect({onSuccess: callbacks.onConnectSuccess, mqttVersion:testMqttVersion, cleanSession:false});
  	});
  	waitsFor(function() {
  		return client.isConnected();
  	}, "the client should connect", 5000);
  	runs(function() {
  		expect(client.isConnected()).toBe(true);
  	});
  	waitsFor(function() {
  		return (messageReceivedCount > 1);
  	}, "the client should receive 2/3 messages", 5000);
  	runs(function() {
  		expect(messageReceivedCount).toBeGreaterThan(1);
  	});
  	runs(function() {
  		client.disconnect();
  	});
  	waitsFor(function() {
  		return true;
  	}, "the client should disconnect", 5000);
  	runs(function() {
  		expect(client.isConnected()).toBe(false);
  	});
  });


  // This test has been commented out as it is only valid for a messagesight
  // server and behaviour differs between mqtt server implementations.
  it('should get a return code for failure to subscribe', function() {
  	client = new Paho.Client(testServer, testPort, testPath, "testclientid-js");
  	client.on("arrived", callbacks.onMessageArrived);

  	var subFailed = false;
  	var failSubscribe = function(response) {
  		if (response.errorCode.get(0) == 0x80) {
  			subFailed = true;
  		}
  	}

  	expect(client).not.toBe(null);

  	runs(function() {
  		client.connect({onSuccess: callbacks.onConnectSuccess, mqttVersion:testMqttVersion, cleanSession:true});
  	});
  	waitsFor(function() {
  		return client.isConnected();
  	}, "the client should connect", 5000);
  	runs(function() {
  		expect(client.isConnected()).toBe(true);
  	});

  	runs(function() {
  		client.subscribe(nosubscribetopics[0], {qos:2, onFailure: failSubscribe});
  	});
  	waitsFor(function() {
  		return subFailed;
  	}, "the client should fail to subscribe", 2000);
  	runs(function() {
  		expect(subFailed).toBe(true);
  	});
  });
  */
});
