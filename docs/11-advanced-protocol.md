# Advanced Protocol Details

Deep technical details for inventory serialization, clothing packets, tile extras, ping system, world objects, and provider blocks.

---

## Inventory Binary Format (SEND_INVENTORY_STATE)

Sent as tank packet type 9 with EXTENDED flag.

### Binary Layout

```
Offset  Size    Field
0       1       Version (0x01)
1       4       Backpack size (uint32, total slot capacity)
5       2       Item count (uint16, how many items currently held)
7       4*N     Items array (4 bytes per item):
  +0      2       Item ID (uint16)
  +2      1       Count (uint8, max 200)
  +3      1       Flags (uint8, bit 0 = equipped/worn)
```

**Total extended data size:** `7 + (4 * item_count)` bytes

### Notes

- Max inventory display: 476 items (NiceTopia cap) or 596 slots (GTServer)
- Fist (0) and Wrench (1) are always present, cannot be removed
- Flags byte: `0x01` = item is currently equipped in a clothing slot

---

## OnSetClothing (Variant Format)

Clothing is packed into vec3 values (item IDs cast to float):

```
Variant[0] = "OnSetClothing"                          (string)
Variant[1] = vec3(hair_id, shirt_id, pants_id)        (3 floats)
Variant[2] = vec3(shoe_id, face_id, hand_id)          (3 floats)
Variant[3] = vec3(back_id, hat_id, chest_id)          (3 floats)
Variant[4] = skin_color                               (int32, ARGB)
Variant[5] = vec3(ances_id, invis_flag, 0)            (3 floats, protocol >= 32)
```

Older protocols (< 32) use `vec3(invis_flag, 0, 0)` for variant[5].

Send with `net_id` = target player's netID. Broadcast to all players in the world when someone changes clothing.

---

## Ping / Keepalive System

### How It Works

1. Server periodically sends **PING_REQUEST** (tank packet type 22)
2. Client responds with **PING_REPLY** (tank packet type 21)
3. Server measures RTT for latency detection

### Packet Format

Both ping request and reply are bare 56-byte GameUpdatePacket with only `type` set. No extended data.

```
[4B msg_type=4][1B packet_type=22][55B zeros]    // PING_REQUEST (server sends)
[4B msg_type=4][1B packet_type=21][55B zeros]    // PING_REPLY (client sends)
```

### Anti-Cheat in Ping Reply

The client fills certain fields in the ping reply with its current character state values. Server can validate:

```
offset 28 (pos_y / punch_range_in)  = expected ~64.0
offset 32 (speed_x / build_range_in) = expected ~64.0
offset 36 (speed_y / gravity_in)     = expected ~1000.0
offset 40 (float2 / speed_in)        = expected ~250.0
```

Known cheat tools send hardcoded values (64, 64, 1000, 250) which can be detected.

### Timing

- ENet protocol-level ping: 500ms default interval
- Game-level ping request: sent on world join and periodically
- RTT > 1500ms flagged as suspicious (possible proxy/VPN)

---

## World Object Pickup

### Pickup Radius

**64 pixels (2 tiles)** in both X and Y axes from the player's server-tracked position.

```cpp
if (abs(player_x - object_x) >= 64 || abs(player_y - object_y) >= 64)
    deny_pickup();  // too far
```

### Anti-Cheat Distance Check

Target tile must be within 9 tiles of player position. Exceeding this triggers rate limiting (5 second cooldown).

### Collect Flow

1. Client sends tank packet type 11 (ITEM_ACTIVATE_OBJECT_REQUEST):
   - `int_data` = drop UID to collect
   - `pos_x/y` = position of the drop

2. Server validates distance, ownership, inventory space

3. Server broadcasts tank packet type 14 (ITEM_CHANGE_OBJECT) to all in world:
   - `net_id` = who collected it
   - `int_data` = drop UID that was collected

### Drop Stacking

When dropping an item, if an existing drop of the **same item ID** is within **16 pixels**, it stacks onto that drop (max 200 per stack). Otherwise creates a new drop.

### World Object Binary (in SEND_MAP_DATA)

```
=== Header (8 bytes) ===
int32     object_count
int32     last_uid            (counter for assigning new UIDs)

=== Per Object (16 bytes each) ===
int16     item_id
float     pos_x               (pixels)
float     pos_y               (pixels)
int8      count
int8      (padding)
int32     uid                 (unique within this world)
```

---

## Provider Block Timer

### How Providers Work

Provider blocks (Cow, Chicken, Coffee Maker, Well, etc.) produce items on a timer cycle.

