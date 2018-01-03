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
var client = null;
var connected = false;


logMessage("INFO", "Starting Eclipse Paho JavaScript Utility.");

// Things to do as soon as the page loads
document.getElementById("clientIdInput").value = "js-utility-" + makeid();

// called when the client connects
function onConnect(context) {
  // Once a connection has been made, make a subscription and send a message.
  var connectionString = context.invocationContext.host + ":" + context.invocationContext.port + context.invocationContext.path;
  logMessage("INFO", "Connection Success ", "[URI: ", connectionString, ", ID: ", context.invocationContext.clientId, "]");
  var statusSpan = document.getElementById("connectionStatus");
  statusSpan.innerHTML = "Connected to: " + connectionString + " as " + context.invocationContext.clientId;
  connected = true;
  setFormEnabledState(true);
}


function onConnected(reconnect, uri) {
  // Once a connection has been made, make a subscription and send a message.
  logMessage("INFO", "Client Has now connected: [Reconnected: ", reconnect, ", URI: ", uri, "]");
  connected = true;


}

function onFail(context) {
  logMessage("ERROR", "Failed to connect. [Error Message: ", context.errorMessage, "]");
  var statusSpan = document.getElementById("connectionStatus");
  statusSpan.innerHTML = "Failed to connect: " + context.errorMessage;
  connected = false;
  setFormEnabledState(false);
}

// called when the client loses its connection
function onConnectionLost(responseObject) {
  if (responseObject.errorCode !== 0) {
    logMessage("INFO", "Connection Lost. [Error Message: ", responseObject.errorMessage, "]");
  }
  connected = false;
}

// called when a message arrives
function onMessageArrived(message) {
  logMessage("INFO", "Message Recieved: [Topic: ", message.destinationName, ", Payload: ", message.payloadString, ", QoS: ", message.qos, ", Retained: ", message.retained, ", Duplicate: ", message.duplicate, "]");
  var messageTime = new Date().toISOString();
  // Insert into History Table
  var table = document.getElementById("incomingMessageTable").getElementsByTagName("tbody")[0];
  var row = table.insertRow(0);
  row.insertCell(0).innerHTML = message.destinationName;
  row.insertCell(1).innerHTML = safeTagsRegex(message.payloadString);
  row.insertCell(2).innerHTML = messageTime;
  row.insertCell(3).innerHTML = message.qos;


  if (!document.getElementById(message.destinationName)) {
    var lastMessageTable = document.getElementById("lastMessageTable").getElementsByTagName("tbody")[0];
    var newlastMessageRow = lastMessageTable.insertRow(0);
    newlastMessageRow.id = message.destinationName;
    newlastMessageRow.insertCell(0).innerHTML = message.destinationName;
    newlastMessageRow.insertCell(1).innerHTML = safeTagsRegex(message.payloadString);
    newlastMessageRow.insertCell(2).innerHTML = messageTime;
    newlastMessageRow.insertCell(3).innerHTML = message.qos;

  } else {
    // Update Last Message Table
    var lastMessageRow = document.getElementById(message.destinationName);
    lastMessageRow.id = message.destinationName;
    lastMessageRow.cells[0].innerHTML = message.destinationName;
    lastMessageRow.cells[1].innerHTML = safeTagsRegex(message.payloadString);
    lastMessageRow.cells[2].innerHTML = messageTime;
    lastMessageRow.cells[3].innerHTML = message.qos;
  }

}

function connectionToggle() {

  if (connected) {
    disconnect();
  } else {
    connect();
  }


}


function connect() {
  var hostname = document.getElementById("hostInput").value;
  var port = document.getElementById("portInput").value;
  var clientId = document.getElementById("clientIdInput").value;

  var path = document.getElementById("pathInput").value;
  var user = document.getElementById("userInput").value;
  var pass = document.getElementById("passInput").value;
  var keepAlive = Number(document.getElementById("keepAliveInput").value);
  var timeout = Number(document.getElementById("timeoutInput").value);
  var tls = document.getElementById("tlsInput").checked;
  var automaticReconnect = document.getElementById("automaticReconnectInput").checked;
  var cleanSession = document.getElementById("cleanSessionInput").checked;
  var lastWillTopic = document.getElementById("lwtInput").value;
  var lastWillQos = Number(document.getElementById("lwQosInput").value);
  var lastWillRetain = document.getElementById("lwRetainInput").checked;
  var lastWillMessageVal = document.getElementById("lwMInput").value;


  if (path.length > 0) {
    client = new Paho.Client(hostname, Number(port), path, clientId);
  } else {
    client = new Paho.Client(hostname, Number(port), clientId);
  }
  logMessage("INFO", "Connecting to Server: [Host: ", hostname, ", Port: ", port, ", Path: ", client.path, ", ID: ", clientId, "]");

  // set callback handlers
  client.onConnectionLost = onConnectionLost;
  client.onMessageArrived = onMessageArrived;
  client.onConnected = onConnected;


  var options = {
    invocationContext: { host: hostname, port: port, path: client.path, clientId: clientId },
    timeout: timeout,
    keepAliveInterval: keepAlive,
    cleanSession: cleanSession,
    useSSL: tls,
    reconnect: automaticReconnect,
    onSuccess: onConnect,
    onFailure: onFail
  };



  if (user.length > 0) {
    options.userName = user;
  }

  if (pass.length > 0) {
    options.password = pass;
  }

  if (lastWillTopic.length > 0) {
    var lastWillMessage = new Paho.Message(lastWillMessageVal);
    lastWillMessage.destinationName = lastWillTopic;
    lastWillMessage.qos = lastWillQos;
    lastWillMessage.retained = lastWillRetain;
    options.willMessage = lastWillMessage;
  }

  // connect the client
  client.connect(options);
  var statusSpan = document.getElementById("connectionStatus");
  statusSpan.innerHTML = "Connecting...";
}

