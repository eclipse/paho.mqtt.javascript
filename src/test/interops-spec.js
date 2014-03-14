var settings = require('./client-harness');

var testServer = settings.server;
var testPort = settings.port;
var testPath = settings.path;
var testMqttVersion = settings.mqttVersion;

var genStr = function(str){
	var time = new Date();
	return str + '.' + time.getTime();
};

var topics = ["TopicA", "TopicA/B", "Topic/C", "TopicA/C", "/TopicA"];
var wildtopics = ["TopicA/+", "+/C", "#", "/#", "/+", "+/+", "TopicA/#"];

describe('InteropsTests', function() {
	var clientId = this.description;
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
		client = new Messaging.Client(testServer, testPort, testPath, "testclientid-js");
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
				var message = new Messaging.Message("qos " + i);
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
		client = new Messaging.Client(testServer, testPort, testPath, "testclientid-js");

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
	})
})