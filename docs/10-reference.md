# Reference

Complete reference tables for packet types, client actions, variant functions, and chat commands.

---

## All Tank Packet Types (0-46)

| ID | Name | Direction | Purpose |
|----|------|-----------|---------|
| 0 | STATE | Both | Player movement and state update |
| 1 | CALL_FUNCTION | S→C | Variant RPC call |
| 2 | UPDATE_STATUS | S→C | Status update |
| 3 | TILE_CHANGE_REQUEST | C→S | Place, break, or wrench a tile |
| 4 | SEND_MAP_DATA | S→C | Full world data on join |
| 5 | SEND_TILE_UPDATE_DATA | S→C | Single tile changed (broadcast) |
| 6 | SEND_TILE_UPDATE_DATA_MULTIPLE | S→C | Multiple tiles changed |
| 7 | TILE_ACTIVATE_REQUEST | C→S | Interact with tile (wrench, enter door) |
| 8 | TILE_APPLY_DAMAGE | C→S | Punch a tile (damage it) |
| 9 | SEND_INVENTORY_STATE | S→C | Full inventory data |
| 10 | ITEM_ACTIVATE_REQUEST | C→S | Use or consume an item |
| 11 | ITEM_ACTIVATE_OBJECT_REQUEST | C→S | Use item on a dropped object |
| 12 | SEND_TILE_TREE_STATE | S→C | Tree growth state update |
| 13 | MODIFY_ITEM_INVENTORY | S→C | Add or remove a single item |
| 14 | ITEM_CHANGE_OBJECT | S→C | Modify a dropped object |
| 15 | SEND_LOCK | S→C | Lock tile data |
| 16 | SEND_ITEM_DATABASE_DATA | S→C | items.dat binary |
| 17 | SEND_PARTICLE_EFFECT | S→C | Particle effect |
| 18 | SET_ICON_STATE | Both | Icon state change |
| 19 | ITEM_EFFECT | S→C | Item visual effect |
| 20 | SET_CHARACTER_STATE | S→C | Character state flags |
| 21 | PING_REPLY | C→S | Client responds to ping |
| 22 | PING_REQUEST | S→C | Server requests ping |
| 23 | GOT_PUNCHED | S→C | Player was hit by another player |
| 24 | APP_CHECK_RESPONSE | C→S | Anti-cheat response |
| 25 | APP_INTEGRITY_FAIL | S→C | Integrity check failed |
| 26 | DISCONNECT | S→C | Force disconnect |
| 27 | BATTLE_JOIN | Both | Battle join |
| 28 | BATTLE_EVENT | Both | Battle event |
| 29 | USE_DOOR | C→S | Enter a door or portal |
| 30 | SEND_PARENTAL | S→C | Parental controls |
| 31 | GONE_FISHIN | Both | Fishing action |
| 32 | STEAM | Both | Steam integration |
| 33 | PET_BATTLE | Both | Pet battle |
| 34 | NPC | Both | NPC interaction |
| 35 | SPECIAL | Both | Special packet |
| 36 | SEND_PARTICLE_EFFECT_V2 | S→C | Particle effect v2 |
| 37 | ACTIVE_ARROW_TO_ITEM | S→C | Arrow indicator to item |
| 38 | SELECT_TILE_INDEX | C→S | Select a tile |
| 39 | SEND_PLAYER_TRIBUTE_DATA | S→C | Player tribute data |
| 40 | FTUE_SET_ITEM_TO_QUICK_INVENTORY | S→C | Tutorial quick slot |
| 41 | PVE_NPC | Both | PvE NPC |
| 42 | PVP_CARD_BATTLE | Both | PvP card battle |
| 43 | PVE_APPLY_PLAYER_DAMAGE | Both | PvE damage to player |
| 44 | PVE_NPC_POSITION_DAMAGE | Both | PvE NPC position |
| 45 | SET_EXTRA_MODS | S→C | Extra mods |
| 46 | ON_STEP_ON_TILE_MOD | C→S | Stepped on tile mod |

---

## All Client Actions (action|...)

