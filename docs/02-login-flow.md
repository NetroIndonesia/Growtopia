# Login Flow

## Overview

The Growtopia login process has two phases: an HTTPS handshake that tells the client where to connect, followed by an ENet session that handles authentication and game entry. Understanding this flow is critical — get any step wrong and the client either won't connect or will hang indefinitely.

## Full Sequence

```
Client                              Server
  |                                   |
  |--- [1] HTTPS POST --------------->|  /growtopia/server_data.php
  |<-- [2] server|ip\nport|17091 -----|  pipe-delimited response
  |                                   |
  |--- [3] ENet Connect ------------->|  UDP to ip:port from step 2
  |<-- [4] SERVER_HELLO --------------|  empty/minimal packet
  |--- [5] GENERIC_TEXT (login) ----->|  all client info
  |<-- [6] OnSuperMainStart ----------|  variant: hash, CDN, settings
  |                                   |
  |--- [7] refresh_item_data -------->|  (only if hash mismatch)
  |<-- [8] SEND_ITEM_DATABASE_DATA ---|  items.dat binary
  |                                   |
  |--- [9] action|enter_game -------->|  client ready
  |<-- [10] World Select Menu --------|  or gazette/news
  |--- [11] action|join_request ----->|  name|WORLDNAME
  |<-- [12] SEND_MAP_DATA ------------|  world binary
  |<-- [13] OnSpawn (all players) ----|  one per player in world
  |<-- [14] SEND_INVENTORY_STATE -----|  player's inventory
  |                                   |
  |=========== Gameplay ==============|
```

## Step 1-2: HTTPS Login

The client sends an HTTPS POST to `https://www.growtopia1.com/growtopia/server_data.php` (and the IPv6 fallback `growtopia2.com`).

For your GTPS, you redirect this domain to your server (via hosts file or DNS). Your HTTP server responds with:

```
server|127.0.0.1
port|17091
type|1
type2|1
maint|0
beta_server|
beta_port|0
beta_type|0
meta|optional_encrypted_data
RTENDMARKERBS1001
```

| Field | Purpose |
|-------|---------|
| `server` | IP address of your game server |
| `port` | ENet port |
| `type` | Server type flag (1 = normal) |
| `type2` | Must be 1 for sub-server support |
| `maint` | Maintenance mode flag (0 = open, 1 = closed) |
| `beta_*` | Beta server fallback (set to empty/0 if unused) |
| `meta` | Optional encrypted metadata token |
| `RTENDMARKERBS1001` | End marker (required) |

The client then disconnects HTTP and initiates an ENet connection to the given IP:port.

## Step 3-4: ENet Connect + Server Hello

When the client connects via ENet, your server must immediately send `NET_MESSAGE_SERVER_HELLO` (type 1). This is just the 4-byte type header — no payload required. Many servers send only the 4 bytes, others pad with a zeroed `GameUpdatePacket`. Both work.

```cpp
// Minimal SERVER_HELLO
uint32_t type = 1;
ENetPacket* p = enet_packet_create(&type, 4, ENET_PACKET_FLAG_RELIABLE);
enet_peer_send(peer, 0, p);
```

This tells the client "I'm a Growtopia server, send me your login."

## Step 5: Client Login Data

The client responds with `NET_MESSAGE_GENERIC_TEXT` (type 2) containing all login information as pipe-delimited text:

```
tankIDName|MyGrowID
tankIDPass|MyPassword
requestedName|GuestPlayer
f|1
protocol|225
game_version|5.39
fhash|-716928004
lmode|0
cbits|1024
player_age|0
GDPR|1
category|_-5100
totalPlaytime|0
klv|abcdef1234567890
hash2|-891238
meta|win/abcdef12/1234
fz|some_fingerprint
lmode|0
cbits|1024
rid|a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
platformID|0,1,1
deviceVersion|0
country|id
hash|-1232141
mac|02:00:00:00:00:00
wk|f1e2d3c4b5a6f1e2d3c4b5a6f1e2d3c4
zf|some_fingerprint
aid|12345678-1234-1234-1234-123456789abc
gid|abcdef1234567890
```

### Key Fields

