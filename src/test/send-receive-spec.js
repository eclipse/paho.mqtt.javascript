var settings = require('./client-harness');

var testServer = settings.server;
var testPort = settings.port;
var testPath = settings.path;
var testMqttVersion = settings.mqttVersion;

//define a default clientID
var clientId="testClient1";
	
describe('SendReceive', function() {

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
	
	it('should connect to a server and disconnect from a server', function() {
	    var client= new MqttClient(clientId);
		 
		//connect and verify
		client.connect({mqttVersion:testMqttVersion});
		
		//disconnect and verify
		client.disconnect();	 
	});
	

	it('should pub/sub using largish messages', function() { 
	    var client= new MqttClient(clientId);
		
	    //connect and verify
		client.connect({mqttVersion:testMqttVersion});
		
		//subscribe and verify
		var testTopic="pubsub/topic";
		var subscribedQoS=0;
		client.subscribe(testTopic,subscribedQoS);
	 
		//unsubscribe and verify
		client.unsubscribe(testTopic);
		
		//subscribe again
		client.subscribe(testTopic,subscribedQoS);
		
		//publish a large message to the topic and verify
		var publishQoS=0;
		var payload="";
		var largeSize=10000;
		for(var i=0;i<largeSize;i++){
			 payload+="s";
		}
		client.publish(testTopic,publishQoS,payload);
		
		//receive and verify
		client.receive(testTopic,publishQoS,subscribedQoS,payload);
		
		//disconnect and verify
		client.disconnect();
	});
	
	
	it('should preserve QOS values between publishers and subscribers', function() { 
	    var client= new MqttClient(clientId);
		
	    //connect and verify
		client.connect({mqttVersion:testMqttVersion});
		
		//subscribe and verify
		var testTopics=["pubsub/topic1","pubsub/topic2","pubsub/topic3"];
		var subscribedQoSs=[0,1,2];
		for(var i=0;i<testTopics.length;i++){
		  client.subscribe(testTopics[i],subscribedQoSs[i]);
		}
		
		//publish, receive and verify
		for(var i=0;i<testTopics.length;i++){
		   var payload="msg-"+i;
		   for(var qos=0;qos<3;qos++){
		      client.publish(testTopics[i],qos,payload);
			  //receive and verify
		      client.receive(testTopics[i],qos,subscribedQoSs[i],payload);
		   }
		}
		
		//disconnect and verify
		client.disconnect();
	});
	
	it('should work using multiple publishers and subscribers.', function() { 
	    //topic to publish
	    var topic="multiplePubSub/topic";
		
	    //create publishers and connect
		var publishers=[];
		var publishersNum=2;
		for(var i=0;i<publishersNum;i++){
		   publishers[i]=new MqttClient("publisher-"+i);
		   publishers[i].connect({mqttVersion:testMqttVersion});
		}
		
		//create subscribers and connect
		var subscribedQoS=0;
		var subscribers=[];
		var subscribersNum=10;
		for(var i=0;i<subscribersNum;i++){
		   subscribers[i]=new MqttClient("subscriber-"+i);
		   subscribers[i].connect({mqttVersion:testMqttVersion});
		   subscribers[i].subscribe(topic,subscribedQoS);
		}
		
		//do publish and receive with verify
		var publishQoS=0;
		var pubishMsgNum=10;
		for (var m = 0; m < pubishMsgNum; m++) {
		  var payload="multi-pub-sub-msg-"+m;
		  for(var i=0;i<publishersNum;i++){
		     publishers[i].publish(topic,publishQoS,payload);
			 for(var j=0;j<subscribersNum;j++){
			   subscribers[j].receive(topic,publishQoS,subscribedQoS,payload);
			 }
		  }
		}
	 
		//disconnect publishers and subscribers
		for(var i=0;i<publishersNum;i++){
		  publishers[i].disconnect();
		}
		for(var i=0;i<subscribersNum;i++){
		  subscribers[i].disconnect();
		}
		
	});

	it('should clean up before re-connecting if cleanSession flag is set.', function() { 
	    //connect with cleanSession flag=false and verify
		var client= new MqttClient("client-1");
		client.connect({cleanSession:false,mqttVersion:testMqttVersion});
		
		//subscribe and verify
		var testTopic="cleanSession/topic1";
		var subscribedQoS=0;
		client.subscribe(testTopic,subscribedQoS);
		
		//publish and verify
		var publishQoS=1;
		var payload="cleanSession-msg";
		client.publish(testTopic,publishQoS,payload);
		client.receive(testTopic,publishQoS,subscribedQoS,payload);
		//disconnect
		client.disconnect();
		
		// Send a message from another client, to our durable subscription.
		var anotherClient= new MqttClient("anotherClient-1");
		anotherClient.connect({cleanSession:true,mqttVersion:testMqttVersion});
		anotherClient.subscribe(testTopic,subscribedQoS);
		anotherClient.publish(testTopic,publishQoS,payload);
		anotherClient.receive(testTopic,publishQoS,subscribedQoS,payload);
		anotherClient.disconnect();
		
		//reconnect
		client.connect({cleanSession:true,mqttVersion:testMqttVersion});
		//check no msg is received
		client.receiveNone();
		
		//do another publish and check if msg is received, because subscription should be cancelled
		client.publish(testTopic,publishQoS,payload);
		//check no msg is received
		client.receiveNone();
		//disconnect
		client.disconnect();
	});

	
})
