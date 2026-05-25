'use strict';

const fs = require('fs');
const path = require('path');
const { BinaryReader, cipherName, hashData } = require('./binary');
const { MAX_KNOWN_VERSION } = require('./codec');

/**
 * Analyze an items.dat file and report its structure.
 * Works with ANY version — known or unknown.
 * For unknown versions, it detects new fields and explains what was added.
 */

const args = process.argv.slice(2);

if (args.length < 1) {
  console.log('Usage: node analyze.js <items.dat>');
  console.log('');
  console.log('Analyzes items.dat structure and reports:');
  console.log('  - Version and item count');
  console.log('  - File hash (for OnSuperMainStart)');
  console.log('  - Known fields and their offsets');
  console.log('  - NEW/unknown fields added in newer versions');
  console.log('  - Byte patterns and likely data types of new fields');
  console.log('');
  console.log('Works with ANY items.dat version, even unreleased ones.');
  process.exit(1);
}

const inputFile = args[0];
if (!fs.existsSync(inputFile)) {
  console.error(`Error: file not found: ${inputFile}`);
  process.exit(1);
}

const buffer = fs.readFileSync(inputFile);
const r = new BinaryReader(buffer);

const version = r.uint16();
const itemCount = r.uint32();
const hash = hashData(buffer);

console.log('');
console.log('=== items.dat Analysis ===');
console.log('');
console.log(`  File          : ${path.basename(inputFile)}`);
console.log(`  Size          : ${(buffer.length / 1024 / 1024).toFixed(2)} MB (${buffer.length} bytes)`);
console.log(`  Version       : ${version}`);
console.log(`  Item Count    : ${itemCount}`);
console.log(`  Hash          : ${hash}`);
console.log(`  Known Version : ${version <= MAX_KNOWN_VERSION ? 'YES (fully supported)' : `NO (latest known: v${MAX_KNOWN_VERSION})`}`);
console.log('');

