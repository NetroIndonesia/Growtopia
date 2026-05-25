'use strict';

const { BinaryReader, BinaryWriter, cipherName } = require('./binary');

/**
 * items.dat codec — ported from the proven browser-based reference decoder
 * and cross-referenced with NiceTopia (Base.h::items_dat), WindsVerse
 * (ItemsManager::Serialize) and Gurotopia (database/items.cpp).
 *
 * Supports versions up to 26 fully. For v27+ trailing bytes are captured as
 * `_unknownTrailingData` (base64) so files round-trip byte-for-byte.
 *
 * IMPORTANT: Version checks use >= and the field count per version is:
 *   v11 +(2+N)  punchOptions
 *   v12 +13     dataVersion12     (extraSlotCounter + bodyParts[9])
 *   v13 +4      intVersion13      (lightSourceRange)
 *   v14 +4      intVersion14      (variantVersionItem)
 *   v15 +25+(2+N) dataVersion15 + strVersion15 (chair*)
 *   v16 +(2+N)  strVersion16      (configName)
 *   v17 +4      intVersion17      (otherPlayerHitParticle)
 *   v18 +4      intVersion18      (configNameHash)
 *   v19 +9      dataVersion19     (randomSpriteEnabled + offsetMod + chance)
 *   v21 +2      intVersion21      (hiddenPartsFlags + canTransform packed as uint16)
 *   v22 +(2+N)  description
 *   v23 +4      spliceSeed1 + spliceSeed2 (uint16 each)
 *   v24 +1      slipperyType
 *   v25 +(2+N)+4 strVersion25 + intVersion25 (player punch FX + reserved)
 *   v26 +1      byteVersion26
 */

const MAX_KNOWN_VERSION = 26;

function readItem(r, version) {
  const item = {};

  item.itemId = r.uint32();
  item.editableType = r.uint8();
  item.itemCategory = r.uint8();
  item.actionType = r.uint8();
  item.hitSoundType = r.uint8();

  const nameLen = r.uint16();
  const rawName = r.bytes(nameLen).toString('latin1');
  item.name = cipherName(rawName, item.itemId);

  const texLen = r.uint16();
  item.texture = r.bytes(texLen).toString('latin1');

  item.textureHash = r.uint32();
  item.itemKind = r.uint8();
  item.val1 = r.uint32();
  item.textureX = r.uint8();
  item.textureY = r.uint8();
  item.spreadType = r.uint8();
  item.isStripeyWallpaper = r.uint8();
  item.collisionType = r.uint8();

  const rawHits = r.uint8();
  item.breakHits = (rawHits % 6 !== 0) ? rawHits + 'r' : rawHits / 6;

  item.dropChance = r.uint32();
  item.clothingType = r.uint8();
  item.rarity = r.uint16();
  item.maxAmount = r.uint8();

  const efLen = r.uint16();
  item.extraFile = r.bytes(efLen).toString('latin1');
  item.extraFileHash = r.uint32();
  item.audioVolume = r.uint32();

  const pnLen = r.uint16();
  item.petName = r.bytes(pnLen).toString('latin1');
  const ppLen = r.uint16();
  item.petPrefix = r.bytes(ppLen).toString('latin1');
  const psLen = r.uint16();
  item.petSuffix = r.bytes(psLen).toString('latin1');
  const paLen = r.uint16();
  item.petAbility = r.bytes(paLen).toString('latin1');

  item.seedBase = r.uint8();
  item.seedOverlay = r.uint8();
  item.treeBase = r.uint8();
  item.treeLeaves = r.uint8();

  item.seedColorA = r.uint8();
  item.seedColorR = r.uint8();
  item.seedColorG = r.uint8();
  item.seedColorB = r.uint8();
  item.seedOverlayColorA = r.uint8();
  item.seedOverlayColorR = r.uint8();
  item.seedOverlayColorG = r.uint8();
  item.seedOverlayColorB = r.uint8();

  r.skip(4); // ingredients (skipped)

  item.growTime = r.uint32();
  item.val2 = r.uint16();
  item.isRayman = r.uint16();

  const eoLen = r.uint16();
  item.extraOptions = r.bytes(eoLen).toString('latin1');
  const t2Len = r.uint16();
  item.texture2 = r.bytes(t2Len).toString('latin1');
  const eo2Len = r.uint16();
  item.extraOptions2 = r.bytes(eo2Len).toString('latin1');

  // 80 bytes raw data
  item.dataPosition80 = r.bytes(80).toString('hex').toUpperCase();

  if (version >= 11) {
    const poLen = r.uint16();
    item.punchOptions = r.bytes(poLen).toString('latin1');
  }
  if (version >= 12) {
    item.dataVersion12 = r.bytes(13).toString('hex').toUpperCase();
  }
  if (version >= 13) {
    item.intVersion13 = r.uint32();
  }
  if (version >= 14) {
    item.intVersion14 = r.uint32();
  }
  if (version >= 15) {
    item.dataVersion15 = r.bytes(25).toString('hex').toUpperCase();
    const s15Len = r.uint16();
    item.strVersion15 = r.bytes(s15Len).toString('latin1');
  }
  if (version >= 16) {
    const s16Len = r.uint16();
    item.strVersion16 = r.bytes(s16Len).toString('latin1');
  }
  if (version >= 17) {
    item.intVersion17 = r.uint32();
  }
  if (version >= 18) {
    item.intVersion18 = r.uint32();
  }
  if (version >= 19) {
    item.dataVersion19 = r.bytes(9).toString('hex').toUpperCase();
  }
  if (version >= 21) {
    item.intVersion21 = r.uint16();
  }
  if (version >= 22) {
    const s22Len = r.uint16();
    item.strVersion22 = r.bytes(s22Len).toString('latin1');
  }
  if (version >= 23) {
    item.spliceSeed1 = r.uint16();
    item.spliceSeed2 = r.uint16();
  }
  if (version >= 24) {
    item.slipperyType = r.uint8();
  }
  if (version >= 25) {
    const s25Len = r.uint16();
    item.strVersion25 = r.bytes(s25Len).toString('latin1');
    item.intVersion25 = r.uint32();
  }
  if (version >= 26) {
    item.byteVersion26 = r.uint8();
  }

  return item;
}

