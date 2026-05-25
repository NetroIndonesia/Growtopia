# itemsdat-codec

Growtopia `items.dat` decoder and encoder. Converts between binary and JSON. Auto-detects all versions (v11-v26) and **handles unknown future versions** (v27+) without losing data.

## Usage

No dependencies needed — pure Node.js.

### Analyze (inspect any version)

```bash
node analyze.js items.dat
```

Reports: version, item count, hash, field structure, and **detects new fields** in unknown versions with byte-level analysis (likely types, sample values, offsets).

### Decode (binary → JSON)

```bash
node decode.js items.dat                    # outputs items.json
node decode.js items.dat output.json        # custom output name
node decode.js items.dat --pretty           # human-readable formatting
```

### Encode (JSON → binary)

```bash
node encode.js items.json                   # outputs items.dat
node encode.js items.json custom.dat        # custom output name
```

The encoder prints the file hash — use this value in `OnSuperMainStart` so the client caches correctly.

### Example: Analyzing an unknown version

```
$ node analyze.js items_v28.dat

=== items.dat Analysis ===

  File          : items_v28.dat
  Size          : 8.12 MB (8513024 bytes)
  Version       : 28
  Item Count    : 32000
  Hash          : 1847293651
  Known Version : NO (latest known: v26)

=== Item Structure ===

  Known fields size   : 268 bytes (per item 0)
  Actual item size    : 280 bytes (per item 0)
  Unknown extra bytes : 12 bytes per item

  Status: Version 28 is NEWER than supported (v26).
  This version adds 12 new bytes per item after known fields.

=== Unknown Field Analysis ===

  New data starts at byte offset 268 within each item.
  Total new bytes per item: 12

  Offset  Likely Type     Sample Values                                     Notes
  ------  ----------      -------------                                     -----
  +0      uint32          0, 0, 1482, 0, 0                                  small uint32
  +4      uint32          0, 0, 0, 0, 0                                     all zeros
  +8      float32         0.00, 0.00, 1.50, 0.00, 0.00                      likely float field

  Interpretation:
  - Version 28 added 12 bytes after the last known field (v26).
  - Likely: 1x uint32 + 1x uint32 + 1x float32
```

This tells you exactly what Growtopia added — without needing to update the tool.

## Workflow

```
items.dat (binary) --decode--> items.json (editable) --encode--> items_modified.dat
```

1. Decode your items.dat to JSON
2. Edit the JSON (change names, rarity, grow time, add items, etc.)
3. Encode back to binary
4. Serve the new .dat file from your server

## Future Version Support (v27+)

If Growtopia updates and adds new fields to items.dat, this tool **still works**:

1. All known fields (up to v26) are parsed and exposed as named JSON fields
2. Any new/unknown bytes per item are captured as `_unknownTrailingData` (base64)
3. The tool reports what it found:
   - How many items have unknown data
   - Whether the extra bytes are consistent (fixed-size new field) or variable (new string field)
4. On encode, the unknown data is written back byte-for-byte — **producing an identical file**

### Example output for unknown version:

```
[WARNING] Unknown items.dat version: 28 (latest known: 26)
[WARNING] Will parse known fields and preserve unknown trailing bytes per item.
[INFO] 30001/30001 items have unknown trailing data.
[INFO] Each item has 12 unknown extra bytes (consistent).
[INFO] This likely means version 28 added 12 new bytes per item.
```

This tells you: "version 28 added a new 12-byte field per item" — you can then investigate what those bytes mean and contribute back to the codec.

### JSON with unknown data:

```json
{
  "id": 100,
  "name": "Some Item",
  "rarity": 50,
  "growTime": 120,
  "_unknownTrailingData": "AQAAAAAAAAAAAAA=",
  "_unknownTrailingSize": 12
}
```

You can still edit all known fields (name, rarity, etc.) and the unknown bytes stay intact on re-encode.

## JSON Structure