// Parse first item tracking byte positions
function parseItemMeasured(r, ver) {
  const positions = [];
  const track = (name) => { positions.push({ name, offset: r.pos }); };

  track('id');            const id = r.uint32();
  track('flags');         r.uint16();
  track('type');          r.uint8();
  track('material');      r.uint8();
  track('name');          const rawName = r.string();
  track('textureFile');   r.string();
  track('textureHash');   r.uint32();
  track('visualEffect');  r.uint8();
  track('cookingTime');   r.int32();
  track('textureX');      r.uint8();
  track('textureY');      r.uint8();
  track('spreadType');    r.uint8();
  track('layer');         r.int8();
  track('collisionType'); r.uint8();
  track('hp');            r.uint8();
  track('restoreTime');   r.int32();
  track('bodyPart');      r.uint8();
  track('rarity');        r.int16();
  track('maxCanHold');    r.uint8();
  track('extraFile');     r.string();
  track('extraFileHash'); r.uint32();
  track('animMS');        r.int32();

  if (ver > 3) {
    track('petName');     r.string();
    track('petSubName');  r.string();
    track('petEndName');  r.string();
  }
  if (ver > 4) {
    track('petPowerName'); r.string();
  }

  track('seedBg');        r.uint8();
  track('seedFg');        r.uint8();
  track('treeBg');        r.uint8();
  track('treeFg');        r.uint8();
  track('seedBgColor');   r.uint32();
  track('seedFgColor');   r.uint32();
  track('seed1');         r.uint16();
  track('seed2');         r.uint16();
  track('growTime');       r.uint32();

  if (ver > 6) {
    track('fxFlags');     r.uint32();
    track('multiAnim1');  r.string();
  }
  if (ver > 7) {
    track('overlayTexture'); r.string();
    track('multiAnim2');  r.string();
    track('dualAnimX');   r.int32();
    track('dualAnimY');   r.int32();
  }
  if (ver > 8) {
    track('flags2');      r.uint32();
    track('clientData[15]'); for (let i = 0; i < 15; i++) r.int32();
  }
  if (ver > 9) {
    track('tileRange');   r.uint32();
    track('pileSize');    r.uint32();
  }
  if (ver > 10) {
    track('punchParameters'); r.string();
  }
  if (ver > 11) {
    track('extraSlotCounter'); r.uint32();
    track('extraSlotBodyParts[9]'); for (let i = 0; i < 9; i++) r.uint8();
  }
  if (ver > 12) {
    track('lightSourceRange'); r.uint32();
  }
  if (ver > 13) {
    track('variantVersionItem'); r.uint32();
  }
  if (ver > 14) {
    track('chairEnabled'); r.uint8();
    track('chairPlayerOffsetX'); r.int32();
    track('chairPlayerOffsetY'); r.int32();
    track('chairArmPosX'); r.int32();
    track('chairArmPosY'); r.int32();
    track('chairArmOffsetX'); r.int32();
    track('chairArmOffsetY'); r.int32();
    track('chairArmTexture'); r.string();
  }
  if (ver > 15) {
    track('configName');  r.string();
  }
  if (ver > 16) {
    track('otherPlayerHitParticle'); r.int32();
  }
  if (ver > 17) {
    track('configNameHash'); r.uint32();
  }
  if (ver > 18) {
    track('randomSpriteEnabled'); r.uint8();
    track('randomSpriteOffsetMod'); r.int32();
    track('randomSpriteChance'); r.float32();
  }
  if (ver > 19) {
    track('hiddenPartsFlags'); r.uint8();
  }
  if (ver > 20) {
    track('canTransform'); r.uint8();
  }
  if (ver > 21) {
    track('description'); r.string();
  }
  if (ver > 22) {
    track('spliceSeed1'); r.uint16();
    track('spliceSeed2'); r.uint16();
  }
  if (ver > 23) {
    track('slipperyType'); r.uint8();
  }
  if (ver > 24) {
    track('unknownStr_v25'); r.string();
    track('unknownInt_v25'); r.uint32();
  }
  if (ver > 25) {
    track('unknownByte_v26'); r.uint8();
  }

  track('END_OF_KNOWN_FIELDS');

  return { id, positions, endPos: r.pos, name: version >= 3 ? cipherName(rawName, id) : rawName };
}

// Parse first few items with known version to measure known field size
const parseVersion = Math.min(version, MAX_KNOWN_VERSION);

// Save position after header
const headerEnd = r.pos;

// Parse item 0
const item0Start = r.pos;
const item0 = parseItemMeasured(r, parseVersion);
const item0KnownEnd = r.pos;

// Now find where item 1 starts (item 1 should have id == 1)
let item1Start = null;
let unknownBytesPerItem = 0;

if (itemCount > 1) {
  // Scan for next item ID (should be 1)
  const scanFrom = item0KnownEnd;
  const maxScan = Math.min(scanFrom + 4096, buffer.length - 10);

  for (let probe = scanFrom; probe <= maxScan; probe++) {
    const val = buffer.readUInt32LE(probe);
    if (val === 1) {
      // Verify: check name length at probe+8 is reasonable
      const nameLen = buffer.readUInt16LE(probe + 8);
      const flags = buffer.readUInt16LE(probe + 4);
      if (nameLen > 0 && nameLen < 200 && flags < 0x8000) {
        item1Start = probe;
        break;
      }
    }
  }

  if (item1Start !== null) {
    unknownBytesPerItem = item1Start - item0KnownEnd;
  }
}

// Report known fields
const knownSize = item0KnownEnd - item0Start;
const totalItemSize = item1Start !== null ? (item1Start - item0Start) : knownSize;

console.log('=== Item Structure ===');
console.log('');
console.log(`  Known fields size   : ${knownSize} bytes (per item 0)`);
console.log(`  Actual item size    : ${totalItemSize} bytes (per item 0)`);
console.log(`  Unknown extra bytes : ${unknownBytesPerItem} bytes per item`);
console.log('');