function writeItem(w, item, version) {
  w.uint32(item.itemId);
  w.uint8(item.editableType);
  w.uint8(item.itemCategory);
  w.uint8(item.actionType);
  w.uint8(item.hitSoundType);

  const encName = cipherName(item.name, item.itemId);
  const nameBuf = Buffer.from(encName, 'latin1');
  w.uint16(nameBuf.length);
  w.bytes(nameBuf);

  const texBuf = Buffer.from(item.texture || '', 'latin1');
  w.uint16(texBuf.length);
  w.bytes(texBuf);

  w.uint32(item.textureHash);
  w.uint8(item.itemKind);
  w.uint32(item.val1);
  w.uint8(item.textureX);
  w.uint8(item.textureY);
  w.uint8(item.spreadType);
  w.uint8(item.isStripeyWallpaper);
  w.uint8(item.collisionType);

  let rawHits;
  if (typeof item.breakHits === 'string' && item.breakHits.endsWith('r')) {
    rawHits = parseInt(item.breakHits.slice(0, -1));
  } else {
    rawHits = Number(item.breakHits) * 6;
  }
  w.uint8(rawHits);

  w.uint32(item.dropChance);
  w.uint8(item.clothingType);
  w.uint16(item.rarity);
  w.uint8(item.maxAmount);

  const efBuf = Buffer.from(item.extraFile || '', 'latin1');
  w.uint16(efBuf.length);
  w.bytes(efBuf);
  w.uint32(item.extraFileHash);
  w.uint32(item.audioVolume);

  const pn = Buffer.from(item.petName || '', 'latin1');
  w.uint16(pn.length); w.bytes(pn);
  const pp = Buffer.from(item.petPrefix || '', 'latin1');
  w.uint16(pp.length); w.bytes(pp);
  const ps = Buffer.from(item.petSuffix || '', 'latin1');
  w.uint16(ps.length); w.bytes(ps);
  const pa = Buffer.from(item.petAbility || '', 'latin1');
  w.uint16(pa.length); w.bytes(pa);

  w.uint8(item.seedBase);
  w.uint8(item.seedOverlay);
  w.uint8(item.treeBase);
  w.uint8(item.treeLeaves);
  w.uint8(item.seedColorA);
  w.uint8(item.seedColorR);
  w.uint8(item.seedColorG);
  w.uint8(item.seedColorB);
  w.uint8(item.seedOverlayColorA);
  w.uint8(item.seedOverlayColorR);
  w.uint8(item.seedOverlayColorG);
  w.uint8(item.seedOverlayColorB);

  w.uint32(0); // ingredients skip

  w.uint32(item.growTime);
  w.uint16(item.val2);
  w.uint16(item.isRayman);

  const eo = Buffer.from(item.extraOptions || '', 'latin1');
  w.uint16(eo.length); w.bytes(eo);
  const t2 = Buffer.from(item.texture2 || '', 'latin1');
  w.uint16(t2.length); w.bytes(t2);
  const eo2 = Buffer.from(item.extraOptions2 || '', 'latin1');
  w.uint16(eo2.length); w.bytes(eo2);

  w.bytes(Buffer.from(item.dataPosition80 || '0'.repeat(160), 'hex'));

  if (version >= 11) {
    const po = Buffer.from(item.punchOptions || '', 'latin1');
    w.uint16(po.length); w.bytes(po);
  }
  if (version >= 12) {
    w.bytes(Buffer.from(item.dataVersion12 || '0'.repeat(26), 'hex'));
  }
  if (version >= 13) {
    w.uint32(item.intVersion13 || 0);
  }
  if (version >= 14) {
    w.uint32(item.intVersion14 || 0);
  }
  if (version >= 15) {
    w.bytes(Buffer.from(item.dataVersion15 || '0'.repeat(50), 'hex'));
    const s15 = Buffer.from(item.strVersion15 || '', 'latin1');
    w.uint16(s15.length); w.bytes(s15);
  }
  if (version >= 16) {
    const s16 = Buffer.from(item.strVersion16 || '', 'latin1');
    w.uint16(s16.length); w.bytes(s16);
  }
  if (version >= 17) {
    w.uint32(item.intVersion17 || 0);
  }
  if (version >= 18) {
    w.uint32(item.intVersion18 || 0);
  }
  if (version >= 19) {
    w.bytes(Buffer.from(item.dataVersion19 || '0'.repeat(18), 'hex'));
  }
  if (version >= 21) {
    w.uint16(item.intVersion21 || 0);
  }
  if (version >= 22) {
    const s22 = Buffer.from(item.strVersion22 || '', 'latin1');
    w.uint16(s22.length); w.bytes(s22);
  }
  if (version >= 23) {
    w.uint16(item.spliceSeed1 || 0);
    w.uint16(item.spliceSeed2 || 0);
  }
  if (version >= 24) {
    w.uint8(item.slipperyType || 0);
  }
  if (version >= 25) {
    const s25 = Buffer.from(item.strVersion25 || '', 'latin1');
    w.uint16(s25.length); w.bytes(s25);
    w.uint32(item.intVersion25 || 0);
  }
  if (version >= 26) {
    w.uint8(item.byteVersion26 || 0);
  }

  // Unknown trailing data for versions > MAX_KNOWN_VERSION
  if (item._unknownTrailingData) {
    w.bytes(Buffer.from(item._unknownTrailingData, 'base64'));
  }
}

