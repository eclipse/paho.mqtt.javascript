Eclipse Paho JavaScript client
==============================

The Paho JavaScript Client is a browser-based library that uses WebSockets to connect
to an MQTT server.

The source of the client is in:

    src/mqttws31.js
    
## Compatibility

The client should work in any browser fully supporting WebSockets, [](http://caniuse.com/websockets) lists browser compatibility.

## Building

Although the client can be used as-is from the `src` directory, a maven build is used to generate a timestamped build as well as a minified version.

To run the build:

    $ mvn

The generated client is put in:

    target/


## Tests

The client uses the [Jasmine](http://jasmine.github.io/) test framework. The tests for the client are in:

    src/tests

To run the tests with maven, use the following command:

    $ mvn test -Dtest.server=messagesight.demos.ibm.com -Dtest.server.port=1883 -Dtest.server.path=/ws

The parameters passed in should be modified to match the broker instance being tested against.
