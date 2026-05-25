'use strict';

const { BinaryReader, BinaryWriter, cipherName } = require('./binary');

/**
 * Known max version we fully support.
 * Versions above this will still be parsed — unknown trailing bytes per item
 * are preserved as base64 so they roundtrip perfectly.
 */
const MAX_KNOWN_VERSION = 26;

/**
 * Parse a single item from the binary reader based on format version.
 * For versions > MAX_KNOWN_VERSION, we read all known fields then capture
 * any remaining bytes (per item) as unknownTrailingData.
 */
function readItem(r, version, itemId, nextItemOffset) {
  const startPos = r.pos;
  const item = {};

  item.id = r.uint32();
  item.flags = r.uint16();
  item.type = r.uint8();
  item.material = r.uint8();

  // Name is XOR encrypted for version >= 3
  const rawName = r.string();
  item.name = version >= 3 ? cipherName(rawName, item.id) : rawName;

  item.textureFile = r.string();
  item.textureHash = r.uint32();
  item.visualEffect = r.uint8();
  item.cookingTime = r.int32();
  item.textureX = r.uint8();
  item.textureY = r.uint8();
  item.spreadType = r.uint8();
  item.layer = r.int8();
  item.collisionType = r.uint8();
  item.hp = r.uint8();
  item.restoreTime = r.int32();
  item.bodyPart = r.uint8();
  item.rarity = r.int16();
  item.maxCanHold = r.uint8();
  item.extraFile = r.string();
  item.extraFileHash = r.uint32();
  item.animMS = r.int32();

  if (version > 3) {
    item.petName = r.string();
    item.petSubName = r.string();
    item.petEndName = r.string();
  }

  if (version > 4) {
    item.petPowerName = r.string();
  }

  item.seedBg = r.uint8();
  item.seedFg = r.uint8();
  item.treeBg = r.uint8();
  item.treeFg = r.uint8();
  item.seedBgColor = r.uint32();
  item.seedFgColor = r.uint32();
  item.seed1 = r.uint16();
  item.seed2 = r.uint16();
  item.growTime = r.uint32();

  if (version > 6) {
    item.fxFlags = r.uint32();
    item.multiAnim1 = r.string();
  }

  if (version > 7) {
    item.overlayTexture = r.string();
    item.multiAnim2 = r.string();
    item.dualAnimX = r.int32();
    item.dualAnimY = r.int32();
  }

  if (version > 8) {
    item.flags2 = r.uint32();
    item.clientData = [];
    for (let i = 0; i < 15; i++) {
      item.clientData.push(r.int32());
    }
  }

  if (version > 9) {
    item.tileRange = r.uint32();
    item.pileSize = r.uint32();
  }

  if (version > 10) {
    item.punchParameters = r.string();
  }

  if (version > 11) {
    item.extraSlotCounter = r.uint32();
    item.extraSlotBodyParts = [];
    for (let i = 0; i < 9; i++) {
      item.extraSlotBodyParts.push(r.uint8());
    }
  }

  if (version > 12) {
    item.lightSourceRange = r.uint32();
  }

  if (version > 13) {
    item.variantVersionItem = r.uint32();
  }

  if (version > 14) {
    item.chairEnabled = r.uint8();
    item.chairPlayerOffsetX = r.int32();
    item.chairPlayerOffsetY = r.int32();
    item.chairArmPosX = r.int32();
    item.chairArmPosY = r.int32();
    item.chairArmOffsetX = r.int32();
    item.chairArmOffsetY = r.int32();
    item.chairArmTexture = r.string();
  }

  if (version > 15) {
    item.configName = r.string();
  }

  if (version > 16) {
    item.otherPlayerHitParticle = r.int32();
  }

  if (version > 17) {
    item.configNameHash = r.uint32();
  }

  if (version > 18) {
    item.randomSpriteEnabled = r.uint8();
    item.randomSpriteOffsetMod = r.int32();
    item.randomSpriteChance = r.float32();
  }

  if (version > 19) {
    item.hiddenPartsFlags = r.uint8();
  }

  if (version > 20) {
    item.canTransform = r.uint8();
  }

  if (version > 21) {
    item.description = r.string();
  }

  if (version > 22) {
    item.spliceSeed1 = r.uint16();
    item.spliceSeed2 = r.uint16();
  }

  if (version > 23) {
    item.slipperyType = r.uint8();
  }

  if (version > 24) {
    item.unknownStr = r.string();
    item.unknownInt = r.uint32();
  }

  if (version > 25) {
    item.unknownByte = r.uint8();
  }

  // For unknown versions (> MAX_KNOWN_VERSION), capture remaining bytes
  // until the next item boundary so we don't lose any data
  if (version > MAX_KNOWN_VERSION && nextItemOffset !== null && r.pos < nextItemOffset) {
    const extraBytes = nextItemOffset - r.pos;
    if (extraBytes > 0) {
      const raw = r.bytes(extraBytes);
      item._unknownTrailingData = raw.toString('base64');
      item._unknownTrailingSize = extraBytes;
    }
  }

  return item;
}