### Timer Logic

```
planted_time = timestamp when last harvested (or first placed)
grow_time    = production interval in seconds (from items.dat)

ready = (current_time - planted_time) >= grow_time
```

### On Harvest

1. Random reward selected from provider's reward table
2. Item dropped at tile position + random offset (0-16 pixels in X and Y)
3. Timer resets

### Timer Reset Behavior

- **NiceTopia**: resets to `time(now)` — starts at 0% progress
- **GTServer**: resets to `now - (growTime / 2)` — starts at 50% progress (faster re-harvest)

### Provider Reward Examples (from source)

| Provider | Item ID | Drops | Max Count |
|----------|---------|-------|-----------|
| Cow | 866 | Milk (868) | 2 |
| Chicken | 872 | Egg (874) | 2 |
| Buffalo | 1044 | Milk (868) | 2 |
| Sheep | 3888 | Wool (3890) | 3 |
| Coffee Maker | 1632 | Coffee (1634) | 1 |
| Well | 2798 | Water Bucket (822) | 2 |
| ATM Machine | special | 15-150 gems (random) | — |

---

## Tile Extra Serialization

When a tile has `flags & 0x01` (HAS_EXTRA_DATA), additional bytes follow in the world binary. Format varies by item type.

### String Format in Tile Extras

All strings: `uint16 length prefix + raw bytes` (no null terminator)

### Door (Type 1)

```
uint16    label_length
char[]    label
uint8     unknown
uint16    destination_length
char[]    destination           (format: "WORLDNAME:DOORID")
uint8     unknown2
uint8     unknown3
uint8     unknown4
```

### Sign (Type 2)

```
uint16    text_length
char[]    text
int32     unknown               (flags or style)
```

### Lock (Type 3)

```
uint8     lock_flags
uint32    owner_user_id
uint32    access_count          (includes tempo entry, actual admins = count - 1)
[per access entry:]
  uint32  user_id
int32     tempo_data            (stored as negative user_id in access list)
uint8     unknown
```

### Seed (Type 4)

```
uint32    time_passed           (seconds since planted — network format)
uint8     fruit_count           (1-4)
```

> Database format uses uint64 nanosecond timestamp instead of elapsed seconds.

### Provider (Type 6)

```
uint32    time_passed           (seconds since last harvest — network format)
```

### Vending Machine (Type 8)

Network format (sent to client):
```
int32     item_id               (what's being sold)
int32     price                 (positive = WL/item, negative = items/WL, 0 = disabled)
```

Database format (stored):
```
int32     item_id
int32     price
int32     stock_count
int32     earned_wls
```

### Mannequin (Type 10)

```
uint16    label_length
char[]    label
uint8     unknown
uint8     unknown2
uint8     unknown3
uint8     unknown4
uint16    clothing[9]           (one uint16 per body slot: hair through chest)
```

### Display Block (Type 14)

```
uint32    item_id               (item being displayed)
```

### Storage Box (Type 17)

```
uint16    slot_count
[per slot:]
  uint16  item_id
  uint16  count
```

### Giving Tree (Type 15)

```
uint8     is_decorated          (0 or 1)
uint16    gift_count
[per gift:]
  uint16  unknown
  uint32  unknown2
  // (gift data varies)
```

### Bulletin Board (Type 16)

```
uint16    post_count
[per post:]
  uint16  author_length
  char[]  author
  uint16  message_length
  char[]  message
  // (timestamp data)
```

### Fish Tank (Type 19)

```
uint8     fish_count
[per fish:]
  uint16  item_id
  uint32  weight_lbs
```

### Display Shelf (Type 23)

```
uint32    item_id_slot1
uint32    item_id_slot2         (NOTE: slots 1 and 2 are SWAPPED in protocol)
uint32    item_id_slot3
uint32    item_id_slot4
```

> Confirmed from source: "swapped cuz rgt is retarded" — slot 1 and 2 are intentionally reversed in the wire format.

### Geiger Charger (Type 28)

```
uint32    time_passed           (seconds since last charge — network format)
```

---

## Key Constants

| Constant | Value |
|----------|-------|
| Pickup radius | 64 pixels (2 tiles) |
| Drop stacking radius | 16 pixels |
| Max stack on ground | 200 |
| Max inventory slots | 596 |
| World object entry size | 16 bytes |
| Inventory item entry size | 4 bytes |
| ENet ping interval | 500ms default |
| Suspicious RTT threshold | 1500ms |
| Provider drop offset | rand() % 17 pixels |
| Anti-cheat tile distance | 9 tiles max |
