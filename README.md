# Growtopia Private Server (GTPS) Documentation

> Complete technical documentation for building a Growtopia Private Server from scratch.

## What is GTPS?

Growtopia is a 2D MMO sandbox game (originally by Seth Robinson & Hamumu Software, now Ubisoft). A **Growtopia Private Server** emulates the official game protocol so the unmodified retail client connects to your custom server instead.

The client uses **ENet** (reliable UDP) for gameplay and **HTTPS** for the initial login handshake. By redirecting DNS (or editing the hosts file), the client talks to your server transparently.

---

## Documentation

| # | File | Contents |
|---|------|----------|
| 01 | [Protocol](docs/01-protocol.md) | ENet configuration, message types, packet format |
| 02 | [Login Flow](docs/02-login-flow.md) | Full connection sequence from HTTP to world entry |
| 03 | [Tank Packet](docs/03-tank-packet.md) | 56-byte binary packet layout, flags, usage |
| 04 | [Variant System](docs/04-variant-system.md) | Server-to-client RPC mechanism |
| 05 | [World System](docs/05-world-system.md) | World structure, generation, binary format |
| 06 | [Player System](docs/06-player-system.md) | Player data, inventory, clothing, roles |
| 07 | [Item Database](docs/07-item-database.md) | items.dat binary format, encryption, types |
| 08 | [Game Systems](docs/08-game-systems.md) | Farming, locks, economy, trading, features |
| 09 | [Dialog System](docs/09-dialog-system.md) | UI dialog markup language |
| 10 | [Reference](docs/10-reference.md) | All packet types, actions, variants, commands |
| 11 | [Advanced Protocol](docs/11-advanced-protocol.md) | Inventory format, tile extras, ping, object pickup |

---

## Architecture Overview

```
                    +-------------------+
                    |  Growtopia Client |
                    +--------+----------+
                             |
              +--------------+--------------+
              |                             |
     HTTPS POST (login)            ENet UDP (gameplay)
              |                             |
              v                             v
   +----------+----------+      +-----------+-----------+
   | HTTP Server          |      | Game Server            |
   | /growtopia/          |      | Port 17091             |
   | server_data.php      |      | ENet + CRC32 +         |
   | Returns IP:port      |      | Range Coder            |
   +----------------------+      +------------------------+
                                            |
                                            v
                                 +----------+----------+
                                 | Database             |
                                 | (players, worlds)    |
                                 +---------------------+
```

## Tech Stack

```
Transport    ENet (reliable UDP) with CRC32 checksum + Range Coder compression
Login        HTTPS POST to /growtopia/server_data.php
Game Data    Binary protocol (56-byte tank packets) + pipe-delimited text
Item DB      items.dat (~5MB binary, served once, cached by client)
Default Port 17091 UDP
```

## Minimum Viable Server (Checklist)

```
[x] HTTP endpoint returning server IP + port
[x] ENet host with CRC32 + Range Coder enabled
[x] Send SERVER_HELLO on client connect
[x] Parse client login data (GENERIC_TEXT)
[x] Validate or create player account
[x] Send OnSuperMainStart variant (items.dat hash, CDN, settings)
[x] Serve items.dat binary (SEND_ITEM_DATABASE_DATA)
[x] Handle action|enter_game
[x] Handle action|join_request -> generate world -> send SEND_MAP_DATA
[x] Send OnSpawn for all players in world
[x] Send SEND_INVENTORY_STATE
[x] Handle PACKET_STATE (movement) and broadcast to others
[x] Handle TILE_CHANGE_REQUEST (place/break) and broadcast
[x] Handle disconnect -> save player, broadcast OnRemove
```

## Common Mistakes

| Symptom | Cause |
|---------|-------|
| Client disconnects immediately | CRC32 or Range Coder not enabled |
| Client ignores packets | Packet exceeds 16384 bytes |
| Text packet fails | Missing null terminator |
| Client re-downloads items.dat every login | Hash mismatch in OnSuperMainStart |
| Players invisible to each other | net_id not unique per world |
| Player appears at wrong position | Using tile coords instead of pixels (pixel = tile * 32) |
| Variant call does nothing | Index 0 is not a string (must be function name) |
| Extended data missing | EXTENDED flag (0x08) not set in tank packet |
| Byte corruption | Not using Little-Endian byte order |

---

## Tools

| Tool | Description |
|------|-------------|
| [itemsdat-codec](tools/itemsdat-codec/) | items.dat decoder/encoder (Node.js, zero deps, supports v11-v26) |

---

> Built from reverse-engineering analysis of NiceTopia, GTServer/HappyPS, GTopia, and GTProxy-fix.