```json
{
  "version": 26,
  "itemCount": 30001,
  "items": [
    {
      "itemId": 0,
      "name": "Fist",
      "editableType": 0,
      "itemCategory": 0,
      "actionType": 0,
      "hitSoundType": 0,
      "texture": "tiles_page1.rttex",
      "textureHash": 0,
      "itemKind": 0,
      "val1": 0,
      "textureX": 0,
      "textureY": 0,
      "spreadType": 0,
      "isStripeyWallpaper": 0,
      "collisionType": 0,
      "breakHits": 0,
      "dropChance": 0,
      "clothingType": 0,
      "rarity": 999,
      "maxAmount": 200,
      "extraFile": "",
      "extraFileHash": 0,
      "audioVolume": 0,
      "petName": "",
      "petPrefix": "",
      "petSuffix": "",
      "petAbility": "",
      "seedBase": 0,
      "seedOverlay": 0,
      "treeBase": 0,
      "treeLeaves": 0,
      "seedColorA": 0, "seedColorR": 0, "seedColorG": 0, "seedColorB": 0,
      "seedOverlayColorA": 0, "seedOverlayColorR": 0, "seedOverlayColorG": 0, "seedOverlayColorB": 0,
      "growTime": 31,
      "val2": 0,
      "isRayman": 0,
      "extraOptions": "",
      "texture2": "",
      "extraOptions2": "",
      "dataPosition80": "00000000...",
      "punchOptions": "",
      "dataVersion12": "00000000...",
      "intVersion13": 0,
      "intVersion14": 0,
      "dataVersion15": "00000000...",
      "strVersion15": "",
      "strVersion16": "",
      "intVersion17": 0,
      "intVersion18": 0,
      "dataVersion19": "00000000...",
      "intVersion21": 0,
      "strVersion22": "",
      "spliceSeed1": 0,
      "spliceSeed2": 0,
      "slipperyType": 0,
      "strVersion25": "",
      "intVersion25": 0,
      "byteVersion26": 0
    }
  ],
  "_meta": {
    "maxKnownVersion": 26,
    "isUnknownVersion": false,
    "originalSize": 7743799
  }
}
```

Fields with a `Version##` suffix correspond to the items.dat revision that introduced them — they are only present in the JSON when the source file is at that version or newer. Encoding writes them only when `version >= threshold`, so old files stay binary-compatible.

## Version Support

| Version | Game Version | Status |
|---------|-------------|--------|
| 11 | 2.988 | Full support |
| 12 | 3.45 | Full support |
| 13 | 3.62 | Full support |
| 14 | 3.74 | Full support |
| 15 | 4.19 | Full support |
| 16 | 4.44 | Full support |
| 17 | 4.53 | Full support |
| 18 | 4.61 | Full support |
| 19 | 4.71 | Full support |
| 21 | 5.11 | Full support |
| 22 | 5.20 | Full support (description added) |
| 23 | 5.30 | Full support (splice seeds added) |
| 24 | 5.40 | Full support (slipperyType added) |
| 25 | 5.46 | Full support (player punch FX + reserved int) |
| 26 | 5.47 | Full support (extra byte added) |
| 27+ | Future | Partial (known fields parsed, extra bytes preserved as `_unknownTrailingData`) |

## Tested

- Decode v18 items.dat (21,700 items, 5.27 MB) — roundtrip byte-identical
- Decode v21 items.dat (30,001 items, 7.39 MB) — roundtrip byte-identical
- Synthetic v26 sample with all v22–v26 fields populated — roundtrip byte-identical
- Unknown version v27 with trailing payload — preserved verbatim via `_unknownTrailingData`

## Notes

- Names are automatically decrypted on decode and re-encrypted on encode (XOR cipher with key `PBG892FXX982ABC*`)
- `--pretty` flag makes JSON human-readable but ~5x larger
- Encode prints the hash value needed for `OnSuperMainStart`
- No npm install needed — zero dependencies
- All integers are little-endian
- Strings use uint16 length prefix (no null terminator)
