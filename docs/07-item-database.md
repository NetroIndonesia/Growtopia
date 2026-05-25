# Item Database (items.dat)

## What Is It

`items.dat` is a binary file (~5MB) containing definitions for every item in Growtopia (17,000+). The server must serve this file to the client on first login or when the hash changes.

## Delivery to Client

1. Server sends `OnSuperMainStart` variant with `items_dat_hash`
2. Client compares hash with its cached copy
3. If mismatch: client sends `action|refresh_item_data`
4. Server responds with tank packet type 16 (SEND_ITEM_DATABASE_DATA), EXTENDED flag, raw file as extended data

Some implementations (GTopia) compress with zlib before sending. Others (NiceTopia, GTServer) send raw bytes.

## Hash Calculation

All implementations use the same algorithm:

```cpp
uint32_t hash_data(uint8_t* data, int len) {
    uint32_t acc = 0x55555555;
    for (int i = 0; i < len; i++)
        acc = (acc >> 27) + (acc << 5) + data[i];
    return acc;
}
```

Computed over the **entire raw (uncompressed) items.dat bytes**.

## File Header

```
uint16    format_version      (11-26, maps to game version)
uint32    item_count          (total items in file)
```

### Version ↔ Game Version Mapping

| Game Version | items.dat Version | Notes |
|-------------|-------------------|-------|
| 2.988 | 11 | February 2019 |
| 3.45 | 12 | October 2020 |
| 3.62 | 13 | May 2021 |
| 3.74 | 14 | October 2021 |
| 4.19 | 15 | |
| 4.44 | 16 | |
| 4.53 | 17 | April 2024 |
| 4.61 | 18 | December 2024 |
| 4.71 | 19 | |
| 5.11 | 21 | |
| 5.20 | 22 | description field added |
| 5.30 | 23 | splice seeds added (September 2025) |
| 5.40 | 24 | slipperyType added |
| 5.46 | 25 | player punch FX string + reserved int (December 2025) |
| 5.47 | 26 | extra trailing byte |

## Per-Item Fields (Base — All Versions)

Read in this exact order for each item:

| # | Field | Type | Bytes | Notes |
|---|-------|------|-------|-------|
| 1 | id | uint32 | 4 | |
| 2 | flags | uint16 | 2 | Item property bitmask |
| 3 | type | uint8 | 1 | Action type (FOREGROUND, SEED, etc.) |
| 4 | material | uint8 | 1 | Hit sound / clothSleeve |
| 5 | name | string | 2+len | **XOR encrypted** (version >= 3) |
| 6 | textureFile | string | 2+len | Texture atlas filename |
| 7 | textureHash | uint32 | 4 | |
| 8 | visualEffect | uint8 | 1 | Visual type / item_kind |
| 9 | cookingTime | int32 | 4 | Also: val1, flags1 |
| 10 | textureX | uint8 | 1 | Position in atlas |
| 11 | textureY | uint8 | 1 | |
| 12 | spreadType | uint8 | 1 | How item spreads when placed |
| 13 | layer | int8 | 1 | is_stripey_wallpaper |
| 14 | collisionType | uint8 | 1 | See collision types |
| 15 | hp | uint8 | 1 | Break hits (actual = value / 6) |
| 16 | restoreTime | int32 | 4 | Drop chance / reset time |
| 17 | bodyPart | uint8 | 1 | Clothing slot |
| 18 | rarity | int16 | 2 | 1-999 |
| 19 | maxCanHold | uint8 | 1 | Max stack (usually 200) |
| 20 | extraFile | string | 2+len | Extra file reference |
| 21 | extraFileHash | uint32 | 4 | |
| 22 | animMS | int32 | 4 | Animation speed / audio volume |
| 23 | petName | string | 2+len | (version > 3) |
| 24 | petSubName | string | 2+len | (version > 3) Pet prefix |
| 25 | petEndName | string | 2+len | (version > 3) Pet suffix |
| 26 | petPowerName | string | 2+len | (version > 4) Pet ability |
| 27 | seedBg | uint8 | 1 | Seed background sprite |
| 28 | seedFg | uint8 | 1 | Seed overlay sprite |
| 29 | treeBg | uint8 | 1 | Tree background sprite |
| 30 | treeFg | uint8 | 1 | Tree leaves sprite |
| 31 | seedBgColor | uint32 | 4 | ARGB color |
| 32 | seedFgColor | uint32 | 4 | ARGB color |
| 33 | seed1 | uint16 | 2 | Splice ingredient 1 |
| 34 | seed2 | uint16 | 2 | Splice ingredient 2 |
| 35 | growTime | uint32 | 4 | Seconds to grow |

## Version-Conditional Fields

Read these AFTER the base fields, in order, only if version exceeds the threshold:

