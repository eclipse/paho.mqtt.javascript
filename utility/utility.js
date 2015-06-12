/*******************************************************************************
 * Copyright (c) 2015 IBM Corp.
 *
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v1.0
 * and Eclipse Distribution License v1.0 which accompany this distribution.
 *
 * The Eclipse Public License is available at
 *    http://www.eclipse.org/legal/epl-v10.html
 * and the Eclipse Distribution License is available at
 *   http://www.eclipse.org/org/documents/edl-v10.php.
 *
 * Contributors:
 *    James Sutton - Initial Contribution
 *******************************************************************************/

/*
Eclipse Paho MQTT-JS Utility
This utility can be used to test the Eclipse Paho MQTT Javascript client.
*/

// Create a client instance
client = null;

// called when the client connects
function onConnect(context) {
  // Once a connection has been made, make a subscription and send a message.
  console.log("Client Connected");
  console.log(context);
  var statusSpan = document.getElementById("connectionStatus");
  statusSpan.innerHTML = "Connected to: " + context.invocationContext.host + ':' + context.invocationContext.port + ' as ' + context.invocationContext.clientId;
  setFormEnabledState(true);

}

// called when the client loses its connection
function onConnectionLost(responseObject) {
  if (responseObject.errorCode !== 0) {
    console.log("Connection Lost: "+responseObject.errorMessage);
  }
}

// called when a message arrives
function onMessageArrived(message) {
  console.log('Message Recieved: Topic: ', message.destinationName, '. Payload: ', message.payloadString, '. QoS: ', message.qos);
  console.log(message);
  var messageTime = new Date().toISOString();
  // Insert into History Table
  var table = document.getElementById("incomingMessageTable").getElementsByTagName('tbody')[0];
  var row = table.insertRow(0);
  row.insertCell(0).innerHTML = message.destinationName;
  row.insertCell(1).innerHTML = safe_tags_regex(message.payloadString);
  row.insertCell(2).innerHTML = messageTime;
  row.insertCell(3).innerHTML = message.qos;


  if(!document.getElementById(message.destinationName)){
      var lastMessageTable = document.getElementById("lastMessageTable").getElementsByTagName('tbody')[0];
      var newlastMessageRow = lastMessageTable.insertRow(0);
      newlastMessageRow.id = message.destinationName;
      newlastMessageRow.insertCell(0).innerHTML = message.destinationName;
      newlastMessageRow.insertCell(1).innerHTML = safe_tags_regex(message.payloadString);
      newlastMessageRow.insertCell(2).innerHTML = messageTime;
      newlastMessageRow.insertCell(3).innerHTML = message.qos;

  } else {
      // Update Last Message Table
      var lastMessageRow = document.getElementById(message.destinationName);
      lastMessageRow.id = message.destinationName;
      lastMessageRow.cells[0].innerHTML = message.destinationName;
      lastMessageRow.cells[1].innerHTML = safe_tags_regex(message.payloadString);
      lastMessageRow.cells[2].innerHTML = messageTime;
      lastMessageRow.cells[3].innerHTML = message.qos;
  }

}


function connect(){
    var hostname = document.getElementById("hostnameInput").value;
    var port = document.getElementById("portInput").value;
    var clientId = document.getElementById("clientIdInput").value;

    console.info('Connecting to Server: Hostname: ', hostname, '. Port: ', port, '. Client ID: ', clientId);
    client = new Paho.MQTT.Client(hostname, Number(port), clientId);
    // set callback handlers
    client.onConnectionLost = onConnectionLost;
    client.onMessageArrived = onMessageArrived;

    // connect the client
    client.connect({onSuccess:onConnect,
        invocationContext: {host : hostname, port: port, clientId: clientId}
    });
    var statusSpan = document.getElementById("connectionStatus");
    statusSpan.innerHTML = 'Connecting...';
}

function disconnect(){
    console.info('Disconnecting from Server');
    client.disconnect();
    var statusSpan = document.getElementById("connectionStatus");
    statusSpan.innerHTML = 'Connection - Disconnected.';
    setFormEnabledState(false);
}

// Sets various form controls to either enabled or disabled
function setFormEnabledState(enabled){
    document.getElementById("hostnameInput").disabled = enabled;
    document.getElementById("portInput").disabled = enabled;
    document.getElementById("clientIdInput").disabled = enabled;
    document.getElementById("clientConnectButton").disabled = enabled;
    document.getElementById("clientDisconnectButton").disabled = !enabled;

    document.getElementById("publishTopicInput").disabled = !enabled;
    document.getElementById("publishQosInput").disabled = !enabled;
    document.getElementById("publishMessageInput").disabled = !enabled;
    document.getElementById("publishButton").disabled = !enabled;

    document.getElementById("subscribeTopicInput").disabled = !enabled;
    document.getElementById("subscribeQosInput").disabled = !enabled;
    document.getElementById("subscribeButton").disabled = !enabled;
    document.getElementById("unsubscribeButton").disabled = !enabled;

}

function publish(){
    var topic = document.getElementById("publishTopicInput").value;
    var qos = document.getElementById("publishQosInput").value;
    var message = document.getElementById("publishMessageInput").value;
    console.info('Publishing Message: Topic: ', topic, '. QoS: ' + qos + '. Message: ', message);
    message = new Paho.MQTT.Message(message);
    message.destinationName = topic;
    message.qos = Number(qos);
    client.send(message);
}


function subscribe(){
    var topic = document.getElementById("subscribeTopicInput").value;
    var qos = document.getElementById("subscribeQosInput").value;
    console.info('Subscribing to: Topic: ', topic, '. QoS: ', qos);
    client.subscribe(topic, {qos: Number(qos)});
}

function unsubscribe(){
    var topic = document.getElementById("subscribeTopicInput").value;
    console.info('Unsubscribing from ', topic);
    client.unsubscribe(topic, {
         onSuccess: unsubscribeSuccess,
         onFailure: unsubscribeFailure,
         invocationContext: {topic : topic}
     });
}


function unsubscribeSuccess(context){
    console.info('Successfully unsubscribed from ', context.invocationContext.topic);
}

function unsubscribeFailure(context){
    console.info('Failed to  unsubscribe from ', context.invocationContext.topic);
}

function clearHistory(){
    var table = document.getElementById("incomingMessageTable");
    //or use :  var table = document.all.tableid;
    for(var i = table.rows.length - 1; i > 0; i--)
    {
        table.deleteRow(i);
    }

}


// Just in case someone sends html
function safe_tags_regex(str) {
   return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
