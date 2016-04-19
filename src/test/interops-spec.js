var settings = require('./client-harness');

var testServer = settings.interopServer;
var testPort = settings.interopPort;
var testPath = settings.interopPath;
var testMqttVersion = 4;

var genStr = function(str){
	var time = new Date();
	return str + '.' + time.getTime();
};

var topics = ["TopicA", "TopicA/B", "Topic/C", "TopicA/C", "/TopicA"];
var wildtopics = ["TopicA/+", "+/C", "#", "/#", "/+", "+/+", "TopicA/#"];
var nosubscribetopics = ["test/nosubscribe",];

describe('InteropsTests', function() {
	var clientId = this.description;
	var client = null;
	var failure = false;
	var subscribed = false;
	var disconnectError = null;
	var disconnectErrorMsg = null;

	var subscribed = false;
	var messageReceivedCount = 0;
	var messagePublishedCount = 0;
	var sendingComplete = false;
	var receivingComplete = false;

	beforeEach(function(){
		failure = false;
		subscribed = false;
		disconnectError = null;
		disconnectErrorMsg = null;
		messageReceivedCount = 0
		messagePublishedCount = 0;
		sendingComplete = false;
		receivingComplete = false;
	});

	afterEach(function(){
		if (client !== null && client.isConnected()) {
			client.disconnect();
		}
		client = null;
	});

	var callbacks = {
		onConnectionLost: function(err) {
			console.log("connectionLost " + err.errorMessage);
		},
		onMessageArrived: function(message) {
			console.log("messageArrived %s %s %s %s", message.destinationName, message.payloadString, message.qos, message.retained);
			messageReceivedCount++;
			if (messageReceivedCount == 3) {
				receivingComplete = true;
			}
		},
		onConnectSuccess: function(response) {
			connected = true;
		},
		onConnectFailure: function(err) {
			console.log('Connect failed %s %s',err.errCode,err.errorMessage);
		},
		onDisconnectSuccess: function(response) {
			connected = false;
			console.log("Disconnected from server")
		},
		onDisconnectFailure: function(err) {
			console.log('Disconnect failed %s %s',err.errCode,err.errorMessage);
		},
		onMessageDelivered: function(reponse) {
			messagePublishedCount++;
			if (messagePublishedCount == 3) {
				sendingComplete = true;
			}
		},
		onSubscribeSuccess: function() {
			subscribed = true;
		},
	};

	it('should connect, disconnect, subscribe, publish and receive messages', function() {
		client = new Paho.MQTT.Client(testServer, testPort, testPath, "testclientid-js");
		client.onMessageArrived = callbacks.onMessageArrived;
		client.onMessageDelivered = callbacks.onMessageDelivered;

		expect(client).not.toBe(null);

		runs(function() {
			client.connect({onSuccess: callbacks.onConnectSuccess, mqttVersion:testMqttVersion});
		});
		waitsFor(function() {
			return client.isConnected();
		}, "the client should connect", 5000);
		runs(function() {
			expect(client.isConnected()).toBe(true);
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

		runs(function() {
			client.connect({onSuccess: callbacks.onConnectSuccess, mqttVersion:testMqttVersion});
		});
		waitsFor(function() {
			return client.isConnected();
		}, "the client should connect again", 5000);
		runs(function() {
			expect(client.isConnected()).toBe(true);
		});

		runs(function() {
			client.subscribe(topics[0], {qos:2, onSuccess: callbacks.onSubscribeSuccess});
		});
		waitsFor(function() {
			return subscribed;
		}, "the client should subscribe", 2000);
		runs(function() {
			expect(subscribed).toBe(true);
		});

		runs(function (){
			for (var i = 0; i < 3; i++) {
				var message = new Paho.MQTT.Message("qos " + i);
				message.destinationName = topics[0];
				message.qos=i;
				client.send(message);
			}
		});
		waitsFor(function() {
			return sendingComplete;
		}, "the client should send 3 messages", 5000);
		waitsFor(function() {
			return receivingComplete;
		}, "the client should receive 3 messages", 5000);
		runs(function() {
			expect(messagePublishedCount).toBe(3);
			expect(messageReceivedCount).toBe(3)
		});

		runs(function() {
			client.disconnect({onSuccess: callbacks.onDisconnectSuccess});
		});
		waitsFor(function() {
			return connected;
		}, "the client should disconnect", 5000);
		runs(function() {
			expect(client.isConnected()).toBe(false);
		});
	});

	it('should connect, attempt to connect again and fail', function() {
		var exception = false;
		client = new Paho.MQTT.Client(testServer, testPort, testPath, "testclientid-js");
		expect(client).not.toBe(null);

		runs(function() {
			client.connect({onSuccess: callbacks.onConnectSuccess, mqttVersion:testMqttVersion});
		});
		waitsFor(function() {
			return client.isConnected();
		}, "the client should connect", 5000);
		runs(function() {
			expect(client.isConnected()).toBe(true);
		});

		runs(function() {
			try {
				client.connect({onSuccess: callbacks.onConnectSuccess, mqttVersion:testMqttVersion});
			} catch (e) {
				console.log(e.message)
				if (e.message == "AMQJS0011E Invalid state already connected.") {
					exception = true
				}
			}
		});
		runs(function() {
			expect(exception).toBe(true);
		});
	});

	it('should connect successfully with a 0 length clientid with cleansession true', function() {
		client = new Paho.MQTT.Client(testServer, testPort, testPath, "");
		expect(client).not.toBe(null);

		runs(function() {
			client.connect({cleanSession:true, onSuccess: callbacks.onConnectSuccess, mqttVersion:testMqttVersion});
		});
		waitsFor(function() {
			return client.isConnected();
		}, "the client should connect", 5000);
		runs(function() {
			expect(client.isConnected()).toBe(true);
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

	it('should fail to connect successfully with a 0 length clientid with cleansession false', function() {
		var connectFail = false;
		var failCallback = function(err) {
			connectFail = true;
		}
		client = new Paho.MQTT.Client(testServer, testPort, testPath, "");
		expect(client).not.toBe(null);

		runs(function() {
			client.connect({cleanSession:false, onFailure:failCallback, mqttVersion:testMqttVersion});
		});
		waitsFor(function() {
			return connectFail
		}, "the client should fail to connect", 5000);
		runs(function() {
			expect(client.isConnected()).toBe(false);
		});
	});
	/*
	it('should queue up messages on the server for offline clients', function() {
		client = new Paho.MQTT.Client(testServer, testPort, testPath, "testclientid-js");
		client.onMessageArrived = callbacks.onMessageArrived;

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

		bClient = new Paho.MQTT.Client(testServer, testPort, testPath, "testclientid-js-b");
		bClient.onMessageDelivered = callbacks.onMessageDelivered;

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
				var message = new Paho.MQTT.Message("qos " + i);
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
		client = new Paho.MQTT.Client(testServer, testPort, testPath, "testclientid-js");
		client.onMessageArrived = callbacks.onMessageArrived;

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
})
