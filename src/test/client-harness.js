global.window = global;

var WebSocketClient = require('websocket').client;

global.WebSocket = function(wsurl,protocol) {
    var ws = new WebSocketClient();
    var connection;
    var obj = {
        send: function(msg) {
            var nodeBuf = new Buffer(new Uint8Array(msg));
            connection.send(nodeBuf);
        },
        get readyState() { return ws.readyState; }
    };

    ws.binaryType = 'arraybuffer';

    ws.on("connect", function(conn) {
        connection = conn;
        conn.on("error", function (error) {
            console.log("socket error ",error);
            if (obj.onerror) {
                obj.onerror();
            }
        });

        conn.on("close", function(reasonCode, description) {
            console.log("socket closed ",description);
        })

        conn.on("message", function (message) {
            if (message.type === "binary") {
                if (obj.onmessage) {
                    obj.onmessage({data:message.binaryData});
                }
            }
        });
        if (obj.onopen) {
            obj.onopen();
        }
    });
    ws.on('connectFailed', function(error) {
        console.log('Connect Error: ' + error.toString());
        if (obj.onerror) {
            obj.onerror(error);
        }
    });
    ws.connect(wsurl, protocol);
    return obj;
}


var LocalStorage = require('node-localstorage').LocalStorage;
global.localStorage = new LocalStorage('./persistence');

require("../mqttws31");

function ensureValue(prop,value) {
    if (prop == "" || prop[0] == "$") {
        return value;
    }
    return prop;
}

module.exports = {
    server: ensureValue("${test.server}","iot.eclipse.org"),
    port: parseInt(ensureValue("${test.server.port}","80")),
    path: ensureValue("${test.server.path}","/ws"),
    mqttVersion: parseInt(ensureValue("${test.server.mqttVersion}","3")),
    interopServer: ensureValue("${test.interopServer}","iot.eclipse.org"),
    interopPort: parseInt(ensureValue("${test.interopPort}","80")),
    interopPath: ensureValue("${test.interopPath}","/ws")
}
/*
var connection = {
    "hostname" : "localhost",
    "port" : "1883"
};

var broker = new Paho.MQTT.Client(connection.hostname, Number(connection.port), "clientId");
broker.onConnectionLost = onConnectionLost;
broker.onMessageArrived = onMessageArrived;
broker.connect({onSuccess:onConnect,onFailure : onConnectFailure});

function onConnect() {
    console.log("MQTT Broker Connected");
    console.log("broker = ");
    console.log(this);
    var topic = "/hello/world/#";
    broker.subscribe(topic);

    var staticTopic = "/hello/static";
    broker.subscribe(staticTopic);
};
function onConnectFailure() {
    console.log("connect failed");
}
function onConnectionLost(responseObject) {
    console.log("onConnectionLost");
    if (responseObject.errorCode !== 0)
        console.log("onConnectionLost:"+responseObject.errorMessage);
};

function onMessageArrived(msg) {
    console.log("onMessageArrived: " + msg._getDestinationName());
    console.log("MSG : '" + msg._getPayloadString() + "'");
    console.log(msg);
};
*/
