'use strict';

const fs = require('fs');
const path = require('path');
const { decode } = require('./codec');
const { hashData } = require('./binary');

const args = process.argv.slice(2);

if (args.length < 1) {
  console.log('Usage: node decode.js <items.dat> [output.json]');
  console.log('');
  console.log('Decodes items.dat binary into readable JSON.');
  console.log('Auto-detects version (v11-v26).');
  console.log('');
  console.log('Examples:');
  console.log('  node decode.js items.dat');
  console.log('  node decode.js items.dat items.json');
  console.log('  node decode.js items.dat --pretty');
  process.exit(1);
}

const inputFile = args[0];
const pretty = args.includes('--pretty');
const outputFile = args.find(a => a !== inputFile && !a.startsWith('--')) ||
  path.basename(inputFile, path.extname(inputFile)) + '.json';

if (!fs.existsSync(inputFile)) {
  console.error(`Error: file not found: ${inputFile}`);
  process.exit(1);
}

console.error(`Reading ${inputFile}...`);
const buffer = fs.readFileSync(inputFile);
console.error(`File size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
console.error(`File hash: ${hashData(buffer)}`);

const data = decode(buffer);

console.error(`Writing ${outputFile}...`);
const json = JSON.stringify(data, null, pretty ? 2 : undefined);
fs.writeFileSync(outputFile, json, 'utf8');

const outSize = fs.statSync(outputFile).size;
console.error(`Output: ${(outSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`Decoded ${data.itemCount} items (version ${data.version}) -> ${outputFile}`);