These are sent by the client as `NET_MESSAGE_GAME_MESSAGE` (type 3):

### Session

```
enter_game              Client ready after login
quit                    Leave world
quit_to_exit            Disconnect from server
refresh_item_data       Request items.dat re-download
respawn                 Request respawn after death
```

### World

```
join_request            Join a world (includes name|WORLDNAME)
```

### Chat and Social

```
input                   Chat message (includes |text|message)
friends                 Open friends list
```

### Items

```
drop                    Drop item from inventory
trash                   Delete item permanently
```

### Interaction

```
wrench                  Wrench a player or tile
dialog_return           Submit a dialog form (includes all field values)
info                    Request info about something
```

### Store

```
store                   Open the gem store
```

### Account

```
growid                  GrowID creation/management
setSkin                 Change skin color
```

---

## All Variant Functions (Server → Client)

### Essential

| Function | Arguments | Purpose |
|----------|-----------|---------|
| `OnSuperMainStart` | (uint) hash, (str) cdn, (str) settings | Welcome after login |
| `OnSpawn` | (str) spawn_data | Spawn a player in world |
| `OnRemove` | (str) remove_data | Remove player from world |
| `OnConsoleMessage` | (str) text | Display message in chat |
| `OnDialogRequest` | (str) markup | Show UI dialog |
| `OnTalkBubble` | (uint) net_id, (str) text, (int) type | Chat bubble above player |
| `OnSetPos` | (vec2) position | Teleport player |
| `SetHasGrowID` | (int) flag, (str) name, (str) token | Account info |
| `OnRequestWorldSelectMenu` | (str) data | World select screen |
| `OnFailedToEnterWorld` | — | World join failed |
| `OnKilled` | — | Player died |

### Player State

| Function | Arguments | Purpose |
|----------|-----------|---------|
| `OnSetClothing` | (vec3)x3, (int) skin, (vec3) ances | Update clothing |
| `OnNameChanged` | (uint) net_id, (str) name | Change display name |
| `OnCountryState` | (str) country | Set flag icon |
| `OnSetFreezeState` | (int) state | Freeze/unfreeze |
| `OnSetBux` | (int) gems | Update gem display |
| `OnEmoticonDataChanged` | (int) net_id, (int) emote | Show emote |

### World

| Function | Arguments | Purpose |
|----------|-----------|---------|
| `OnSetCurrentWeather` | (int) weather_id | Change weather |
| `OnPlayPositioned` | (str) audio_file | Play sound |
| `OnTextOverlay` | (str) text | Big text on screen |

### System

| Function | Arguments | Purpose |
|----------|-----------|---------|
| `OnSendToServer` | (int) port, (int) token, (int) uid, (str) addr, (int) mode | Sub-server transfer |
| `OnStoreRequest` | (str) data | Open store |
| `OnProgressUI` | varies | Progress bar |

---

## Chat Commands

> **Note:** chat commands are not part of the Growtopia protocol — they are
> server-defined `action|input` text handlers. Different GTPS implementations
> ship different sets. The lists below combine the canonical retail-era set
> (which the official client recognises in tooltips) with common private-server
> additions (verified across NiceTopia, Gurotopia, Windsverse, GTServer).
> Treat them as conventions, not a wire-level spec.

### Verified across all reference servers

```
/help    /?         /me {msg}     /sb {msg}    /who    /find {item}
/warp {world}        /weather {id} /skin {id}   /ghost  /punch {id}
/news    /ageworld
```

These are confirmed in Gurotopia's `cmd_pool` map (`commands/__command.cpp`).
Most also exist in NiceTopia/Windsverse with identical syntax.

### Player (level 0, retail conventions)

```
/help       /msg {name} {text}    /me {msg}      /status     /trade {name}
/friends    /ignore {name}         /go {world}    /home       /sethome
/who        /time                  /sb {msg}      /report     /guild
/exchange   /market                /quit
```

Emote commands (handled by `OnAction` variant in Gurotopia):

```
/wave  /dance  /dance2  /love   /sleep    /facepalm /fp  /smh
/yes   /no     /omg     /idk    /shrug    /furious  /rolleyes
/foldarms /fa  /stubborn /fold  /dab      /sassy    /march
/grumpy /shy
```

