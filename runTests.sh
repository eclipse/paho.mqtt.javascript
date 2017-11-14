#!/bin/bash
# Temporary Script to run tests whilst the tests only work with the old version of Jasmine
./node_modules/jasmine-node/bin/jasmine-node src/test/BasicTest-spec.js
./node_modules/jasmine-node/bin/jasmine-node src/test/base-spec.js
./node_modules/jasmine-node/bin/jasmine-node src/test/client-uris-spec.js
./node_modules/jasmine-node/bin/jasmine-node src/test/interops-spec.js
./node_modules/jasmine-node/bin/jasmine-node src/test/live-take-over-spec.js
./node_modules/jasmine-node/bin/jasmine-node src/test/send-receive-spec.js