function disconnect() {
  logMessage("INFO", "Disconnecting from Server.");
  client.disconnect();
  var statusSpan = document.getElementById("connectionStatus");
  statusSpan.innerHTML = "Connection - Disconnected.";
  connected = false;
  setFormEnabledState(false);

}

// Sets various form controls to either enabled or disabled
function setFormEnabledState(enabled) {

  // Connection Panel Elements
  if (enabled) {
    document.getElementById("clientConnectButton").innerHTML = "Disconnect";
  } else {
    document.getElementById("clientConnectButton").innerHTML = "Connect";
  }
  document.getElementById("hostInput").disabled = enabled;
  document.getElementById("portInput").disabled = enabled;
  document.getElementById("clientIdInput").disabled = enabled;
  document.getElementById("pathInput").disabled = enabled;
  document.getElementById("userInput").disabled = enabled;
  document.getElementById("passInput").disabled = enabled;
  document.getElementById("keepAliveInput").disabled = enabled;
  document.getElementById("timeoutInput").disabled = enabled;
  document.getElementById("tlsInput").disabled = enabled;
  document.getElementById("automaticReconnectInput").disabled = enabled;
  document.getElementById("cleanSessionInput").disabled = enabled;
  document.getElementById("lwtInput").disabled = enabled;
  document.getElementById("lwQosInput").disabled = enabled;
  document.getElementById("lwRetainInput").disabled = enabled;
  document.getElementById("lwMInput").disabled = enabled;

  // Publish Panel Elements
  document.getElementById("publishTopicInput").disabled = !enabled;
  document.getElementById("publishQosInput").disabled = !enabled;
  document.getElementById("publishMessageInput").disabled = !enabled;
  document.getElementById("publishButton").disabled = !enabled;
  document.getElementById("publishRetainInput").disabled = !enabled;

  // Subscription Panel Elements
  document.getElementById("subscribeTopicInput").disabled = !enabled;
  document.getElementById("subscribeQosInput").disabled = !enabled;
  document.getElementById("subscribeButton").disabled = !enabled;
  document.getElementById("unsubscribeButton").disabled = !enabled;

}

function publish() {
  var topic = document.getElementById("publishTopicInput").value;
  var qos = document.getElementById("publishQosInput").value;
  var message = document.getElementById("publishMessageInput").value;
  var retain = document.getElementById("publishRetainInput").checked;
  logMessage("INFO", "Publishing Message: [Topic: ", topic, ", Payload: ", message, ", QoS: ", qos, ", Retain: ", retain, "]");
  message = new Paho.Message(message);
  message.destinationName = topic;
  message.qos = Number(qos);
  message.retained = retain;
  client.send(message);
}


function subscribe() {
  var topic = document.getElementById("subscribeTopicInput").value;
  var qos = document.getElementById("subscribeQosInput").value;
  logMessage("INFO", "Subscribing to: [Topic: ", topic, ", QoS: ", qos, "]");
  client.subscribe(topic, { qos: Number(qos) });
}

function unsubscribe() {
  var topic = document.getElementById("subscribeTopicInput").value;
  logMessage("INFO", "Unsubscribing: [Topic: ", topic, "]");
  client.unsubscribe(topic, {
    onSuccess: unsubscribeSuccess,
    onFailure: unsubscribeFailure,
    invocationContext: { topic: topic }
  });
}


function unsubscribeSuccess(context) {
  logMessage("INFO", "Unsubscribed. [Topic: ", context.invocationContext.topic, "]");
}

function unsubscribeFailure(context) {
  logMessage("ERROR", "Failed to unsubscribe. [Topic: ", context.invocationContext.topic, ", Error: ", context.errorMessage, "]");
}

function clearHistory() {
  var table = document.getElementById("incomingMessageTable");
  //or use :  var table = document.all.tableid;
  for (var i = table.rows.length - 1; i > 0; i--) {
    table.deleteRow(i);
  }

}


// Just in case someone sends html
function safeTagsRegex(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").
    replace(/>/g, "&gt;");
}

function makeid() {
  var text = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (var i = 0; i < 5; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

function logMessage(type, ...content) {
  var consolePre = document.getElementById("consolePre");
  var date = new Date();
  var timeString = date.toUTCString();
  var logMessage = timeString + " - " + type + " - " + content.join("");
  consolePre.innerHTML += logMessage + "\n";
  if (type === "INFO") {
    console.info(logMessage);
  } else if (type === "ERROR") {
    console.error(logMessage);
  } else {
    console.log(logMessage);
  }
}

