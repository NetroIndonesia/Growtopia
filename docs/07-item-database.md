# Item Database (items.dat)

## What Is It

`items.dat` is a binary file (~5MB) that defines every item in Growtopia — over 17,000 items. It contains names, textures, properties, collision types, grow times, and more. The server must serve this file to the client on first login (or when the hash changes).

## How It's Delivered

1. Server sends `OnSuperMainStart` variant with an `items_dat_hash` value
2. Client compares hash with its cached copy
3. If mismatch: client sends `action|refresh_item_data`
4. Server responds with tank packet type 16 (SEND_ITEM_DATABASE_DATA), EXTENDED flag, with the raw file as extended data

The file is large but ENet handles fragmentation automatically.

## Binary Format

```
=== FILE HEADER ===
uint16    format_version      (ranges from 11 to 26 depending on game version)
uint32    item_count          (total number of items)

=== PER ITEM (repeated item_count times) ===
uint32    item_id
uint8     editable_type
uint8     item_category
uint8     action_type
uint8     hit_sound_type
uint16    name_length
char[]    name                (ENCRYPTED — see below)
uint16    texture_length
char[]    texture_file        (texture atlas filename)
uint32    texture_hash
uint8     item_kind           (visual type)
uint32    val1
uint8     texture_x           (position in atlas)
uint8     texture_y
uint8     spread_type
uint8     is_stripey_wallpaper
uint8     collision_type
uint8     break_hits          (actual hits = value / 6)
uint32    drop_chance
uint8     clothing_type       (which body slot, if wearable)
uint16    rarity
uint8     max_amount          (max stack, usually 200)
uint16    extra_file_length
char[]    extra_file
uint32    extra_file_hash
uint32    anim_ms
... (additional fields vary by format_version)
```

Fields added in later versions include: pet info, seed colors, tree visuals, cook/ingredient data, punch options, and more.

## Name Encryption

Item names in items.dat are XOR-encrypted. To decrypt:

```cpp
const char* key = "PBG892FXX982ABC*";  // 16 characters
int key_len = 16;

for (int i = 0; i < name_length; i++) {
    name[i] ^= key[(i + item_id) % key_len];
}
```

The same operation encrypts and decrypts (XOR is symmetric). You need to decrypt names when reading items.dat, and encrypt them if you're generating a custom one.

## Item Types

Every item has a `type` that determines its behavior. There are 158+ types:

### Common Types

| ID | Type | Behavior |
|----|------|----------|
| 0 | FIST | Default punch tool (always in inventory) |
| 1 | WRENCH | Interaction tool (always in inventory) |
| 2 | DOOR | Passable block with label + destination |
| 3 | LOCK | Protects tiles (area or world) |
| 6 | DEADLY | Kills player on contact (spikes) |
| 7 | TRAMPOLINE | Bounces players upward |
| 8 | CONSUMABLE | Can be eaten/used (potions, food) |
| 10 | SIGN | Displays editable text |
| 13 | MAIN_DOOR | World spawn point (White Door) |
| 14 | PLATFORM | One-way block (jump through from below) |
| 15 | BEDROCK | Indestructible |
| 17 | FOREGROUND | Standard solid block |
| 18 | BACKGROUND | Non-solid backdrop |
| 19 | SEED | Plantable (grows into a tree) |
| 20 | CLOTHES | Wearable item |

### Interactive Types

| ID | Type | Behavior |
|----|------|----------|
| 26 | PORTAL | Teleports to linked portal |
| 27 | CHECKPOINT | Sets respawn point |
| 30 | WEATHER_MACHINE | Changes world weather/sky |
| 32 | PROVIDER | Produces items on a timer |
| 33 | MAILBOX | Receives messages from other players |
| 34 | BULLETIN | Community message board |
| 38 | VENDING_MACHINE | Automated shop (buy/sell for WLs) |
| 44 | MANNEQUIN | Displays a clothing outfit |
| 50 | DISPLAY_BLOCK | Shows a single item |
| 51 | STORAGE | Stores multiple items (like a chest) |

### Advanced Types

| ID | Type | Behavior |
|----|------|----------|
| 52 | FORGE | Smelting/crafting station |
| 53 | GIVING_TREE | Community gift exchange |
| 57 | BURGLAR | Crime system sensor |
| 63 | FISH_TANK | Stores caught fish |
| 64 | LOCKBOT | Programmable automated lock |
| 66 | STEAM_ENGINE | Automation block |
| 79 | GEIGER_CHARGER | Charges Geiger counters |
| 80 | ITEM_SUCKER | Magplant (collects items remotely) |
| 81 | ROBOT | Programmable robot |
| 89 | PASSWORD_STORAGE | Password-protected chest |
| 107 | ANCES | Ancestral item (special slot 9) |

## Collision Types

Determines how the player physically interacts with the block:

| ID | Type | Behavior |
|----|------|----------|
| 0 | NONE | No collision — player passes through (backgrounds, decorations) |
| 1 | FULL | Solid block — player cannot pass |
| 2 | JUMP_THROUGH | Platform — solid from above, passable from below |
| 3 | GATEWAY | Door/portal — passable, triggers enter action |
| 4 | IF_OFF | Solid only when the block is in OFF state |
| 5 | ONE_WAY | Passable in one direction only |
| 7 | JUMP_DOWN | Solid platform, but player can drop through (press down+jump) |
| 9 | IF_ON | Solid only when the block is in ON state |

## Seed System

Every non-seed item has a corresponding seed. The relationship:

```
Seed ID = Item ID + 1
```

Seeds are always odd-numbered IDs. Example: Dirt is ID 2, Dirt Seed is ID 3.

Each seed has:
- `grow_time` — seconds until the tree is fully grown
- `seed1` / `seed2` — the two items that splice to create this seed
- Tree visual properties (what the tree looks like while growing)

## Item Flags

| Flag | Meaning |
|------|---------|
| FLIPPED | Renders mirrored horizontally |
| EDITABLE | Can be wrenched (opens settings) |
| SEEDLESS | Cannot produce a seed |
| PERMANENT | Cannot be broken by any means |
| DROPLESS | Cannot be dropped on the ground |
| WORLD_LOCK | Functions as a world lock |
| BETA | Beta/unreleased item |
| AUTOPICKUP | Automatically collected when walked over |
| MOD | Only obtainable by moderators |
| UNTRADABLE | Cannot be traded, dropped, or vended |

## Rarity

Every item has a rarity value (1-999). Higher rarity means:
- Harder to obtain through splicing
- More gems dropped when breaking the block
- Generally more valuable in the player economy

## Break Hits

The `break_hits` field in items.dat stores the value divided by 6. To get actual hits needed:

```
actual_hits = raw_value / 6
```

Example: if the field reads 18, the block takes 3 punches to break.

## Clothing Types (Body Slots)

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

## Generating a Custom items.dat

If you want custom items in your GTPS:
1. Parse the official items.dat
2. Modify or add entries
3. Re-encrypt names with the XOR cipher
4. Recalculate the hash
5. Serve the modified file and update the hash in OnSuperMainStart

The client trusts whatever items.dat the server provides — it doesn't validate against an official copy.