### VIP / Supporter

```
/warp       /rainbow    /chatcolor  /inventory  /surgerys
/ghost      /hide       /warpto     /info       /unequip   /pay
```

### Moderator

```
/invis      /kick       /ban        /mute       /unmute
/curse      /uncurse    /pull       /summon     /find
/nick       /nuke       /freeze     /skin
```

### Developer / Admin

```
/give       /drop       /clearworld /resetworld /trashall
/modfly     /onehit     /reloadworld /setitem   /giveitem
/summonall  /copyworld  /setgems    /boostgem   /boostxp
/changeowner /scan
```

### Creator (Owner)

```
/edititem   /pasteworld /setworld   /setrole    /boost
/rollbackworld  /rollbackplayer  /auction  /giveaway
```

If a command in this list is not in your reference codebase, treat it as
optional — implementing it is up to you.

---

## World Weather IDs

Sourced from Gurotopia's `get_weather_id` switch (`include/commands/weather.cpp`)
and the retail `eWorldWeather` enum. IDs are sequential; the table covers every
weather machine ID confirmed in current references.

```
 0  DEFAULT (Sunny)      1  BEACH (Sunset)       2  NIGHT
 3  ARID                 4  SUNNY                5  RAINY_CITY
 6  HARVEST_MOON         7  MARS                 8  SPOOKY
 9  GROWGANOTH          10  NOTHINGNESS          11  SNOWY
12  GROWCH_MAD          13  GROWCH_HAPPY         14  UNDERSEA
15  WARP                16  GREEN_COMET          17  COMET
18  PARTY               19  PINEAPPLE            20  SNOWY_NIGHT
21  SPRING              22  HOWL                 23  HEATWAVE_BASE
24  HEATWAVE_P          25  HEATWAVE_R           26  HEATWAVE_G
27  HEATWAVE_B          28  HEATWAVE_O           29  STUFF
30  PAGODA              31  APOCALYPSE           32  JUNGLE
33  BALLOON             34  BACKGROUND           35  AUTUMN
36  VALENTINE           37  ST_PADDY             38  EPOCH_ICE
39  EPOCH_VOLCANO       40  EPOCH_LAND           41  SUNNY_V3
42  DIGITAL_RAIN        43  MONOCHROME           44  FROZENCLIFF
45  SURGWORLD           46  BOUNTIFUL            47  STARGAZING
48  METEOR_SHOWER       49  ISLAND               50  RETIRED_SHIP
51  CELEBRITY_HILLS     52  PVE_JUNGLE           53  LEGENDARY_LOCK
54  BLOOD_DRAGON        55  PERSIA               59  PLAZA
60  NEBULA              61  PROTOSTAR_LANDING    62  DARK_MOUNTAINS
64  MT_GROWMORE         65  CRACK_IN_REALITY     66  NIAN_MOUNTAINS
69  REALM_OF_SPIRITS    70  BLACK_HOLE           71  RAINING_GEMS
72  HOLIDAY_HEAVEN      76  ATLANTIS             77  PINUSKI_HAVEN
78  CANDYLAND           79  DRAGONS_KEEP         80  EMERALD_CITY
```

Newer weather machines added after 5.46 may use IDs above 80 — check your
target client build.

---

## World Flags (Bitmask)

```
Bit 0   (1)     NUKED
Bit 1   (2)     RESTRICT_NOCLIP
Bit 2   (4)     JAMMED
Bit 3   (8)     PUNCH_JAMMER
Bit 4   (16)    ZOMBIE_JAMMER
Bit 5   (32)    ANTI_GRAVITY
Bit 6   (64)    BALLOON_JAMMED
Bit 7   (128)   MINI_MOD
Bit 8   (256)   GUARDIAN_PINEAPPLE
Bit 9   (512)   NOLOCKS
Bit 10  (1024)  HAUNTED
Bit 11  (2048)  NOGO
Bit 12  (4096)  NOEVENTS
```

Set/cleared by placing or removing specific jammer items in the world.
