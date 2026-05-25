# Tank Packet (GameUpdatePacket)

## What Is It

The tank packet is the core binary format for all real-time game communication. Every movement, block placement, item use, and server notification uses this 56-byte structure. It's called "tank packet" by the community because of the GameUpdatePacket struct name in the original code.

## Layout (56 bytes, packed, little-endian)

```
Offset  Bytes  Field            Type      Purpose
------  -----  -----            ----      -------
0       1      type             uint8     Packet sub-type (0-46)
1       1      pad1             uint8     Context-dependent (punch_id, build_range)
2       1      pad2             uint8     Context-dependent (punch_range, jump_count)
3       1      pad3             uint8     Context-dependent (anim_type)
4       4      net_id           int32     Player's network ID in current world
8       4      secondary_id     int32     Target net_id, item count, or other
12      4      flags            uint32    State bitfield (see below)
16      4      float1           float     Water speed or other float
20      4      int_data         int32     Item ID being placed/used
24      4      pos_x            float     Position X in PIXELS
28      4      pos_y            float     Position Y in PIXELS
32      4      speed_x          float     Horizontal velocity
36      4      speed_y          float     Vertical velocity
40      4      float2           float     Particle rotation or other
44      4      tile_x           int32     Target tile X coordinate
48      4      tile_y           int32     Target tile Y coordinate
52      4      data_size        uint32    Size of extended data (after header)
```

**Total: 56 bytes fixed header.** If the EXTENDED flag is set, data_size bytes follow immediately after.

## C++ Struct

```cpp
#pragma pack(push, 1)
struct GameUpdatePacket {
    uint8_t  type;           // 0
    uint8_t  pad1;           // 1
    uint8_t  pad2;           // 2
    uint8_t  pad3;           // 3
    int32_t  net_id;         // 4
    int32_t  secondary_id;   // 8
    uint32_t flags;          // 12
    float    float1;         // 16
    int32_t  int_data;       // 20
    float    pos_x;          // 24
    float    pos_y;          // 28
    float    speed_x;        // 32
    float    speed_y;        // 36
    float    float2;         // 40
    int32_t  tile_x;         // 44
    int32_t  tile_y;         // 48
    uint32_t data_size;      // 52
};
#pragma pack(pop)
// sizeof(GameUpdatePacket) == 56
```

## Flags Bitfield

| Bit | Hex | Name | Meaning |
|-----|-----|------|---------|
| 1 | 0x02 | UNK | Unknown/reserved |
| 2 | 0x04 | RESET_VISUAL | Reset player visual state |
| 3 | 0x08 | **EXTENDED** | **Extra data follows the 56-byte header** |
| 4 | 0x10 | ROTATE_LEFT | Player is facing left |
| 5 | 0x20 | ON_SOLID | Player is standing on ground |
| 6 | 0x40 | ON_FIRE_DAMAGE | Taking fire damage |
| 7 | 0x80 | ON_JUMP | Player is jumping |
| 8 | 0x100 | ON_KILLED | Player died |
| 9 | 0x200 | ON_PUNCHED | Player is punching |
| 10 | 0x400 | ON_PLACED | Player is placing a block |
| 11 | 0x800 | ON_TILE_ACTION | Tile interaction |
| 12 | 0x1000 | ON_GOT_PUNCHED | Player was hit by another |
| 13 | 0x2000 | ON_RESPAWNED | Player just respawned |
| 14 | 0x4000 | ON_COLLECT | Picking up a dropped item |
| 15 | 0x8000 | ON_TRAMPOLINE | Bouncing on trampoline |
| 16 | 0x10000 | ON_DAMAGE | Taking generic damage |
| 17 | 0x20000 | ON_SLIDE | Sliding on ice |
| 21 | 0x200000 | ON_WALL_HANG | Hanging on wall |
| 26 | 0x4000000 | ON_ACID | Taking acid damage |

### The EXTENDED Flag (0x08)

This is the most important flag. When set, it means there are data_size additional bytes after the 56-byte header. These bytes contain:

- **Variant data** (for CALL_FUNCTION packets)
- **World binary** (for SEND_MAP_DATA)
- **Inventory binary** (for SEND_INVENTORY_STATE)
- **items.dat** (for SEND_ITEM_DATABASE_DATA)
- **Tile data** (for tile updates)

