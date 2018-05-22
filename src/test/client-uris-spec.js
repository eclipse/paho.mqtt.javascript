/* eslint-disable no-console */
const settings = require("./client-harness");

const testMqttVersion = settings.mqttVersion,
      testPath        = settings.path,
      testPort        = settings.port,
      testServer      = settings.server,
      testUseSSL      = settings.useSSL;

describe("client-uris", function() {
  let connected = false,
      disconnectError = null;

  function onConnect() {
    console.log("connected");
    disconnectError = null;
    connected = true;
  }

  function onDisconnect(err) {
    console.log("disconnected");
    disconnectError = err;
    connected = false;
  }

  function messageArrived() {
    console.log("messageArrived");
    // messageReceived = true;
    //reponse.invocationContext.onMessageArrived = null;
  }

  it("should create a new client with a default path", function() {
    const client = new Paho.Client(testServer, testPort, "testclientid");

    expect(client).not.toBe(null);
    expect(client.host).toBe(testServer);
    expect(client.port).toBe(testPort);
    expect(client.path).toBe("/mqtt");

  });

  it("should create a new client with a path", function() {
    const client = new Paho.Client(testServer, testPort, testPath, "testclientid");

    expect(client).not.toBe(null);
    expect(client.host).toBe(testServer);
    expect(client.port).toBe(testPort);
    expect(client.path).toBe(testPath);
  });

  it("should create a new client with a uri", function() {
    const client = new Paho.Client("ws://" + testServer + ":" + testPort + testPath, "testclientid");

    expect(client).not.toBe(null);
    expect(client.host).toBe(testServer);
    expect(client.port).toBe(testPort);
    expect(client.path).toBe(testPath);
  });

  it("should fail to create a new client with an invalid ws uri", function() {
    let client = null;
    let error;
    try {
      client = new Paho.Client("http://example.com", "testclientid");
    } catch (err) {
      error = err;
    }
    expect(client).toBe(null);
    expect(error).not.toBe(null);
  });

  /*
	// We don't yet expose setting the path element with the arrays of hosts/ports
	// If you want a path other than /mqtt, you need to use the array of hosts-as-uris.
	// Leaving this test here to remember this fact in case we add an array of paths to connopts
	it('should connect and disconnect to a server using connectoptions hosts and ports', function() {
        client = new Paho.Client(testServer, testPort, "testclientid");
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
	*/

  it("should connect and disconnect to a server using connectoptions hosts", function() {
    const client = new Paho.Client(testServer, testPort, "testclientid");
    expect(client).not.toBe(null);

    client.onMessageArrived = messageArrived;
    client.onConnectionLost = onDisconnect;

    runs(() => client.connect({
      onSuccess: onConnect,
      hosts: ["ws://" + testServer + ":" + testPort + testPath],
      mqttVersion: testMqttVersion,
      useSSL: testUseSSL
    }));

    waitsFor(() => connected, "the client should connect", 10000);

    runs(() => expect(connected).toBe(true));
    runs(() => client.disconnect());
    waitsFor(() => !connected, "the client should disconnect", 1000);
    runs(function() {
      expect(connected).toBe(false);
      expect(disconnectError).not.toBe(null);
      expect(disconnectError.errorCode).toBe(0);
    });
  });

});
