# Player System

## Overview

Every connected client is represented by a Player object on the server. Players have persistent data (saved to database) and session data (exists only while connected).

## Persistent Data (saved to DB)

```
user_id         Unique account ID (never changes)
grow_id         Username (GrowID)
password        Hashed password
display_name    Name with color formatting
country         Country code
gems            Gem balance
level           Current level
xp              Experience points
skin_color      Skin color (ARGB uint32)
hair_color      Hair color
eye_color       Eye color
inventory       All items the player owns
clothing        Currently equipped items (10 slots)
role            Permission level (player, mod, admin)
playmods        Active buffs/effects with timers
friends         Friend list
achievements    Completed achievements
owned_worlds    List of worlds this player owns (has world lock in)
```

## Session Data (exists while connected)

```
net_id          Network ID assigned per-world (unique within that world)
peer            ENet peer pointer (the connection)
ip_address      Client IP
current_world   Which world they're currently in
pos_x, pos_y    Current position in pixels
flags           Session flags (logged_in, in_world, invisible, etc.)
```

## Network ID (net_id)

This is one of the most important concepts:

- Assigned when a player **enters a world** (not on login)
- **Unique per world**, not globally. Two players in different worlds can have the same net_id.
- Used in all tank packets to identify who is moving, punching, etc.
- Released when the player leaves the world
- Typically assigned incrementally (0, 1, 2, 3...)

## Character Physics

| Property | Default | What it does |
|----------|---------|--------------|
| Speed | 250-260 | Horizontal movement speed |
| Gravity | 1000 | How fast the player falls |
| Acceleration | 1000 | How quickly speed changes |
| Punch Range | 128 px | How far punches reach (4 tiles) |
| Build Range | 128 px | How far blocks can be placed (4 tiles) |
| Punch Strength | 350 | Knockback force applied to other players |
| Water Speed | 125-150 | Movement speed in water |

These values are modified by PlayMods (buffs from equipped items). For example, equipping speed-boosting shoes increases Speed, or wings might reduce Gravity.

## Clothing (10 Slots)

```
Slot  Name     Examples
----  ----     --------
0     Hair     Spiky Hair, Blonde Locks, Dreadlocks
1     Shirt    T-Shirt, Armor, Tuxedo
2     Pants    Jeans, Shorts, Skirt
3     Shoes    Sneakers, Boots, Sandals
4     Face     Sunglasses, Gas Mask, Monocle
5     Hand     Pickaxe, Sword, Wrench Wand
6     Back     Cape, Wings, Jetpack, Backpack
7     Hat      Crown, Helmet, Top Hat
8     Chest    Necklace, Chest Plate, Scarf
9     Ances    Ancestral Wings, Aura effects
```

Each slot holds one item_id (uint16). Equipping an item may grant PlayMods that change character properties or visual effects.

### Sending Clothing Updates

Use the `OnSetClothing` variant. The clothing data is packed into vec3 values:

```
Variant[0] = "OnSetClothing"
Variant[1] = vec3(hair, shirt, pants)       // as floats
Variant[2] = vec3(shoes, face, hand)
Variant[3] = vec3(back, hat, chest)
Variant[4] = skin_color (int)
Variant[5] = vec3(ances, 0, 0)
```

## Inventory

### Structure

```
Default capacity    16 slots
Maximum capacity    596 slots (upgraded via gem store, +10 per purchase)
Items per slot      item_id (uint16) + count (uint16, max 200) + flags (uint8)
Permanent items     Fist (ID 0) + Wrench (ID 1) — always present, cannot be removed
```

### Binary Format (SEND_INVENTORY_STATE)

Sent as tank packet type 9 with EXTENDED flag:

```
uint8     version
uint32    backpack_size       (total slot capacity)
uint16    item_count          (how many items currently held)
[per item:]
  uint16  item_id
  uint16  count
  uint8   flags              (bit 0 = equipped in clothing slot)
```

### Modifying Inventory

For small changes (give/take one item), use tank packet type 13 (MODIFY_ITEM_INVENTORY) instead of resending the entire inventory:

```
tank.type = 13
tank.net_id = player_net_id
tank.int_data = item_id
tank.secondary_id = count    (positive = add, negative = remove)
```

## Roles and Permissions

| Role | Level | Capabilities |
|------|-------|-------------|
| Player | 0 | Normal gameplay |
| VIP | 1 | Cosmetic perks, extra features |
| Mini-Mod | 2 | Can kick and mute players |
| Moderator | 3 | Full moderation (ban, pull, ghost, nuke) |
| Super Mod | 4 | Extended moderation powers |
| Admin/Dev | 5 | Unrestricted access, spawn items, modify anything |

Roles determine which commands a player can use and what actions they can perform.

## XP and Leveling

```
XP required for next level = 50 * (current_level^2 + 2)
Maximum level = 125
```

XP is earned from:
- Breaking blocks
- Placing blocks
- Harvesting trees
- Completing surgeries
- Special events and quests

Level is displayed next to the player's name and unlocks certain features.

## Player Flags

```
LOGGED_ON       Player has completed login
IN_WORLD        Player is currently in a world
INVISIBLE       Ghost mode (moderators)
MOD             Moderator mode active (noclip, invincible)
FACING_LEFT     Currently facing left
SUPPORTER       Has supporter status
```

## Skin and Appearance

```
Skin color      uint32 ARGB (default: 0xB48A78FF, a tan color)
Hair color      Customizable via dye items
Eye color       Customizable via dye items
Pupil color     Customizable
```

Special effects:
- Rainbow skin: cycles through colors automatically (PlayMod)
- Zombie skin: green tint (infection PlayMod)
- Ghost: translucent (Ghost in the Shell PlayMod)

## Player Lifecycle

```
1. Client connects (ENet)
2. Server sends SERVER_HELLO
3. Client sends login data
4. Server validates -> creates Player object -> LOGGED_ON
5. Client sends enter_game -> server shows world menu
6. Client sends join_request -> server assigns net_id -> IN_WORLD
7. Player interacts (move, build, chat, trade...)
8. Client sends quit or disconnects
9. Server saves player to DB
10. Server broadcasts OnRemove to world
11. Player object destroyed
```

## Death and Respawn

Players die from: spikes, lava (without fireproof buff), PvP punches, acid, fire.

On death:
1. Server sends `OnKilled` variant to the player
2. Death animation plays
3. Player respawns at their **checkpoint** (if set) or the **Main Door**
4. Brief invincibility after respawn
5. Server sends new position via `OnSetPos`
