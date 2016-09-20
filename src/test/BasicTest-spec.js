var settings = require('./client-harness');

var testServer = settings.server;
var testPort = settings.port;
var testPath = settings.path;
var testMqttVersion = settings.mqttVersion;

var genStr = function(str){
	var time = new Date();
	return str + '.' + time.getTime();
};

describe('BasicTest', function() {
	//var client = null;
	var clientId = this.description;
	var connected = false;
	var failure = false;
	var disconnectError = null;
	var disconnectErrorMsg = null;

	var subscribed = false;
	var isMessageReceived = false;
	var isMessageDelivered = false;
	var strTopic = '/' + makeid() + '/World';
	var strMessageReceived = '';
	var strMessageSend = 'Hello';
	var strTopicReceived = '';


	function makeid(){
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 5; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
	}

	function onConnectSuccess(responseObj) {
		//console.log("connected %s",responseObj);
		connected = true;
	};

	function onConnectionLost(err) {
		connected = false;
		if(err){
			disconnectError = err.errorCode;
			disconnectErrorMsg = err.errorMessage;
		}
		console.log("connection lost. ErrorCode: %s, ErrorMsg: %s",disconnectError,disconnectErrorMsg);
	};

	function onConnectFailure(err){
		connected = false;
		console.log('Connect fail. ErrorCode: %s, ErrorMsg: %s',err.errCode,err.errorMessage);
	};

	function onSubscribeSuccess() {
		subscribed = true;
		//console.log("subscribed",subscribed);
	};

	function onSubscribeFailure(err) {
		subscribed = false;
		console.log("subscribe fail. ErrorCode: %s, ErrorMsg: %s",err.errCode,err.errorMessage);
	};
	function onUnsubscribeSuccess() {
		subscribed = false;
		//console.log("unsubscribed",subscribed);
	};

	function messageDelivered(response) {
		console.log("messageDelivered. topic:%s, duplicate:%s, payloadString:%s,qos:%s,retained:%s",response.destinationName,response.duplicate,response.payloadString,response.qos,response.retained);
		isMessageDelivered = true;
		//reponse.invocationContext.onMessageArrived = null;
	};

	function messageArrived(message) {
		console.log("messageArrived.",'topic:',message.destinationName,' ;content:',message.payloadString);
		isMessageReceived = true;
		strMessageReceived = message.payloadString;
		strTopicReceived = message.destinationName;

		//reponse.invocationContext.onMessageArrived = null;
	};

	beforeEach(function(){
		connected = false;
		failure = false;
		disconnectError = null;
		disconnectErrorMsg = null;
		//if(!client){
		//	client = new Paho.MQTT.Client(testServer, testPort, clientId);
		//}
	});

	/*afterEach(function(){
		if(client){
			client.disconnect();
		}
	});
	*/
	it('it should create and connect and disconnect to a server.', function() {
		var client = new Paho.MQTT.Client(testServer, testPort, testPath, genStr(clientId));
		client.onConnectionLost = onConnectionLost;
		expect(client).not.toBe(null);


		console.log('Connecting...');
		runs(function() {
			client.connect({onSuccess:onConnectSuccess,onFailure:onConnectFailure,mqttVersion:testMqttVersion});
		});
		waitsFor(function() {
			return connected;
		}, "the client should connect", 2000);
		runs(function() {
			expect(connected).toBe(true);
		});

		console.log('Disconnecting...');
		runs(function() {
			client.disconnect();
		});
		waitsFor(function() {
			return (connected==false);
		}, "the client should disconnect", 2000);
		runs(function() {
			expect(connected).not.toBe(true);
		});

		console.log('Re-Connecting...');
		runs(function() {
			client.connect({onSuccess:onConnectSuccess,mqttVersion:testMqttVersion});
		});

		waitsFor(function() {
			return connected;
		}, "the client should re-connect", 2000);

		runs(function() {
			expect(connected).toBe(true);
		});

	});

	it('it should fallback from MQTTv3.1.1 to v3.1',function(){
		var client = new Paho.MQTT.Client(testServer, testPort, testPath, genStr(clientId));
		client.onConnectionLost = onConnectionLost;
		expect(client).not.toBe(null);

		console.log('Connecting...');
		runs(function() {
			client.connect({onSuccess:onConnectSuccess,onFailure:onConnectFailure,timeout:1});
		});
		waitsFor(function() {
			return connected;
		}, "the client should connect", 4000);
		runs(function() {
			expect(connected).toBe(true);
		});

		console.log('Disconnecting...');
		runs(function() {
			client.disconnect();
		});
		waitsFor(function() {
			return (connected==false);
		}, "the client should disconnect", 2000);
		runs(function() {
			expect(connected).not.toBe(true);
		});
	});

	it('it should connect to a list of server(HA connection).',function(){
		var defaultServer = testServer;
		var defaultPort = testPort;
		var arrHosts = ['localhost',testServer,];
		var arrPorts = [2000,testPort];

		var client = new Paho.MQTT.Client(defaultServer, defaultPort, testPath, genStr(clientId) );
		client.onConnectionLost = onConnectionLost;
		expect(client).not.toBe(null);

		console.log('should connect to a available server from list');
		runs(function() {
			client.connect({
				onSuccess : onConnectSuccess,
				onFailure : onConnectFailure,
				hosts : arrHosts,
				ports : arrPorts,
				mqttVersion: testMqttVersion
			});
		});

		waitsFor(function() {
			return connected;
		}, "the client should connect", 2000);

		runs(function() {
			expect(connected).toBe(true);
			//client.disconnect();
		});

	});


	it('it should publish and subscribe.',function(){

		var client = new Paho.MQTT.Client(testServer, testPort, testPath, genStr(clientId));
		client.onMessageArrived = messageArrived;
		client.onMessageDelivered = messageDelivered;

		runs(function() {
			client.connect({onSuccess:onConnectSuccess,onFailure:onConnectFailure,mqttVersion:testMqttVersion});
		});
		waitsFor(function() {
			return connected;
		}, "the client should connect", 2000);
		runs(function() {
			expect(connected).toBe(true);
		});

		console.log('Subscribe a topic...');
		runs(function() {
			client.subscribe(strTopic, {onSuccess:onSubscribeSuccess,onFailure:onSubscribeFailure});
		});

		waitsFor(function() {
			return subscribed;
		}, "the client should subscribe", 2000);

		runs(function() {
			expect(subscribed).toBe(true);
		});

		console.log('Send and receive message...');
		runs(function() {
			var message = new Paho.MQTT.Message(strMessageSend);
			message.destinationName = strTopic;
			client.send(message);
		});
		waitsFor(function() {
			return isMessageReceived;
		}, "the client should send and receive a message", 2000);
		runs(function() {
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

		console.log('Unsubscribe a topic...');
		runs(function() {
			client.unsubscribe(strTopic, {onSuccess:onUnsubscribeSuccess});
		});
	    waitsFor(function() {
			return !subscribed;
		}, "the client should subscribe", 2000);
		runs(function() {
			expect(subscribed).toBe(false);
			//disconnect
			//client.disconnect();
		});

		//should not receive a message after unsubscribe
		runs(function() {
			//console.log('isMessageReceived',isMessageReceived);
			isMessageDelivered = false;
			isMessageReceived = false;
			strMessageReceived = '';
			strTopicReceived = '';

			var message = new Paho.MQTT.Message(genStr(strMessageSend));
			message.destinationName = strTopic;
			client.send(message);
		})
		waitsFor(function() {
			return isMessageDelivered;
		}, "the client should send and receive a message", 2000);

		runs(function() {
			//to do Check message sent
			expect(isMessageDelivered).toBe(true);
			//Check msg received
			expect(isMessageReceived).toBe(false);
			//Check message
			expect(strMessageReceived).toEqual('');
			//Check topic
			expect(strTopicReceived).toEqual('');

			//disconnect
			//client.disconnect();

		})
	});

	it('check message properties.',function(){
		var strMsg = 'test Msg';
		var strDes = '/test';
		var message = new Paho.MQTT.Message(strMsg);
		message.destinationName = strDes;

		console.log('Check default for message with payload.');
		expect(message.qos).toBe(0);
		expect(message.duplicate).toBe(false);
		expect(message.retained).toBe(false);
		expect(message.payloadString).toEqual(strMsg);
		expect(message.payloadBytes.length).toBeGreaterThan(0);
		expect(message.destinationName).toEqual(strDes);

		console.log('Check empty msg to throw error');
		expect(function(){
			var empMsg = new Paho.MQTT.Message();
		}).toThrow();

		console.log('Check message qos');
		message.qos = 0;
		expect(message.qos).toBe(0);
		message.qos = 1;
		expect(message.qos).toBe(1);
		message.qos = 2;
		expect(message.qos).toBe(2);

		//illegal argument exception
		expect(function(){
			message.qos = -1;
		}).toThrow();
		expect(function(){
			message.qos = 1;
		}).not.toThrow();

		console.log('Check payload');
		var strPayload = 'payload is a string';
		message.payloadString = strPayload;
		console.log('not allowed to set payload');
		expect(message.payloadString).not.toEqual(strPayload);

		console.log('Check retained');
		message.retained = false;
		expect(message.retained).toBe(false);
		message.retained = true;
		expect(message.retained).toBe(true);

		console.log('Check duplicate');
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
		var msg = new Paho.MQTT.Message(buffer);
		console.log(msg.payloadBytes,msg.payloadString);
		*/
	});

});
