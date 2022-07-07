#!/usr/bin/env  ts-node
import FiatBridge from ".";
const curve = "curve25519";
const func = "square";

console.log(`generating machinecode to function_check.bin for ${curve}-${func}`);
FiatBridge.machinecode(curve, func);
console.log("done.");