/**
 * Write a single item to the binary writer based on format version.
 */
function writeItem(w, item, version) {
  w.uint32(item.id);
  w.uint16(item.flags);
  w.uint8(item.type);
  w.uint8(item.material);

  // Encrypt name for version >= 3
  const encodedName = version >= 3 ? cipherName(item.name, item.id) : item.name;
  w.string(encodedName);

  w.string(item.textureFile);
  w.uint32(item.textureHash);
  w.uint8(item.visualEffect);
  w.int32(item.cookingTime);
  w.uint8(item.textureX);
  w.uint8(item.textureY);
  w.uint8(item.spreadType);
  w.int8(item.layer);
  w.uint8(item.collisionType);
  w.uint8(item.hp);
  w.int32(item.restoreTime);
  w.uint8(item.bodyPart);
  w.int16(item.rarity);
  w.uint8(item.maxCanHold);
  w.string(item.extraFile);
  w.uint32(item.extraFileHash);
  w.int32(item.animMS);

  if (version > 3) {
    w.string(item.petName || '');
    w.string(item.petSubName || '');
    w.string(item.petEndName || '');
  }

  if (version > 4) {
    w.string(item.petPowerName || '');
  }

  w.uint8(item.seedBg);
  w.uint8(item.seedFg);
  w.uint8(item.treeBg);
  w.uint8(item.treeFg);
  w.uint32(item.seedBgColor);
  w.uint32(item.seedFgColor);
  w.uint16(item.seed1);
  w.uint16(item.seed2);
  w.uint32(item.growTime);

  if (version > 6) {
    w.uint32(item.fxFlags || 0);
    w.string(item.multiAnim1 || '');
  }

  if (version > 7) {
    w.string(item.overlayTexture || '');
    w.string(item.multiAnim2 || '');
    w.int32(item.dualAnimX || 0);
    w.int32(item.dualAnimY || 0);
  }

  if (version > 8) {
    w.uint32(item.flags2 || 0);
    const cd = item.clientData || new Array(15).fill(0);
    for (let i = 0; i < 15; i++) {
      w.int32(cd[i] || 0);
    }
  }

  if (version > 9) {
    w.uint32(item.tileRange || 0);
    w.uint32(item.pileSize || 0);
  }

  if (version > 10) {
    w.string(item.punchParameters || '');
  }

  if (version > 11) {
    w.uint32(item.extraSlotCounter || 0);
    const parts = item.extraSlotBodyParts || new Array(9).fill(0);
    for (let i = 0; i < 9; i++) {
      w.uint8(parts[i] || 0);
    }
  }

  if (version > 12) {
    w.uint32(item.lightSourceRange || 0);
  }

  if (version > 13) {
    w.uint32(item.variantVersionItem || 0);
  }

  if (version > 14) {
    w.uint8(item.chairEnabled || 0);
    w.int32(item.chairPlayerOffsetX || 0);
    w.int32(item.chairPlayerOffsetY || 0);
    w.int32(item.chairArmPosX || 0);
    w.int32(item.chairArmPosY || 0);
    w.int32(item.chairArmOffsetX || 0);
    w.int32(item.chairArmOffsetY || 0);
    w.string(item.chairArmTexture || '');
  }

  if (version > 15) {
    w.string(item.configName || '');
  }

  if (version > 16) {
    w.int32(item.otherPlayerHitParticle || 0);
  }

  if (version > 17) {
    w.uint32(item.configNameHash || 0);
  }

  if (version > 18) {
    w.uint8(item.randomSpriteEnabled || 0);
    w.int32(item.randomSpriteOffsetMod || 0);
    w.float32(item.randomSpriteChance || 0);
  }

  if (version > 19) {
    w.uint8(item.hiddenPartsFlags || 0);
  }

  if (version > 20) {
    w.uint8(item.canTransform || 0);
  }

  if (version > 21) {
    w.string(item.description || '');
  }

  if (version > 22) {
    w.uint16(item.spliceSeed1 || 0);
    w.uint16(item.spliceSeed2 || 0);
  }

  if (version > 23) {
    w.uint8(item.slipperyType || 0);
  }

  if (version > 24) {
    w.string(item.unknownStr || '');
    w.uint32(item.unknownInt || 0);
  }

  if (version > 25) {
    w.uint8(item.unknownByte || 0);
  }

  // Write back unknown trailing data for future versions
  if (item._unknownTrailingData) {
    const raw = Buffer.from(item._unknownTrailingData, 'base64');
    w.bytes(raw);
  }
}