if (version <= MAX_KNOWN_VERSION) {
  console.log(`  Status: Version ${version} is fully supported. All fields are known.`);
  console.log('');
} else {
  console.log(`  Status: Version ${version} is NEWER than supported (v${MAX_KNOWN_VERSION}).`);
  console.log(`  This version adds ${unknownBytesPerItem} new bytes per item after known fields.`);
  console.log('');

  if (unknownBytesPerItem > 0) {
    console.log('=== Unknown Field Analysis ===');
    console.log('');
    console.log(`  New data starts at byte offset ${knownSize} within each item.`);
    console.log(`  Total new bytes per item: ${unknownBytesPerItem}`);
    console.log('');

    // Read the unknown bytes from first few items and analyze patterns
    const samples = [];
    const sampleCount = Math.min(10, itemCount);

    // Re-parse to collect unknown bytes from multiple items
    const r2 = new BinaryReader(buffer);
    r2.pos = headerEnd;

    for (let i = 0; i < sampleCount; i++) {
      // Skip known fields
      const startP = r2.pos;
      parseItemMeasured(r2, parseVersion);
      // Read unknown bytes
      if (unknownBytesPerItem > 0) {
        const raw = r2.bytes(unknownBytesPerItem);
        samples.push(raw);
      }
    }

    // Analyze byte patterns
    console.log('  Byte-by-byte analysis (first 10 items):');
    console.log('');
    console.log(`  ${'Offset'.padEnd(8)}${'Likely Type'.padEnd(16)}${'Sample Values'.padEnd(50)}${'Notes'}`);
    console.log(`  ${'------'.padEnd(8)}${'----------'.padEnd(16)}${'-------------'.padEnd(50)}${'-----'}`);

    let offset = 0;
    while (offset < unknownBytesPerItem) {
      // Try to detect the field type by looking at patterns across samples
      const remaining = unknownBytesPerItem - offset;

      // Check if it looks like a string (uint16 length prefix)
      if (remaining >= 2) {
        const lengths = samples.map(s => s.readUInt16LE(offset));
        const allReasonableStringLen = lengths.every(l => l < 500);
        const anyNonZero = lengths.some(l => l > 0);

        if (allReasonableStringLen && anyNonZero) {
          // Check if all samples have consistent string-like data after the length
          const firstLen = lengths[0];
          if (firstLen > 0 && remaining >= 2 + firstLen) {
            const strBytes = samples[0].slice(offset + 2, offset + 2 + firstLen);
            const isPrintable = strBytes.every(b => b >= 32 && b < 127);
            if (isPrintable) {
              const strVal = strBytes.toString('latin1');
              const otherLens = lengths.slice(1, 5).join(', ');
              console.log(`  ${('+' + offset).padEnd(8)}${'string'.padEnd(16)}${(`len=${firstLen} "${strVal.slice(0, 30)}"`).padEnd(50)}other lens: ${otherLens}`);
              // Skip past this string in all samples (variable length)
              // For analysis, just skip the first sample's length
              offset += 2 + firstLen;
              continue;
            }
          }
        }
      }

      // Check if it looks like uint32
      if (remaining >= 4) {
        const vals32 = samples.map(s => s.readUInt32LE(offset));
        const vals16 = samples.map(s => s.readUInt16LE(offset));
        const vals8 = samples.map(s => s.readUInt8(offset));
        const floats = samples.map(s => s.readFloatLE(offset));

        // Check float pattern (reasonable game values: -10000 to 10000, not NaN/Inf)
        const allValidFloat = floats.every(f => !isNaN(f) && isFinite(f) && Math.abs(f) < 100000);
        const floatHasDecimals = floats.some(f => f !== 0 && f % 1 !== 0);

        // Check if all zeros
        const allZero32 = vals32.every(v => v === 0);
        const allZero8 = vals8.every(v => v === 0);

        // Check uint8 pattern (all values 0-255 and mostly small)
        const allSmall8 = vals8.every(v => v <= 20);

        if (remaining >= 4 && allValidFloat && floatHasDecimals) {
          const sampleStr = floats.slice(0, 5).map(f => f.toFixed(2)).join(', ');
          console.log(`  ${('+' + offset).padEnd(8)}${'float32'.padEnd(16)}${sampleStr.padEnd(50)}likely float field`);
          offset += 4;
        } else if (allZero32 && remaining >= 4) {
          // Could be uint32 or multiple uint8s — check next bytes too
          const next4AllZero = remaining >= 8 && samples.every(s => s.readUInt32LE(offset + 4) === 0);
          if (next4AllZero) {
            console.log(`  ${('+' + offset).padEnd(8)}${'uint32'.padEnd(16)}${'0, 0, 0, ...'.padEnd(50)}all zeros (padding or unused)`);
            offset += 4;
          } else {
            console.log(`  ${('+' + offset).padEnd(8)}${'uint32'.padEnd(16)}${'0, 0, 0, ...'.padEnd(50)}all zeros`);
            offset += 4;
          }
        } else if (allSmall8 && remaining >= 1) {
          const sampleStr = vals8.slice(0, 10).join(', ');
          console.log(`  ${('+' + offset).padEnd(8)}${'uint8'.padEnd(16)}${sampleStr.padEnd(50)}small values (flag/enum?)`);
          offset += 1;
        } else if (remaining >= 4) {
          const sampleStr = vals32.slice(0, 5).join(', ');
          const max = Math.max(...vals32);
          const note = max > 0xFFFF ? 'large values (hash/color?)' : max > 0xFF ? 'uint16 or uint32' : 'small uint32';
          console.log(`  ${('+' + offset).padEnd(8)}${'uint32'.padEnd(16)}${sampleStr.padEnd(50)}${note}`);
          offset += 4;
        } else {
          const sampleStr = vals8.slice(0, 10).join(', ');
          console.log(`  ${('+' + offset).padEnd(8)}${'uint8'.padEnd(16)}${sampleStr.padEnd(50)}`);
          offset += 1;
        }
      } else {
        // Less than 4 bytes remaining
        const vals = samples.map(s => s.readUInt8(offset));
        const sampleStr = vals.slice(0, 10).join(', ');
        console.log(`  ${('+' + offset).padEnd(8)}${'uint8'.padEnd(16)}${sampleStr.padEnd(50)}`);
        offset += 1;
      }
    }

    console.log('');
    console.log('  Interpretation:');
    console.log(`  - Version ${version} added ${unknownBytesPerItem} bytes after the last known field (v${MAX_KNOWN_VERSION}).`);
    console.log(`  - The table above shows likely data types based on value patterns.`);
    console.log(`  - "string" = uint16 length prefix + chars`);
    console.log(`  - "uint32" = 4-byte unsigned integer`);
    console.log(`  - "float32" = 4-byte IEEE 754 float`);
    console.log(`  - "uint8" = single byte (flag, enum, bool)`);
    console.log('');
    console.log('  The decode/encode tools will preserve these bytes as _unknownTrailingData (base64).');
    console.log('  You can still edit all known fields without breaking the file.');
  }
}

// Show first 3 items as sample
console.log('');
console.log('=== Sample Items (first 3) ===');
console.log('');

const r3 = new BinaryReader(buffer);
r3.pos = headerEnd;

for (let i = 0; i < Math.min(3, itemCount); i++) {
  const parsed = parseItemMeasured(r3, parseVersion);
  if (unknownBytesPerItem > 0) r3.skip(unknownBytesPerItem);
  console.log(`  [${parsed.id}] ${parsed.name}`);
}

console.log('');
console.log('=== Summary ===');
console.log('');
console.log(`  Use this hash for OnSuperMainStart: ${hash}`);
if (version > MAX_KNOWN_VERSION) {
  console.log(`  This file uses version ${version} — decode/encode will work but new fields are stored as raw bytes.`);
  console.log(`  Run "node decode.js ${path.basename(inputFile)}" to get editable JSON.`);
} else {
  console.log(`  This file is fully supported. Run "node decode.js ${path.basename(inputFile)}" to convert to JSON.`);
}
console.log('');
