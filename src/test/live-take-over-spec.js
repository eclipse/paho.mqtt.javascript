var settings = require('./client-harness');

var testServer = settings.server;
var testPort = settings.port;
var testPath = settings.path;
var testMqttVersion = settings.mqttVersion;

describe('LiveTakeOver', function() {

	//*************************************************************************
    // Client wrapper - define a client wrapper to ease testing
	//*************************************************************************
	var MqttClient= function(clientId){
	    var client = new Paho.MQTT.Client(testServer, testPort, testPath, clientId);
		//states
		var connected = false;
	    var subscribed = false;
	    var messageReceived = false;
	    var messageDelivered = false;
	    var receivedMessage = null;
		
		this.states={connected:connected};
		
		//reset all states
		this.resetStates=function(){
		   connected = false;
	       subscribed = false;
	       messageReceived = false;
	       messageDelivered = false;
	       receivedMessage = null;
		};
		
		//callbacks
		var onConnect=function() {
			console.log("%s connected",clientId);
			connected = true;
		};
		
		var onDisconnect=function(response) {
			console.log("%s disconnected",clientId);
			connected = false;
		};

		var onSubscribe=function() {
			console.log("%s subscribed",clientId);
			subscribed = true;
		};
		
		var onUnsubscribe=function() {
			console.log("%s unsubscribed",clientId);
			subscribed = false;
		};

		var onMessageArrived=function(msg) {
			console.log("%s received msg: %s",clientId,msg.payloadString);
			messageReceived = true;
			receivedMessage = msg;
		};
		
		var onMessageDelivered=function(msg){
		   console.log("%s delivered message: %s",clientId,msg.payloadString);
		   messageDelivered=true;
		}
		 
		//set callbacks
		client.onMessageArrived = onMessageArrived;
		client.onConnectionLost = onDisconnect;
		client.onMessageDelivered = onMessageDelivered;
		 
		//functions
		//connect and verify
		this.connect=function(connectOptions){
		    connectOptions = connectOptions || {};
			if(!connectOptions.hasOwnProperty("onSuccess")){
				connectOptions.onSuccess=onConnect;
				connectOptions.mqttVersion=testMqttVersion;
			}
		    runs(function() {
			  client.connect(connectOptions);
		    });

		    waitsFor(function() {
			  return connected;
		    }, "the client should connect", 10000);

			runs(function() {
				expect(connected).toBe(true);
				//reset state
				connected=false;
			});
		};
		
		//disconnect and verify
		this.disconnect=function(){
			runs(function() {
				client.disconnect();
			});

			waitsFor(function() {
				return !connected;
			}, "the client should disconnect", 10000);

			runs(function() {
				expect(connected).not.toBe(true);
			});
	     };
		 
		 //subscribe and verify
		 this.subscribe=function(topic,qos){
			 runs(function() {
				client.subscribe(topic, {qos:qos,onSuccess:onSubscribe});
			});

			waitsFor(function() {
				return subscribed;
			}, "the client should subscribe", 2000);

			runs(function() {
				expect(subscribed).toBe(true);
				//reset state
				subscribed=false;
			});
		};
	
	    //unsubscribe and verify
		this.unsubscribe=function(topic){
			runs(function() {
				client.unsubscribe(topic, {onSuccess:onUnsubscribe});
			});
			
			waitsFor(function() {
				return !subscribed;
			}, "the client should subscribe", 2000);

			runs(function() {
				expect(subscribed).not.toBe(true);
			});
		};
	
		//publish and verify
		this.publish=function(topic,qos,payload){
			runs(function() {
				var message = new Paho.MQTT.Message(payload);
				message.destinationName = topic;
				message.qos=qos;
				client.send(message); 
			})
			
			waitsFor(function() {
				return messageDelivered;
			}, "the client should delivered a message",10000);
			
			runs(function() {
			    //reset state
				messageDelivered=false;
			});
		};
		
		
		//verify no message received
		this.receiveNone=function(){
			waits(2000);
		    runs(function() {
				expect(messageReceived).toBe(false);
				expect(receivedMessage).toBeNull();
		    });
		};
		
		//verify the receive message
		this.receive=function(expectedTopic,publishedQoS,subscribedQoS,expectedPayload){
		
			waitsFor(function() {
				return messageReceived;
			}, "the client should send and receive a message",10000);
			
			runs(function() {
				expect(messageReceived).toBe(true);
				expect(receivedMessage).not.toBeNull();
				expect(receivedMessage.qos).toBe(Math.min(publishedQoS,subscribedQoS));
				expect(receivedMessage.destinationName).toBe(expectedTopic);
				if(typeof expectedPayload === "string"){
				  expect(receivedMessage.payloadString).toEqual(expectedPayload);
				}else{
				  expect(receivedMessage.payloadBytes).toEqual(expectedPayload);
				}
				
				//reset state after each publish
				messageReceived=false;
				receivedMessage=null;
			})
		};
	};
 
    //*************************************************************************
    // Tests
	//*************************************************************************
	
	it('should be taken over by another client for the actively doing work.', function() {
	    var clientId="TakeOverClient1";
		var testTopic="FirstClient/Topic";
		var subscribedQoS=2;
		var publishQoS=1;
		var payload="TakeOverPayload";
		
		//will msg
		var willMessage= new Paho.MQTT.Message("will-payload");
	    willMessage.destinationName = "willTopic";
	    willMessage.qos = 2;
		willMessage.retained=true;
 
		var client1= new MqttClient(clientId);	
		client1.connect({cleanSession:false,willMessage:willMessage,mqttVersion:testMqttVersion});
		
		//subscribe
		client1.subscribe(testTopic, subscribedQoS);
		
		//publish some messwage
		for(var i=0;i<9;i++){
		  client1.publish(testTopic,publishQoS,payload);
		  client1.receive(testTopic,publishQoS,subscribedQoS,payload);
		}
	 
		// Now lets take over the connection  
        // Create a second MQTT client connection with the same clientid. The 
        // server should spot this and kick the first client connection off. 
		var client2= new MqttClient(clientId);
		client2.connect({cleanSession:false,willMessage:willMessage,mqttVersion:testMqttVersion});
	 
	    waitsFor(function() {
				return !client1.states.connected;
		}, "the previous client should be disconnected",10000);
			
		// We should have taken over the first Client's subscription...
	    //Now check we have grabbed his subscription by publishing.
		client2.publish(testTopic,publishQoS,payload);
		client2.receive(testTopic,publishQoS,subscribedQoS,payload);
 
		//disconnect
		client2.disconnect();
	});
	 
	
})
