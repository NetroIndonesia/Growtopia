'use strict';

const fs = require('fs');
const path = require('path');
const { encode } = require('./codec');
const { hashData } = require('./binary');

const args = process.argv.slice(2);

if (args.length < 1) {
  console.log('Usage: node encode.js <items.json> [output.dat]');
  console.log('');
  console.log('Encodes JSON back into items.dat binary format.');
  console.log('Preserves the original version from the JSON file.');
  console.log('');
  console.log('Examples:');
  console.log('  node encode.js items.json');
  console.log('  node encode.js items.json items_modified.dat');
  process.exit(1);
}

const inputFile = args[0];
const outputFile = args[1] || path.basename(inputFile, path.extname(inputFile)) + '.dat';

if (!fs.existsSync(inputFile)) {
  console.error(`Error: file not found: ${inputFile}`);
  process.exit(1);
}

console.error(`Reading ${inputFile}...`);
const raw = fs.readFileSync(inputFile, 'utf8');

let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error(`Error: invalid JSON: ${e.message}`);
  process.exit(1);
}

if (!data.version || !data.items || !Array.isArray(data.items)) {
  console.error('Error: JSON must have { version, items[] } structure.');
  console.error('Use the output from decode.js as input.');
  process.exit(1);
}

console.error(`Version: ${data.version}, Items: ${data.items.length}`);
console.error(`Encoding...`);

const buffer = encode(data);

fs.writeFileSync(outputFile, buffer);
const hash = hashData(buffer);

console.error(`Output: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
console.error(`Hash: ${hash}`);
console.log(`Encoded ${data.items.length} items (version ${data.version}) -> ${outputFile}`);
console.log(`Use this hash in OnSuperMainStart: ${hash}`);