| Field | What it is | Notes |
|-------|-----------|-------|
| `tankIDName` | GrowID (username) | Empty if guest login |
| `tankIDPass` | Password | Empty if guest login |
| `requestedName` | Guest display name | Only used when no GrowID |
| `protocol` | Protocol version | e.g. 225 |
| `game_version` | Client version | e.g. "5.39" |
| `lmode` | Login mode | 0 = normal, 2 = sub-server transfer |
| `country` | Country code | "id", "us", "br", etc. |
| `platformID` | Platform | "0,1,1" = Windows, "1,1,1" = iOS, etc. |
| `rid` | Device ID | 32 hex chars, unique per device |
| `mac` | MAC address | Device identifier |
| `wk` | Windows Key | Hardware ID (Windows only) |
| `klv` | Key validation | Login token (newer clients) |
| `hash` / `hash2` | Hardware hashes | Device fingerprinting |
| `meta` | Device metadata | Format: `platform/hash/id` |
| `f` | Sub-flag | Usually 1 |
| `cbits` | Capability bits | Feature flags |
| `GDPR` | EU consent | 1 = accepted |

### Login Types

**Guest Login:** `requestedName` is set, `tankIDName` is empty. Server assigns a random suffix like `Player_482`.

**GrowID Login:** `tankIDName` + `tankIDPass` are set. Server validates against database.

**Transfer:** `lmode=2`. Player is being redirected from another sub-server. Validate the transfer token instead of password.

### Token-Based Login (Newer Clients)

Newer Growtopia clients (v3.9+ and definitely v4.6+) encode login data as a base64 `ltoken` field instead of individual key|value pairs. The token typically wraps the same fields above. Your server needs to:

1. Detect the `ltoken|...` line in the GENERIC_TEXT payload
2. Base64-decode the token body
3. Parse the inner pipe-delimited string back into the legacy format

If the wrapped payload is encrypted/encoded by the client (some builds do this), the simplest path is to refuse `ltoken` logins and force the client back to legacy mode by sending an error message and disconnecting; most retail clients then retry with plain text.

## Step 6: OnSuperMainStart

After validating the login, send the `OnSuperMainStart` variant:

```
Variant[0] = "OnSuperMainStart"               (string, function name)
Variant[1] = items_dat_hash                   (uint32, for client caching)
Variant[2] = "ubistatic-a.akamaihd.net"       (string, CDN host)
Variant[3] = "cc.cz...."                      (string, cache/settings data)
Variant[4] = "cuid"                           (string, optional client UID)
Variant[5] = "F"                              (string, login token marker)
Variant[6] = "proto=225|choosemusic=audio/mp3/about_theme.mp3|active_holiday=0|wing_week_day=0|ubi_week_day=0|server_tick=378940000|clash_active=0|drop_lavacheck_faster=1|isPayingUser=0|usingStoreNavigation=1|enableInventoryTab=1|bigBackpack=1|"  (string, settings blob)
```

The retail client ships with the function name `OnSuperMainStart` but several
private servers concatenate an anti-replay marker, e.g.
`OnSuperMainStartAcceptLogonHrdxs47254722215a`. Either prefix is recognised so
long as the string at index 0 starts with `OnSuperMainStart`.

`items_dat_hash` is critical — if it matches what the client has cached, the client skips downloading items.dat. If it doesn't match, the client sends `action|refresh_item_data`.

## Step 7-8: items.dat (Conditional)

If the client needs items.dat, it sends `action|refresh_item_data`. Server responds with a tank packet:

```
type      = 16 (SEND_ITEM_DATABASE_DATA)
flags     = 0x08 (EXTENDED)
data_size = items.dat file size
extended  = raw items.dat bytes
```

This is a large packet (~5–8 MB) but ENet handles fragmentation automatically.

## Step 9-10: Enter Game

Client sends `action|enter_game`. Server responds with the world select menu (gazette, featured worlds, etc.) via `OnRequestWorldSelectMenu` variant or `OnDialogRequest`.

## Step 11-14: Join World

Client sends:

```
action|join_request
name|WORLDNAME
invitedWorld|0
```

Server must:

1. Load or generate the world
2. Send `SEND_MAP_DATA` (tank packet type 4, world binary as extended data)
3. Send `OnSpawn` variant for every player already in the world to the joining player
4. Send `OnSpawn` with `type|local` for the joining player themselves
5. Send `SEND_INVENTORY_STATE` (tank packet type 9)
6. Broadcast `OnSpawn` of the new player (without `type|local`) to everyone else in the world

## Error Handling

| Situation | Response |
|-----------|----------|
| Invalid GrowID/password | Send `OnConsoleMessage` with error, then disconnect or show dialog |
| World doesn't exist | Generate a new one |
| World is full | Send `OnFailedToEnterWorld` variant |
| Player already logged in elsewhere | Kick the old session first |
| Banned player | Send ban dialog, disconnect |
| Maintenance mode | Reject in `server_data.php` with `maint|1`, never reach ENet |

## Session Lifecycle

```
CONNECTING -> LOGGED_IN -> IN_GAME -> DISCONNECTING
                              |
                              v
                        (can join/leave worlds
                         multiple times while
                         in IN_GAME state)
```
