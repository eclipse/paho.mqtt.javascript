#!/bin/bash
# Temporary Script to run tests whilst the tests only work with the old version of Jasmine
echo "--- BasicTest ---"
./node_modules/jasmine-node/bin/jasmine-node src/test/BasicTest-spec.js --forceexit

echo "--- base-spec ---"
./node_modules/jasmine-node/bin/jasmine-node src/test/base-spec.js --forceexit

echo "--- client-uris ---"
./node_modules/jasmine-node/bin/jasmine-node src/test/client-uris-spec.js --forceexit

echo "--- interops ---"
./node_modules/jasmine-node/bin/jasmine-node src/test/interops-spec.js --forceexit

echo "--- live-take-over ---"
./node_modules/jasmine-node/bin/jasmine-node src/test/live-take-over-spec.js --forceexit

echo "--- send-receive ---"
./node_modules/jasmine-node/bin/jasmine-node src/test/send-receive-spec.js --forceexit