If you forget to set this flag when sending extended data, the client ignores the extra bytes.

## How Each Packet Type Uses the Fields

### TYPE 0: STATE (Player Movement)

Sent by client every time the player moves or changes state.

```
net_id    = this player's net_id
flags     = current state (ON_SOLID, ROTATE_LEFT, ON_JUMP, etc.)
pos_x/y   = new position in pixels
speed_x/y = current velocity
```

Server should broadcast this to all other players in the same world.

### TYPE 1: CALL_FUNCTION (Variant RPC)

Server sends this to execute a function on the client. Always has EXTENDED flag.

```
net_id    = target player net_id (-1 for all)
flags     = 0x08 (EXTENDED)
int_data  = delay in ms before client executes (0 = immediate)
data_size = size of variant payload
[extended] = serialized variant list
```

### TYPE 3: TILE_CHANGE_REQUEST (Place/Break Block)

Client sends this when punching or placing a block.

```
net_id    = player doing the action
int_data  = item_id being placed (0 = fist/punch = breaking)
tile_x/y  = which tile is being targeted
flags     = ON_PUNCHED (breaking) or ON_PLACED (placing)
```

Server validates (ownership, range, inventory) then broadcasts the change.

### TYPE 4: SEND_MAP_DATA (World Data)

Server sends the entire world to a joining player.

```
flags     = 0x08 (EXTENDED)
data_size = world binary size
[extended] = serialized world data
```

### TYPE 9: SEND_INVENTORY_STATE

Server sends the player's full inventory.

```
flags     = 0x08 (EXTENDED)
data_size = inventory binary size
[extended] = serialized inventory
```

### TYPE 13: MODIFY_ITEM_INVENTORY

Server tells client to add or remove a single item (without resending full inventory).

```
net_id    = player
int_data  = item_id
secondary_id = count (positive = add, negative = remove)
```

### TYPE 16: SEND_ITEM_DATABASE_DATA

Server sends items.dat file.

```
flags     = 0x08 (EXTENDED)
data_size = items.dat file size
[extended] = raw items.dat bytes
```

### TYPE 21/22: PING_REPLY / PING_REQUEST

Server periodically sends PING_REQUEST (22). Client responds with PING_REPLY (21). Used for latency measurement and connection keepalive.

## Sending a Tank Packet (Code)

```cpp
void SendTankPacket(ENetPeer* peer, GameUpdatePacket* tank,
                    uint8_t* extra = nullptr, uint32_t extra_size = 0) {
    uint32_t total = 4 + 56;  // message type header + tank struct
    
    if (extra && extra_size > 0) {
        total += extra_size;
        tank->flags |= 0x08;       // set EXTENDED
        tank->data_size = extra_size;
    }
    
    uint8_t* buf = new uint8_t[total];
    *(uint32_t*)buf = 4;            // NET_MESSAGE_GAME_PACKET
    memcpy(buf + 4, tank, 56);
    
    if (extra && extra_size > 0) {
        memcpy(buf + 60, extra, extra_size);
    }
    
    ENetPacket* pkt = enet_packet_create(buf, total, ENET_PACKET_FLAG_RELIABLE);
    enet_peer_send(peer, 0, pkt);
    delete[] buf;
}
```

## Position Conversion

Growtopia uses pixels internally. Tiles are 32x32 pixels.

```
Tile to Pixel:    pixel = tile * 32
Pixel to Tile:    tile = pixel / 32
Index to X,Y:     x = index % world_width;  y = index / world_width
X,Y to Index:     index = y * world_width + x
```

## Receiving and Parsing

```cpp
void OnReceive(ENetPacket* packet) {
    if (packet->dataLength < 4) return;
    
    uint32_t type = *(uint32_t*)packet->data;
    
    if (type == 4 && packet->dataLength >= 60) {
        GameUpdatePacket* tank = (GameUpdatePacket*)(packet->data + 4);
        
        uint8_t* extra = nullptr;
        if ((tank->flags & 0x08) && packet->dataLength >= 60 + tank->data_size) {
            extra = packet->data + 60;
        }
        
        HandleTankPacket(tank, extra, tank->data_size);
    }
}
```