function decode(buffer) {
  const r = new BinaryReader(buffer);
  const version = r.uint16();
  const itemCount = r.uint32();
  const parseVer = Math.min(version, MAX_KNOWN_VERSION);
  const isUnknown = version > MAX_KNOWN_VERSION;

  if (isUnknown) {
    console.error(`[WARNING] items.dat version ${version} > max known (${MAX_KNOWN_VERSION}).`);
    console.error(`[WARNING] Known fields will be parsed. Extra bytes preserved as _unknownTrailingData.`);
  }

  console.error(`[decode] version: ${version}, items: ${itemCount}`);

  const items = [];

  for (let i = 0; i < itemCount; i++) {
    const beforePos = r.pos;
    const item = readItem(r, parseVer);

    // For unknown versions, find next item boundary and capture extra bytes
    if (isUnknown && i < itemCount - 1) {
      const nextId = i + 1;
      const scanStart = r.pos;
      const maxScan = Math.min(scanStart + 8192, r.buf.length - 10);
      for (let probe = scanStart; probe <= maxScan; probe++) {
        if (r.buf.readUInt32LE(probe) === nextId) {
          const nl = r.buf.readUInt16LE(probe + 8);
          if (nl > 0 && nl < 200) {
            if (probe > scanStart) {
              item._unknownTrailingData = r.bytes(probe - scanStart).toString('base64');
              item._unknownTrailingSize = probe - scanStart;
            }
            break;
          }
        }
      }
    } else if (isUnknown && i === itemCount - 1 && r.remaining > 0) {
      const trailingSize = r.remaining;
      item._unknownTrailingData = r.bytes(trailingSize).toString('base64');
      item._unknownTrailingSize = trailingSize;
    }

    items.push(item);
    if (i % 5000 === 0 && i > 0) console.error(`[decode] ${i}/${itemCount}...`);
  }

  console.error(`[decode] done. ${r.remaining} bytes remaining.`);

  const meta = { maxKnownVersion: MAX_KNOWN_VERSION, isUnknownVersion: isUnknown, originalSize: buffer.length };
  if (isUnknown) {
    const sizes = [...new Set(items.filter(i => i._unknownTrailingSize).map(i => i._unknownTrailingSize))];
    meta.unknownBytesPerItem = sizes.length === 1 ? sizes[0] : sizes;
    console.error(`[INFO] Unknown trailing bytes per item: ${JSON.stringify(meta.unknownBytesPerItem)}`);
  }

  return { version, itemCount, items, _meta: meta };
}

function encode(data) {
  const w = new BinaryWriter();
  const version = data.version;
  const writeVer = Math.min(version, MAX_KNOWN_VERSION);

  w.uint16(version);
  w.uint32(data.items.length);

  for (let i = 0; i < data.items.length; i++) {
    writeItem(w, data.items[i], writeVer);
    if (i % 5000 === 0 && i > 0) console.error(`[encode] ${i}/${data.items.length}...`);
  }

  console.error(`[encode] done. ${data.items.length} items.`);
  return w.toBuffer();
}

module.exports = { decode, encode, MAX_KNOWN_VERSION };
