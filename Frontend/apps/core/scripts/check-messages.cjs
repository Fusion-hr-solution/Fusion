#!/usr/bin/env node
// Core HR's catalogues hold the same keys in every language (@repo/ds's shared check).
const path = require("path");
const { main } = require("@repo/ds/scripts/check-messages.cjs");

main(path.resolve(process.argv[2] ?? path.join(__dirname, "..", "messages")));