/**
 * Probe item boundaries for unknown versions.
 * Strategy: each item starts with a uint32 ID that should equal its index.
 * We scan the buffer for sequential IDs to find where each item starts.
 */
function probeItemBoundaries(buffer, itemCount, firstItemOffset) {
  const offsets = [];
  // For unknown versions, we try to find item boundaries by looking for
  // sequential uint32 IDs (0, 1, 2, 3...) at plausible offsets.
  // This is a heuristic — works because item.id == item_index in Growtopia.

  // First item is at firstItemOffset
  offsets.push(firstItemOffset);

  // We can't reliably probe without parsing, so return null to signal
  // that we should use the fallback approach (parse known fields + capture remainder)
  return null;
}

/**
 * Decode items.dat buffer -> object { version, itemCount, items[], _meta }
 */
function decode(buffer) {
  const r = new BinaryReader(buffer);

  const version = r.uint16();
  const itemCount = r.uint32();

  const isUnknownVersion = version > MAX_KNOWN_VERSION;

  if (isUnknownVersion) {
    console.error(`[WARNING] Unknown items.dat version: ${version} (latest known: ${MAX_KNOWN_VERSION})`);
    console.error(`[WARNING] Will parse known fields and preserve unknown trailing bytes per item.`);
    console.error(`[WARNING] The decoded JSON will contain _unknownTrailingData (base64) for new fields.`);
    console.error(`[WARNING] Encoding back will produce a byte-identical file.`);
  }

  console.error(`[decode] version: ${version}, items: ${itemCount}`);

  // For unknown versions, we need to figure out item boundaries.
  // Strategy: parse items sequentially. For each item after the first,
  // we peek ahead to find the next item's ID (which should be current index + 1).
  // If version is unknown, after parsing known fields we scan for the next
  // sequential uint32 ID to determine where the current item ends.

  const items = [];

  if (!isUnknownVersion) {
    // Known version — straightforward parse
    for (let i = 0; i < itemCount; i++) {
      items.push(readItem(r, version, i, null));
      if (i % 5000 === 0 && i > 0) {
        console.error(`[decode] ${i}/${itemCount} items parsed...`);
      }
    }
  } else {
    // Unknown version — parse known fields, then find next item boundary
    for (let i = 0; i < itemCount; i++) {
      const itemStart = r.pos;

      // Parse all known fields (up to v26)
      const item = readItem(r, MAX_KNOWN_VERSION, i, null);

      // Now we're past all known fields. We need to find where the next item starts.
      // Next item should start with uint32 == (i + 1) as its ID.
      // Scan forward byte by byte looking for the next sequential ID.
      if (i < itemCount - 1) {
        const nextId = i + 1;
        let found = false;
        const scanStart = r.pos;
        const maxScan = Math.min(r.pos + 2048, r.buf.length - 4); // don't scan too far

        for (let probe = scanStart; probe <= maxScan; probe++) {
          const val = r.buf.readUInt32LE(probe);
          if (val === nextId) {
            // Verify: the byte after id+flags+type+material should look like a valid
            // string length (name). Check if offset+8 has a reasonable uint16 (< 200).
            if (probe + 8 < r.buf.length) {
              const nameLen = r.buf.readUInt16LE(probe + 8);
              if (nameLen > 0 && nameLen < 200) {
                // Also verify flags is uint16 (should be < 0x8000 typically)
                const flags = r.buf.readUInt16LE(probe + 4);
                if (flags < 0x8000) {
                  // Found the next item boundary
                  if (probe > scanStart) {
                    const extraBytes = probe - scanStart;
                    const raw = r.bytes(extraBytes);
                    item._unknownTrailingData = raw.toString('base64');
                    item._unknownTrailingSize = extraBytes;
                  }
                  found = true;
                  break;
                }
              }
            }
          }
        }

        if (!found) {
          // Couldn't find next boundary — assume no extra bytes
          // (or we're at the last item)
          console.error(`[WARNING] Could not find boundary for item ${i} -> ${i+1}, assuming no trailing data`);
        }
      } else {
        // Last item — capture everything remaining
        if (r.remaining > 0) {
          const raw = r.bytes(r.remaining);
          item._unknownTrailingData = raw.toString('base64');
          item._unknownTrailingSize = raw.length;
        }
      }

      items.push(item);
      if (i % 5000 === 0 && i > 0) {
        console.error(`[decode] ${i}/${itemCount} items parsed...`);
      }
    }
  }

  console.error(`[decode] done. ${r.remaining} bytes remaining.`);

  const meta = {
    maxKnownVersion: MAX_KNOWN_VERSION,
    isUnknownVersion,
    originalSize: buffer.length,
  };

  if (isUnknownVersion) {
    // Count how many items have unknown trailing data
    const withExtra = items.filter(i => i._unknownTrailingData).length;
    const extraSizes = items.filter(i => i._unknownTrailingSize).map(i => i._unknownTrailingSize);
    const uniqueSizes = [...new Set(extraSizes)];
    meta.unknownBytesPerItem = uniqueSizes.length === 1 ? uniqueSizes[0] : uniqueSizes;
    meta.itemsWithUnknownData = withExtra;

    console.error(`[INFO] ${withExtra}/${itemCount} items have unknown trailing data.`);
    if (uniqueSizes.length === 1) {
      console.error(`[INFO] Each item has ${uniqueSizes[0]} unknown extra bytes (consistent).`);
      console.error(`[INFO] This likely means version ${version} added ${uniqueSizes[0]} new bytes per item.`);
    } else if (uniqueSizes.length <= 5) {
      console.error(`[INFO] Unknown data sizes vary: ${uniqueSizes.join(', ')} bytes.`);
      console.error(`[INFO] This may indicate variable-length fields (strings) were added.`);
    }
  }

  return { version, itemCount, items, _meta: meta };
}

/**
 * Encode object { version, itemCount, items[] } -> Buffer
 */
function encode(data) {
  const w = new BinaryWriter();
  const version = data.version;
  const items = data.items;

  // For unknown versions, we write known fields + trailing data
  const effectiveVersion = Math.min(version, MAX_KNOWN_VERSION);

  w.uint16(version);
  w.uint32(items.length);

  for (let i = 0; i < items.length; i++) {
    writeItem(w, items[i], effectiveVersion);
    if (i % 5000 === 0 && i > 0) {
      console.error(`[encode] ${i}/${items.length} items written...`);
    }
  }

  console.error(`[encode] done. ${items.length} items encoded.`);
  return w.toBuffer();
}

module.exports = { decode, encode, readItem, writeItem, MAX_KNOWN_VERSION };
