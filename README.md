# Growtopia Private Server (GTPS)

> Dokumentasi teknis untuk pengembangan Growtopia Private Server. Mencakup protokol, packet structure, game systems, dan implementasi.

---

## Table of Contents

- [Overview](#overview)
- [Network Protocol](#network-protocol)
- [Login Flow](#login-flow)
- [Packet Structure](#packet-structure)
- [Tank Packet](#tank-packet)
- [Variant System](#variant-system)
- [World System](#world-system)
- [Player System](#player-system)
- [Item Database](#item-database)
- [Farming & Splicing](#farming--splicing)
- [Lock System](#lock-system)
- [Economy](#economy)
- [Dialog System](#dialog-system)
- [PlayMods](#playmods)
- [Game Features](#game-features)
- [Chat & Commands](#chat--commands)
- [Sub-Server Transfer](#sub-server-transfer)
- [Packet Reference](#packet-reference)
- [Action Reference](#action-reference)
- [Variant Reference](#variant-reference)
- [Implementation Checklist](#implementation-checklist)

---

## Overview

GTPS adalah server custom yang mengemulasi protokol Growtopia menggunakan **ENet** (reliable UDP). Client resmi Growtopia bisa langsung connect tanpa modifikasi — cukup redirect DNS/hosts file ke IP server.

**Stack:**
- Transport: ENet (UDP) dengan CRC32 + Range Coder
- Login: HTTPS POST (server_data.php)
- Data: Binary protocol (tank packets) + pipe-delimited text
- Item DB: items.dat binary file (~5MB)

---

## Network Protocol

### ENet Configuration

```
Port            : 17091 (UDP)
Channels        : 2
Compression     : Range Coder (WAJIB)
Checksum        : CRC32 (WAJIB)
Delivery        : ENET_PACKET_FLAG_RELIABLE
Max Packet      : 16384 bytes
Custom Flag     : usingNewPacketForServer
```

> Tanpa CRC32 + Range Coder, client akan langsung disconnect.

### Message Types

```cpp
0  UNKNOWN
1  SERVER_HELLO          // server kirim saat client connect
2  GENERIC_TEXT          // login data, chat input
3  GAME_MESSAGE          // action|value format
4  GAME_PACKET           // binary tank packet (56B header)
5  ERROR
6  TRACK
7  CLIENT_LOG_REQUEST
8  CLIENT_LOG_RESPONSE
```

Format packet: [4 byte type][payload]

- Type 2/3: payload = null-terminated string
- Type 4: payload = 56-byte struct + optional extended data

---

## Login Flow

```
Client                              Server
  |                                   |
  |--- HTTPS POST server_data.php --->|
  |<-- server|ip\nport|17091 ---------|
  |                                   |
  |--- ENet Connect ----------------->|
  |<-- SERVER_HELLO ------------------|
  |--- GENERIC_TEXT (login data) ---->|
  |<-- OnSuperMainStart (variant) ----|
  |--- action|enter_game ------------>|
  |<-- World Select Menu -------------|
  |--- action|join_request ---------->|
  |<-- SEND_MAP_DATA ----------------|
  |<-- OnSpawn (semua player) --------|
  |<-- SEND_INVENTORY_STATE ----------|
  |                                   |
  |========= Gameplay Loop ===========|
```

### server_data.php Response

```
server|127.0.0.1
port|17091
type|1
type2|1
meta|encrypted_data
RTENDMARKERBS1001
```

### Login Data (Client -> Server)

Field penting yang dikirim client:

```
tankIDName|GrowID           // username
tankIDPass|password         // password
requestedName|Guest         // nama guest (jika belum punya GrowID)
protocol|225                // versi protokol
game_version|5.39           // versi client
country|id                  // negara
platformID|0,1,1            // platform (Win/iOS/Android)
lmode|0                     // login mode (0=normal, 2=transfer)
rid|...                     // device ID (32 hex)
mac|...                     // MAC address
wk|...                      // Windows key
hash|...                    // hardware hash
hash2|...                   // hardware hash 2
meta|win/hash/id            // device metadata
```

---

## Packet Structure

### Text Packet (Type 2 & 3)

```
[uint32 type][null-terminated string]
```

String menggunakan format key|value\n:
```
action|join_request\nname|WORLDNAME\ninvitedWorld|0
```

### Game Packet (Type 4)

```
[uint32 type=4][56-byte GameUpdatePacket][extended data jika flag EXTENDED]
```

---

## Tank Packet

56 bytes, packed struct. Ini adalah format binary utama untuk semua game communication.

```
Offset  Size  Field            Keterangan
------  ----  -----            ----------
0       1     type             packet sub-type (0-46)
1       1     pad1             punch_id / build_range
2       1     pad2             punch_range
3       1     pad3             anim_type
4       4     net_id           player network ID
8       4     secondary_id     target / item count
12      4     flags            state bitfield
16      4     float1           water_speed
20      4     int_data         item_id / planting_tree
24      4     pos_x            position X (float, PIXELS)
28      4     pos_y            position Y (float, PIXELS)
32      4     speed_x          velocity X (float)
36      4     speed_y          velocity Y (float)
40      4     float2           particle_rotation
44      4     tile_x           target tile X (int)
48      4     tile_y           target tile Y (int)
52      4     data_size        extended data length
```

> Posisi dalam PIXEL. Konversi: 	ile = pixel / 32

### Flags Penting

```
0x08     EXTENDED         ada data setelah 56-byte header
0x10     ROTATE_LEFT      player hadap kiri
0x20     ON_SOLID         di atas ground
0x80     ON_JUMP          lompat
0x100    ON_KILLED        mati
0x200    ON_PUNCHED       sedang punch
0x400    ON_PLACED        sedang place block
0x2000   ON_RESPAWNED     baru respawn
0x4000   ON_COLLECT       ambil dropped item
```

---

## Variant System

Mekanisme RPC utama server->client. Dikirim sebagai tank packet type=1 dengan flag EXTENDED.

### Serialization Format

```
[1B count]
per variant:
  [1B index]    // 0 = nama fungsi
  [1B type]     // tipe data
  [data]        // payload
```

### Variant Types

```
1 = FLOAT      (4B)
2 = STRING     (4B length + chars)
3 = VEC2       (8B, 2x float)
4 = VEC3       (12B, 3x float)
5 = UINT       (4B)
9 = INT        (4B)
```

### Contoh: Kirim OnConsoleMessage

```
count: 2
[0] type=STRING value="OnConsoleMessage"
[1] type=STRING value="Hello 2World`!"
```

Dibungkus dalam tank packet:
```
tank.type = 1 (CALL_FUNCTION)
tank.net_id = -1 (broadcast) atau target net_id
tank.flags = 0x08 (EXTENDED)
tank.data_size = variant_bytes.length
```

---

## World System

### Specs

```
Size        : 100 x 60 tiles (default)
Tile Size   : 32 x 32 pixels
Total Pixels: 3200 x 1920
Version     : 0x14 (20)
```

### Generation (Normal World)

```
Row 0-23  : Air (kosong)
Row 24    : Bedrock + Main Door (spawn)
Row 25-35 : Dirt + Cave Background
Row 36-53 : Rock + Cave Background
Row 54-59 : Bedrock (indestructible)
```

Tipe lain: Beach, Mars, Desert, Jungle, Underwater, Cave, Sky, dll.

### World Binary Format (SEND_MAP_DATA)

```
[uint16 version]
[uint32 reserved]
[uint16 name_len][chars name]
[uint32 width][uint32 height][uint32 tile_count]

per tile:
  [uint16 foreground][uint16 background]
  [uint16 parent][uint16 flags]
  [tile_extra jika flags & HAS_EXTRA]

[uint32 object_count][uint32 last_object_id]
per object:
  [uint16 item_id][float x][float y]
  [uint8 count][uint8 flags][uint32 object_id]

[uint16 base_weather][uint16 current_weather]
```

### World Flags

```
JAMMED            tersembunyi dari search
NUKED             world di-reset
PUNCH_JAMMER      ga bisa punch player
ZOMBIE_JAMMER     zombie ga nyebar
ANTI_GRAVITY      gravitasi terbalik
MINI_MOD          ga bisa drop item
NOLOCKS           ga bisa pasang lock
```

---

## Player System

### Character Properties

```
Speed           : 260.0
Gravity         : 1000.0
Acceleration    : 1000.0
Punch Range     : 128 px (4 tiles)
Build Range     : 128 px (4 tiles)
Punch Strength  : 350.0 (knockback)
Water Speed     : 150.0
```

### Clothing Slots (10)

```
0 Hair    1 Shirt    2 Pants    3 Shoes    4 Face
5 Hand    6 Back     7 Hat      8 Chest    9 Ances
```

### Inventory

- Default: 16 slots, max: 596 slots
- Per slot: item_id + count (max 200) + flags
- Starter: Fist + Wrench (permanent)

### Skin & Colors

- Skin color: ARGB uint32 (default 
