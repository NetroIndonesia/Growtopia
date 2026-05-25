# Network Protocol

## How Growtopia Networking Works

Growtopia uses **ENet**, a reliable UDP networking library, with custom modifications. Every single packet between client and server goes through ENet with mandatory compression and checksumming. If you get any of this wrong, the client silently disconnects.

## ENet Configuration

These settings are **non-negotiable** — the client expects exactly this:

```
Port              17091 (UDP, configurable)
Channels          2
Compression       Range Coder (enet_host_compress_with_range_coder)
Checksum          CRC32 (enet_crc32)
Packet delivery   ENET_PACKET_FLAG_RELIABLE
Max packet size   16384 bytes (client rejects anything larger)
Custom flag       usingNewPacketForServer (Growtopia-specific ENet mod)
```

### Server Initialization Code

```cpp
ENetAddress address;
address.host = ENET_HOST_ANY;
address.port = 17091;

ENetHost* server = enet_host_create(&address, max_peers, 2, 0, 0);
server->checksum = enet_crc32;
enet_host_compress_with_range_coder(server);

// Growtopia-specific flag (required for newer clients)
server->usingNewPacketForServer = 1;
```

> You need a modified ENet library that includes the usingNewPacket / usingNewPacketForServer fields. Standard ENet from GitHub won't work. Use the ENet source from any GTPS reference project.

## Message Types

Every ENet packet starts with a 4-byte (uint32_t) message type header:

| Type | Name | Direction | Purpose |
|------|------|-----------|---------|
| 0 | UNKNOWN | — | Unused |
| 1 | SERVER_HELLO | S→C | First packet after client connects |
| 2 | GENERIC_TEXT | C→S | Login data, text input |
| 3 | GAME_MESSAGE | Both | Action messages (key\|value format) |
| 4 | GAME_PACKET | Both | Binary tank packet (56-byte header) |
| 5 | ERROR | S→C | Error message |
| 6 | TRACK | C→S | Analytics/telemetry |
| 7 | CLIENT_LOG_REQUEST | S→C | Request client logs |
| 8 | CLIENT_LOG_RESPONSE | C→S | Client log data |

## Packet Format

### Text Packets (Type 2 and 3)

```
[4 bytes: uint32 message_type][payload: null-terminated string]
```

The string uses Growtopia's pipe-delimited format:
```
key|value\n
key2|value1|value2\n
```

Examples:
```
action|join_request\nname|WORLDNAME\ninvitedWorld|0
action|input\n|text|Hello everyone
action|dialog_return\ndialog_name|signup\ngrowid|TestPlayer
```

### Game Packets (Type 4)

```
[4 bytes: uint32 type=4][56 bytes: GameUpdatePacket struct][N bytes: extended data]
```

Extended data is only present when the EXTENDED flag (bit 3, 0x08) is set in the packet flags field.

## Sending a Text Packet

```cpp
void SendText(ENetPeer* peer, int type, const std::string& text) {
    size_t len = 4 + text.size() + 1;  // header + string + null terminator
    uint8_t* data = new uint8_t[len];
    
    *(uint32_t*)data = type;
    memcpy(data + 4, text.c_str(), text.size() + 1);
    
    ENetPacket* packet = enet_packet_create(data, len, ENET_PACKET_FLAG_RELIABLE);
    enet_peer_send(peer, 0, packet);
    delete[] data;
}
```

## Rate Limiting

The official server enforces rate limits. Your GTPS should too, or exploiters will crash it:

```
Text packets    max 25 per 750ms window
Game packets    max 80 per 750ms window
Connections     max 10 per second per IP
```

Exceeding these limits = immediate disconnect.

## Bandwidth Estimates

```
Movement update     ~60 bytes (per player, per state change)
Tile update         ~60-100 bytes (broadcast to all in world)
World data          10KB - 500KB (depends on tile extras)
items.dat           ~5MB (sent once, client caches it)
Variant call        50-500 bytes (depends on arguments)
```

## Important Notes

1. **All data is Little-Endian.** Growtopia runs on x86/ARM LE platforms.
2. **Text packets MUST be null-terminated.** Forgetting the \0 causes parsing failures.
3. **The 16384 byte limit is enforced client-side.** If you send a larger packet, the client drops it silently. For large data (world maps, items.dat), the client handles reassembly internally via ENet's fragmentation.
4. **CRC32 + Range Coder are mandatory.** Without both, the client disconnects within milliseconds of connecting. There is no fallback mode.
5. **Channel 0** is used for all game traffic. Channel 1 appears unused in practice.