| Version | Fields | Types | Bytes |
|---------|--------|-------|-------|
| > 6 (v7+) | fxFlags, multiAnim1 | uint32, string | 4 + (2+len) |
| > 7 (v8+) | overlayTexture, multiAnim2, dualAnimLayer | string, string, int32×2 | (2+len)×2 + 8 |
| > 8 (v9+) | flags2, clientData[15] | uint32, int32[15] | 64 |
| > 9 (v10+) | tileRange, pileSize | uint32, uint32 | 8 |
| > 10 (v11+) | punchParameters | string | 2+len |
| > 11 (v12+) | extraSlotCounter, extraSlotBodyParts[9] | uint32, uint8[9] | 13 |
| > 12 (v13+) | lightSourceRange | uint32 | 4 |
| > 13 (v14+) | variantVersionItem | uint32 | 4 |
| > 14 (v15+) | chairEnabled, chairPlayerOffset, chairArmPos, chairArmOffset, chairArmTexture | uint8, int32×2, int32×2, int32×2, string | 25 + (2+len) |
| > 15 (v16+) | configName | string | 2+len |
| > 16 (v17+) | otherPlayerHitParticle | int32 | 4 |
| > 17 (v18+) | configNameHash | uint32 | 4 |
| > 18 (v19+) | randomSpriteEnabled, randomSpriteOffsetMod, randomSpriteChance | uint8, int32, float | 9 |
| > 19 (v20+) | hiddenPartsFlags | uint8 | 1 |
| > 20 (v21+) | canTransform | uint8 | 1 |
| > 21 (v22+) | description | string | 2+len |
| > 22 (v23+) | seed1, seed2 | uint16, uint16 | 4 |
| > 23 (v24+) | slipperyType | uint8 | 1 |
| > 24 (v25+) | unknownString, unknownUint32 | string, uint32 | (2+len) + 4 |
| > 25 (v26+) | unknownByte | uint8 | 1 |

## String Format

All strings in items.dat use **uint16 length prefix** followed by raw bytes (no null terminator):

```
[uint16 length][char × length]
```

## Name XOR Encryption

```cpp
const char* key = "PBG892FXX982ABC*";  // 16 chars

for (int i = 0; i < name_length; i++)
    name[i] ^= key[(i + item_id) % 16];
```

Same operation encrypts and decrypts (XOR is symmetric). Applied only to the `name` field, only when version >= 3.

## Seed Relationships

### ID Convention

```
Seed ID = Item ID + 1    (seeds are always odd-numbered)
```

Example: Dirt = 2, Dirt Seed = 3. Rock = 4, Rock Seed = 5.

### Splice Recipe

Each seed stores `seed1` and `seed2` — the two item IDs that combine to create this seed. When a player plants seed A on a tile with seed B, the server searches for an item where `seed1 == A && seed2 == B` (or vice versa).

### Grow Time Formula (when auto-calculated from rarity)

```cpp
if (rarity == 999)
    growTime = 3600;  // 1 hour for max rarity
else
    growTime = (rarity^3) + (30 * rarity);

if (growTime == 0)
    growTime = 31;  // minimum 31 seconds
```

### Rarity from Splice

```
result_rarity = rarity(seed1) + rarity(seed2)
capped at 999
```

### Tree Visual Sprites (auto-generated)

```cpp
seedBg = (item_id / 2) % 16;
seedFg = item_id % 16;
treeBg = (item_id / 2) % 8;
treeFg = item_id % 8;
```

## Collision Types

| ID | Type | Behavior |
|----|------|----------|
| 0 | NONE | Passable (backgrounds, decorations) |
| 1 | FULL | Solid block |
| 2 | JUMP_THROUGH | Platform (solid from above, passable from below) |
| 3 | GATEWAY | Door/portal (passable, triggers action) |
| 4 | IF_OFF | Solid only when block is OFF |
| 5 | ONE_WAY | Passable in one direction |
| 7 | JUMP_DOWN | Solid platform, drop through with down+jump |
| 9 | IF_ON | Solid only when block is ON |

## Item Flags (uint16 bitmask)

| Flag | Meaning |
|------|---------|
| FLIPPED | Renders mirrored |
| EDITABLE | Can be wrenched |
| SEEDLESS | Cannot produce a seed |
| PERMANENT | Cannot be broken |
| DROPLESS | Cannot be dropped |
| WORLD_LOCK | Functions as world lock |
| BETA | Beta item |
| AUTOPICKUP | Auto-collected on walk |
| MOD | Moderator only |
| UNTRADABLE | Cannot be traded/dropped/vended |

## Clothing Body Parts

| ID | Slot |
|----|------|
| 0 | Hair |
| 1 | Shirt |
| 2 | Pants |
| 3 | Shoes |
| 4 | Face |
| 5 | Hand |
| 6 | Back |
| 7 | Hat |
| 8 | Chest/Necklace |
| 9 | Ances (Ancestral) |
