if (typeof module !== 'undefined')
	require('${basedir}/target/src/javascript/mqttws31n.js');
var testServer = "${test.server}";
var testPort = parseInt("${test.server.port}");
var testPath = "${test.server.path}";

describe('client-uris', function() {
	var client = this;
	var connected = false;
	var subscribed = false;
	var disconnectError = null;
	var messageReceived = false;

	function onConnect() {
		console.log("connected");
		disconnectError = null;
		connected = true;
	};
	function onDisconnect(err) {
	    console.log("disconnected");
	    disconnectError = err;
	    connected = false;
	}
	function onSubscribe() {
		console.log("subscribed");
		subscribed = true;
	};

	function messageArrived(response) {
		console.log("messageArrived");
		messageReceived = true;
		//reponse.invocationContext.onMessageArrived = null;
	};

	it('should create a new client with a default path', function() {
		client = new Messaging.Client(testServer, testPort, "testclientid");
		
		expect(client).not.toBe(null);
		expect(client.host).toBe(testServer);
		expect(client.port).toBe(testPort);
		expect(client.path).toBe("/mqtt");
		
	});
	
	it('should create a new client with a path', function() {
		client = new Messaging.Client(testServer, testPort, testPath, "testclientid");

		expect(client).not.toBe(null);
		expect(client.host).toBe(testServer);
		expect(client.port).toBe(testPort);
		expect(client.path).toBe(testPath);
	});
	
	it('should create a new client with a uri', function() {
		client = new Messaging.Client("ws://"+testServer+":"+testPort+testPath, "testclientid");

		expect(client).not.toBe(null);
		expect(client.host).toBe(testServer);
		expect(client.port).toBe(testPort);
		expect(client.path).toBe(testPath);
	});

	it('should fail to create a new client with an invalid ws uri', function() {
        client = null;
        var error;
	    try {
            client = new Messaging.Client("http://example.com", "testclientid");
        } catch(err) {
            error = err;
        }
        expect(client).toBe(null);
        expect(error).not.toBe(null);
	});

	
	it('should connect and disconnect to a server using connectoptions hosts and ports', function() {
        client = new Messaging.Client(testServer, testPort, "testclientid");
        expect(client).not.toBe(null);

		client.onMessageArrived = messageArrived;
        client.onConnectionLost = onDisconnect;
		
		runs(function() {
			client.connect({onSuccess:onConnect,hosts:[testServer],ports:[testPort]});
		});

		waitsFor(function() {
			return connected;
		}, "the client should connect", 10000);

		runs(function() {
			expect(connected).toBe(true);
		});
        runs(function() {
            client.disconnect();
        });
        waitsFor(function() {
            return !connected;
        }, "the client should disconnect",1000);
        runs(function() {
            expect(connected).toBe(false);
            expect(disconnectError).not.toBe(null);
            expect(disconnectError.errorCode).toBe(0);
        });
	});
	
	it('should connect and disconnect to a server using connectoptions hosts', function() {
		
		runs(function() {
			client.connect({onSuccess:onConnect,hosts:["ws://"+testServer+":"+testPort+testPath]});
		});

		waitsFor(function() {
			return connected;
		}, "the client should connect", 10000);

		runs(function() {
			expect(connected).toBe(true);
		});
        runs(function() {
            client.disconnect();
        });
        waitsFor(function() {
            return !connected;
        }, "the client should disconnect",1000);
        runs(function() {
            expect(connected).toBe(false);
            expect(disconnectError).not.toBe(null);
            expect(disconnectError.errorCode).toBe(0);
        });
	});
	
})
