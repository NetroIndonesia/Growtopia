# World System

## Overview

A world in Growtopia is a 2D grid of tiles that players can explore, build in, and interact with. Each world is identified by a unique name (uppercase alphanumeric, max ~24 characters). Worlds are generated on first visit and persist in the database.

## Dimensions

```
Width           100 tiles
Height          60 tiles
Total tiles     6000
Tile size       32x32 pixels
World pixels    3200 x 1920
Format version  0x14 (20)
```

## World Generation

When a player joins a world that doesn't exist yet, the server generates it. The default layout:

```
Row 0-23    Empty (air)
Row 24      Bedrock layer + Main Door at center (this is the spawn point)
Row 25-35   Dirt blocks + random Cave Background
Row 36-53   Rock blocks + random Cave Background
Row 54-59   Bedrock (indestructible bottom layer)
```

### Other Generation Types

| Type | Description |
|------|-------------|
| NORMAL | Standard dirt/rock (described above) |
| BEACH | Sand, coral, palm trees, ocean rocks |
| MARS | Red soil, mars rocks |
| DESERT | Sand, boulders, cacti |
| JUNGLE | Dense tropical vegetation |
| UNDERWATER | Deep sand, seaweed, deep rock |
| CAVE | Underground rock formations |
| SKY | Cloud platforms |
| FARM | Agricultural themed |

## Tile Structure

Each tile in the world has:

```cpp
struct Tile {
    uint16_t foreground;    // Item ID of the front layer (solid blocks, doors, etc.)
    uint16_t background;    // Item ID of the back layer (wallpapers, cave bg, etc.)
    uint16_t parent;        // Tile index of the lock protecting this tile
    uint16_t flags;         // Tile state flags
    // + optional TileExtra data
};
```

### Tile Flags

| Bit | Hex | Meaning |
|-----|-----|---------|
| 0 | 0x01 | HAS_EXTRA_DATA — tile has additional data after it |
| 1 | 0x02 | LOCKED — this tile IS a lock |
| 2 | 0x04 | HAS_PARENT — protected by a lock (parent field is valid) |
| 3 | 0x08 | SPLICED — tree was created by splicing two seeds |
| 4 | 0x10 | SEEDLING — a seed is planted here |
| 5 | 0x20 | FLIPPED_X — render horizontally mirrored |
| 6 | 0x40 | IS_ON — toggle state is ON |
| 7 | 0x80 | PUBLIC — anyone can modify this tile |
| 9 | 0x200 | GLUED — cannot be broken |
| 10 | 0x400 | ON_FIRE — burning |

## Tile Extra Data

Certain item types store additional data per-tile. When lags & 0x01 (HAS_EXTRA_DATA), extra bytes follow the tile in the binary format.

| Item Type | Extra Data Contains |
|-----------|-------------------|
| Door | label, destination world:id, password |
| Sign | text content (max 128 chars) |
| Lock | owner user_id, access list (user IDs), lock flags |
| Seed/Tree | plant timestamp, grow time, fruit count |
| Provider | timer, production interval |
| Vending Machine | item_id for sale, price in WLs, stock count |
| Mannequin | label text, full clothing set (9 slots), skin color |
| Display Block | single item_id being displayed |
| Storage Box | array of (item_id, count) slots |
| Fish Tank | array of (item_id, weight_lbs) |
| Giving Tree | array of gifts (donor, item_id, count), decorated flag |
| Bulletin Board | array of posts (author, message, timestamp) |

## World Binary Serialization (SEND_MAP_DATA)

When a player joins a world, the server serializes the entire world into binary and sends it as a tank packet (type 4, EXTENDED flag).

```
=== HEADER ===
uint16    version             (0x14 = 20)
uint32    reserved            (0)
uint16    name_length
char[]    world_name
uint32    width               (100)
uint32    height              (60)
uint16    tile_count          (6000)
uint8[7]  reserved/padding

=== TILES (repeated tile_count times) ===
uint16    foreground_id
uint16    background_id
uint16    parent_index
uint8     flags_low           (block.state[2] in Gurotopia — public/toggle/etc.)
uint8     flags_high          (block.state[3] — fire, glued, etc.)
[if HAS_EXTRA_DATA: tile extra payload, format varies by item type]

=== DROPPED OBJECTS HEADER ===
uint8[12] reserved/padding
uint32    last_object_uid     (counter for assigning new UIDs)
uint32    object_count

=== Per Object (16 bytes each) ===
uint16    item_id
float     pos_x               (pixels)
float     pos_y               (pixels)
uint16    count               (some implementations split this as uint8 count + uint8 flags)
uint32    object_id           (unique within this world)

=== WEATHER (newer versions) ===
uint16    base_weather_id
uint16    current_weather_id

=== OWNERSHIP (newer versions) ===
uint32    owner_user_id       (0 if no owner)
uint32    world_flags
int32     main_lock_index     (-1 if no world lock placed)
```

> The 7-byte and 12-byte padding regions exist in the wire format and are
> reproduced in every reference implementation we checked (Gurotopia
> `action::join_request`, Windsverse map serializer). Their exact meaning is
> client-specific; the safest behaviour is to leave them zeroed.

## World Objects (Dropped Items)

When a player drops an item or a tree is harvested, the items become floating objects in the world:

- Each object has a unique object_id (incrementing counter per world)
- Objects have pixel positions (float x, y)
- Players pick them up by walking over them
- Items with the AUTOPICKUP flag are collected automatically on contact
- Gems that drop from breaking blocks are also world objects

## World Flags

These affect the entire world's behavior:

| Flag | Effect |
|------|--------|
| JAMMED | World hidden from search results (Signal Jammer active) |
| NUKED | World has been reset to empty |
| PUNCH_JAMMER | Players cannot punch/damage other players |
| ZOMBIE_JAMMER | Zombie infection cannot spread |
| ANTI_GRAVITY | Gravity is inverted |
| MINI_MOD | Strict rules: no dropping items, no trading |
| BALLOON_JAMMED | Balloon items don't work |
| NOLOCKS | Cannot place locks |

## Tile Updates

When a tile changes (block placed, broken, tree harvested), the server broadcasts the update:

- **Single tile:** Tank packet type 5 (SEND_TILE_UPDATE_DATA) with the tile's new data as extended payload
- **Multiple tiles:** Tank packet type 6 (SEND_TILE_UPDATE_DATA_MULTIPLE)

All players in the world receive these broadcasts so their local world state stays in sync.

## World Lifecycle

```
1. Player requests join (action|join_request)
2. Server checks if world is loaded in memory
3. If not loaded: check database -> if not in DB: generate new
4. Serialize world to binary
5. Send SEND_MAP_DATA to joining player
6. Add player to world's player list
7. Broadcast OnSpawn to everyone
8. World stays in memory while players are in it
9. When last player leaves: save to database, optionally unload
10. Auto-save periodically (every 10-15 minutes)
```
