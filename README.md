# Growtopia Private Server (GTPS) - Dokumentasi Lengkap

Dokumentasi komprehensif tentang Growtopia Private Server secara global - mencakup semua sistem game, mekanik, protokol, dan fitur yang ada di Growtopia.

---

## Daftar Isi

1. [Apa Itu GTPS](#apa-itu-gtps)
2. [Arsitektur Server](#arsitektur-server)
3. [Protokol Jaringan](#protokol-jaringan)
4. [Alur Koneksi (Login Flow)](#alur-koneksi-login-flow)
5. [Struktur Paket](#struktur-paket)
6. [Tank Packet (GameUpdatePacket)](#tank-packet-gameupdatepacket)
7. [Variant System (RPC)](#variant-system-rpc)
8. [Sistem Dunia (World)](#sistem-dunia-world)
9. [Sistem Item](#sistem-item)
10. [Farming dan Splicing](#farming-dan-splicing)
11. [Sistem Lock](#sistem-lock)
12. [Sistem Pemain (Player)](#sistem-pemain-player)
13. [Ekonomi (Gems, World Lock, Growtoken)](#ekonomi)
14. [Trading dan Vending](#trading-dan-vending)
15. [Weather Machine](#weather-machine)
16. [Sistem Dialog](#sistem-dialog)
17. [PlayMods (Buff/Effect)](#playmods)
18. [Fishing](#fishing)
19. [Surgery dan Sewing](#surgery-dan-sewing)
20. [Crime / WANTED System](#crime-system)
21. [Growganoth dan Events](#growganoth-dan-events)
22. [Carnival](#carnival)
23. [Mini-Game System](#mini-game-system)
24. [Dungeon System](#dungeon-system)
25. [Guild System](#guild-system)
26. [Friends System](#friends-system)
27. [Achievement System](#achievement-system)
28. [XP dan Level System](#xp-dan-level-system)
29. [Death dan Respawn](#death-dan-respawn)
30. [Door dan Portal](#door-dan-portal)
31. [Special Blocks](#special-blocks)
32. [Chat Commands](#chat-commands)
33. [Moderator Tools](#moderator-tools)
34. [Geiger Counter / Treasure](#geiger-counter)
35. [Ancestral Items (Ances)](#ancestral-items)
36. [Punch Effects dan Weapons](#punch-effects)
37. [Character Customization](#character-customization)
38. [Sub-Server Architecture](#sub-server-architecture)
39. [Referensi Lengkap Packet Types](#referensi-packet-types)
40. [Referensi Lengkap Variant Functions](#referensi-variant-functions)
41. [Referensi Lengkap Action Types](#referensi-action-types)
42. [Tips Pengembangan GTPS](#tips-pengembangan)

---

## Apa Itu GTPS

**Growtopia Private Server (GTPS)** adalah server game custom yang mengemulasi protokol jaringan game Growtopia (dibuat oleh Ubisoft, sebelumnya oleh Robinson Technologies & Hamumu Software). GTPS memungkinkan client Growtopia resmi terhubung ke server buatan sendiri dengan fitur yang bisa dikustomisasi.

### Sejarah Singkat
- Growtopia dirilis tahun 2013 oleh Seth Robinson dan Mike Hommel
- Menggunakan ENet (reliable UDP) sebagai transport layer
- Komunitas GTPS mulai berkembang setelah reverse engineering protokol game
- GTPS populer untuk: testing fitur custom, komunitas privat, pembelajaran networking

### Konsep Dasar
- Server meniru perilaku server official Growtopia
- Client tidak perlu dimodifikasi (menggunakan client resmi)
- DNS/hosts file di-redirect agar client terhubung ke GTPS
- Server harus menyediakan: items.dat, world data, player management, packet handling

---

## Arsitektur Server

### Komponen Sistem

`
+------------------+     HTTPS      +------------------+
| Growtopia Client | ------------> | HTTP Login Server |
+------------------+               | (server_data.php)|
        |                          +------------------+
        | ENet UDP (port 17091)
        v
+------------------+               +------------------+
|   Game Server    | <-- TCP ----> |  Master Server   |
| (handles worlds, |               | (koordinasi,     |
|  players, items) |               |  session mgmt)   |
+------------------+               +------------------+
        |
        v
+------------------+
|    Database      |
| (SQLite/MySQL/   |
|  JSON files)     |
+------------------+
`

### Model Single Server (Sederhana)
- Satu proses menangani semua: HTTP login, ENet game, database
- Cocok untuk < 100 pemain
- Semua world di-load ke memory

### Model Multi-Server (Scalable)
- **HTTP Server**: Handle login request, serve CDN files
- **Master Server**: Koordinasi antar game server, session management, telnet admin
- **Game Server (multiple)**: Masing-masing handle subset world dan player
- Player di-transfer antar server via OnSendToServer
- Cocok untuk 100+ pemain

### Teknologi Inti

| Komponen | Teknologi |
|----------|-----------|
| Transport | ENet (reliable UDP) |
| Compression | ENet Range Coder |
| Checksum | CRC32 |
| Channels | 2 per connection |
| Login | HTTPS POST |
| Data Format | Binary (items.dat, world data) + Text (pipe-delimited) |

---

## Protokol Jaringan

### ENet Setup

`
Port Default     : 17091 (UDP)
Max Peers        : 255 - 1024
Channels         : 2
Compression      : Range Coder (wajib)
Checksum         : CRC32 (wajib)
Packet Delivery  : ENET_PACKET_FLAG_RELIABLE
Max Packet Size  : 16384 bytes (client limit)
Custom Flag      : usingNewPacketForServer (Growtopia-specific)
`

### Message Types

Setiap paket dimulai dengan 4 bytes (uint32_t) yang menentukan tipe:

`
0 = NET_MESSAGE_UNKNOWN
1 = NET_MESSAGE_SERVER_HELLO        Server kirim saat client connect
2 = NET_MESSAGE_GENERIC_TEXT        Text generik (login data, chat input)
3 = NET_MESSAGE_GAME_MESSAGE        Game message (action|value format)
4 = NET_MESSAGE_GAME_PACKET         Binary tank packet (56 bytes + data)
5 = NET_MESSAGE_ERROR               Error message
6 = NET_MESSAGE_TRACK               Analytics/tracking
7 = NET_MESSAGE_CLIENT_LOG_REQUEST   Log request
8 = NET_MESSAGE_CLIENT_LOG_RESPONSE  Log response
`

### Text Format (Pipe-Delimited)

Growtopia menggunakan format text sederhana untuk banyak komunikasi:
`
key|value\n
key2|value1|value2\n
`

Contoh:
`
action|join_request\nname|WORLDNAME\ninvitedWorld|0
tankIDName|MyGrowID\ntankIDPass|password\nprotocol|225
`

---

## Alur Koneksi (Login Flow)

### Diagram Lengkap

`
Client                              Server
  |                                   |
  |--[1. HTTPS POST server_data.php]->|
  |<-[2. server|ip\nport|17091]-------|
  |                                   |
  |--[3. ENet Connect]--------------->|
  |<-[4. NET_MESSAGE_SERVER_HELLO]----|
  |--[5. Login Data (GENERIC_TEXT)]-->|
  |<-[6. OnSuperMainStart (variant)]--|
  |--[7. action|enter_game]---------->|
  |<-[8. World Select / Gazette]------|
  |--[9. action|join_request]-------->|
  |<-[10. SEND_MAP_DATA]-------------|
  |<-[11. OnSpawn (semua player)]-----|
  |<-[12. SEND_INVENTORY_STATE]-------|
  |                                   |
  |=====[Gameplay Loop]===============|
`

### Tahap 1: HTTP Login

Client POST ke https://www.growtopia1.com/growtopia/server_data.php

Response:
`
server|127.0.0.1
port|17091
type|1
type2|1
meta|encrypted_metadata
RTENDMARKERBS1001
`

### Tahap 2-3: ENet Connection

Client connect ke IP:port dari response HTTP.

### Tahap 4: Server Hello

Server kirim NET_MESSAGE_SERVER_HELLO (GameUpdatePacket kosong atau minimal).

### Tahap 5: Login Data

Client kirim NET_MESSAGE_GENERIC_TEXT berisi:

`
requestedName|GuestName          (untuk guest login)
tankIDName|GrowID                (untuk GrowID login)
tankIDPass|Password              (password)
f|1
protocol|225                     (versi protokol)
game_version|5.39                (versi game)
fhash|-716928004
lmode|0                          (login mode: 0=normal, 2=transfer)
cbits|1024
player_age|0
GDPR|1
category|_-5100
platformID|0,1,1                 (platform: Windows/iOS/Android)
deviceVersion|0
country|id                       (kode negara)
hash|-1232141                    (hardware hash 1)
hash2|value                      (hardware hash 2)
meta|win/abcdef12/1234           (device metadata)
mac|02:00:00:00:00:00            (MAC address)
rid|random_device_id_32hex       (Random ID - device unique)
wk|windows_key_32hex            (Windows Key)
zf|fingerprint                   (additional fingerprint)
fz|fingerprint                   (additional fingerprint)
aid|advertising_id_uuid          (Advertising ID)
gid|google_id_16hex              (Google ID)
`

### Tahap 6: OnSuperMainStart

Server kirim variant call berisi:
- items.dat hash (untuk client caching)
- CDN URL untuk resource files
- Settings string (server configuration)

### Tahap 7-8: Enter Game

Client kirim ction|enter_game, server respond dengan world select menu.

### Tahap 9-12: Join World

Client request world, server kirim:
1. World binary data (SEND_MAP_DATA)
2. Spawn data semua player di world (OnSpawn variant)
3. Inventory state player

---

## Struktur Paket

### Text Packet (Type 2 & 3)

`
[4 bytes: uint32_t type] [null-terminated string]
`

### Game Packet (Type 4)

`
[4 bytes: uint32_t type=4] [56 bytes: GameUpdatePacket header] [N bytes: extended data]
`

---

## Tank Packet (GameUpdatePacket)

### Layout (56 bytes, packed)

`
Offset  Size    Field               Deskripsi
------  ----    -----               ---------
0       1       type                Packet sub-type (0-46)
1       1       pad1                punch_id / build_range
2       1       pad2                jump_count / punch_range
3       1       pad3                anim_type
4       4       net_id              Player network ID (per-world)
8       4       secondary_net_id    Target ID / item count
12      4       flags               Bitfield (state flags)
16      4       field1              water_speed (float)
20      4       int_data            item_id / planting_tree
24      4       pos_x               Position X (float, pixels)
28      4       pos_y               Position Y (float, pixels)
32      4       speed_x             Velocity X (float)
36      4       speed_y             Velocity Y (float)
40      4       field2              particle_rotation (float)
44      4       tile_pos_x          Target tile X (int)
48      4       tile_pos_y          Target tile Y (int)
52      4       data_size           Extended data size
`

**Total: 56 bytes header** + data_size bytes extended data (jika flag EXTENDED aktif)

### Packet Types (0-46)

| ID | Nama | Arah | Deskripsi |
|----|------|------|-----------|
| 0 | STATE | Bidirectional | Player movement/state |
| 1 | CALL_FUNCTION | S->C | Variant RPC call |
| 2 | UPDATE_STATUS | S->C | Status update |
| 3 | TILE_CHANGE_REQUEST | C->S | Place/break/wrench tile |
| 4 | SEND_MAP_DATA | S->C | World data saat join |
| 5 | SEND_TILE_UPDATE_DATA | S->C | Single tile update (broadcast) |
| 6 | SEND_TILE_UPDATE_DATA_MULTIPLE | S->C | Multiple tile updates |
| 7 | TILE_ACTIVATE_REQUEST | C->S | Interact tile (wrench, enter door) |
| 8 | TILE_APPLY_DAMAGE | C->S | Punch/damage tile |
| 9 | SEND_INVENTORY_STATE | S->C | Full inventory data |
| 10 | ITEM_ACTIVATE_REQUEST | C->S | Use/consume item |
| 11 | ITEM_ACTIVATE_OBJECT_REQUEST | C->S | Use item on dropped object |
| 12 | SEND_TILE_TREE_STATE | S->C | Tree growth state |
| 13 | MODIFY_ITEM_INVENTORY | S->C | Add/remove single item |
| 14 | ITEM_CHANGE_OBJECT | S->C | Modify dropped item |
| 15 | SEND_LOCK | S->C | Lock data |
| 16 | SEND_ITEM_DATABASE_DATA | S->C | items.dat file |
| 17 | SEND_PARTICLE_EFFECT | S->C | Particle effect |
| 18 | SET_ICON_STATE | Bidirectional | Icon state |
| 19 | ITEM_EFFECT | S->C | Item visual effect |
| 20 | SET_CHARACTER_STATE | S->C | Character state flags |
| 21 | PING_REPLY | C->S | Client ping reply |
| 22 | PING_REQUEST | S->C | Server ping request |
| 23 | GOT_PUNCHED | S->C | Player got punched |
| 24 | APP_CHECK_RESPONSE | C->S | Anti-cheat response |
| 25 | APP_INTEGRITY_FAIL | S->C | Integrity failed |
| 26 | DISCONNECT | S->C | Force disconnect |
| 27 | BATTLE_JOIN | Bidirectional | Battle join |
| 28 | BATTLE_EVENT | Bidirectional | Battle event |
| 29 | USE_DOOR | C->S | Enter door/portal |
| 30 | SEND_PARENTAL | S->C | Parental controls |
| 31 | GONE_FISHIN | Bidirectional | Fishing action |
| 32 | STEAM | Bidirectional | Steam integration |
| 33 | PET_BATTLE | Bidirectional | Pet battle |
| 34 | NPC | Bidirectional | NPC interaction |
| 35 | SPECIAL | Bidirectional | Special packet |
| 36 | SEND_PARTICLE_EFFECT_V2 | S->C | Particle v2 |
| 37 | ACTIVE_ARROW_TO_ITEM | S->C | Arrow indicator |
| 38 | SELECT_TILE_INDEX | C->S | Select tile |
| 39 | SEND_PLAYER_TRIBUTE_DATA | S->C | Player tribute |
| 40 | FTUE_SET_ITEM_TO_QUICK_INVENTORY | S->C | Tutorial quick slot |
| 41 | PVE_NPC | Bidirectional | PvE NPC |
| 42 | PVP_CARD_BATTLE | Bidirectional | PvP cards |
| 43 | PVE_APPLY_PLAYER_DAMAGE | Bidirectional | PvE damage |
| 44 | PVE_NPC_POSITION_DAMAGE | Bidirectional | PvE NPC pos |
| 45 | SET_EXTRA_MODS | S->C | Extra mods |
| 46 | ON_STEP_ON_TILE_MOD | C->S | Step on tile |

### Packet Flags (Bitfield)

`
Bit 1  (0x02)   UNKNOWN
Bit 2  (0x04)   RESET_VISUAL_STATE
Bit 3  (0x08)   EXTENDED              Ada data tambahan setelah header
Bit 4  (0x10)   ROTATE_LEFT           Player menghadap kiri
Bit 5  (0x20)   ON_SOLID              Di atas ground/block
Bit 6  (0x40)   ON_FIRE_DAMAGE        Terkena fire damage
Bit 7  (0x80)   ON_JUMP               Sedang melompat
Bit 8  (0x100)  ON_KILLED             Player mati
Bit 9  (0x200)  ON_PUNCHED            Sedang punch
Bit 10 (0x400)  ON_PLACED             Sedang place block
Bit 11 (0x800)  ON_TILE_ACTION        Tile interaction
Bit 12 (0x1000) ON_GOT_PUNCHED        Kena punch player lain
Bit 13 (0x2000) ON_RESPAWNED          Baru respawn
Bit 14 (0x4000) ON_COLLECT_OBJECT     Mengambil dropped item
Bit 15 (0x8000) ON_TRAMPOLINE         Di trampoline
Bit 16 (0x10000) ON_DAMAGE            Terkena damage
Bit 17 (0x20000) ON_SLIDE             Sliding
Bit 21 (0x200000) ON_WALL_HANG        Wall hanging
Bit 26 (0x4000000) ON_ACID_DAMAGE     Acid damage
`

---

## Variant System (RPC)

### Format

`
[1 byte: variant_count]
Per variant:
  [1 byte: index]       0 = nama fungsi, 1+ = argumen
  [1 byte: type]        Tipe data
  [N bytes: data]       Payload sesuai tipe
`

### Tipe Data Variant

`
0 = UNKNOWN
1 = FLOAT       (4 bytes)
2 = STRING      (4 bytes length + chars)
3 = VEC2        (8 bytes: 2x float)
4 = VEC3        (12 bytes: 3x float)
5 = UNSIGNED    (4 bytes uint32)
9 = SIGNED      (4 bytes int32)
`

### Daftar Variant Functions (Server -> Client)

| Fungsi | Deskripsi |
|--------|-----------|
| OnSuperMainStart | Welcome setelah login (hash, CDN, settings) |
| OnSendToServer | Redirect ke sub-server |
| OnSpawn | Spawn player di world |
| OnRemove | Remove player dari world |
| OnConsoleMessage | Pesan di console/chat |
| OnDialogRequest | Tampilkan dialog UI |
| OnTalkBubble | Chat bubble di atas player |
| OnTextOverlay | Text overlay di layar |
| OnNameChanged | Update display name |
| OnSetClothing | Update pakaian player |
| OnSetPos | Set posisi player |
| OnCountryState | Set flag negara |
| OnSetFreezeState | Freeze/unfreeze |
| OnPlayPositioned | Play audio file |
| OnEmoticonDataChanged | Emoticon/emote |
| OnSetBux | Update gems display |
| OnSetCurrentWeather | Set weather |
| SetHasGrowID | Account flag |
| OnKilled | Player mati |
| OnStoreRequest | Tampilkan store |
| OnRequestWorldSelectMenu | World select menu |
| OnFailedToEnterWorld | Gagal masuk world |
| OnFtueButtonDataSet | Tutorial data |
| OnProgressUI | Progress bar UI |
| OnSetRoleSkinsAndTitles | Role skins |
| OnTradeStatus | Trade window status |

---

## Sistem Dunia (World)

### Spesifikasi

| Parameter | Nilai |
|-----------|-------|
| Ukuran Default | 100 x 60 tiles |
| Ukuran Tile | 32 x 32 pixels |
| Total Pixels | 3200 x 1920 |
| Nama | Uppercase alphanumeric, max ~24 karakter |
| Max Objects | Tidak terbatas (tapi ada limit praktis) |
| Version Format | 0x14 (20) |

### World Generation Types

| Tipe | Deskripsi |
|------|-----------|
| NORMAL | Dirt, rock, cave background standar |
| BEACH | Pasir, batu karang, coral, pohon kelapa |
| THERMONUCLEAR | Landscape hancur/devastated |
| MONOCHROME | Tema hitam putih |
| CAVE | Underground dengan batu |
| MARS | Tanah Mars, batu Mars |
| DESERT | Pasir, boulder, kaktus |
| JUNGLE | Vegetasi tropis |
| TREASURE | Berisi item treasure |
| FARM | Tema pertanian |
| UNDERWATER | Deep sand, deep rock, rumput laut |
| CAVERN | Sistem gua dalam |
| CLASSIC | Generasi gaya original |
| SKY | World berbasis awan |
| GROWALONE | World single-player |

### Layer Generation (Normal World)

`
Layer 0-23:   Udara (kosong)
Layer 24:     Bedrock + Main Door (spawn point)
Layer 25-35:  Dirt + random Cave Background
Layer 36-53:  Rock + random Cave Background  
Layer 54-59:  Bedrock (bottom, indestructible)
`

### World Flags / Status

| Flag | Efek |
|------|------|
| JAMMED | World tersembunyi dari pencarian (Signal Jammer) |
| NUKED | World di-reset/hancur |
| PUNCH_JAMMER | Tidak bisa punch player lain |
| ZOMBIE_JAMMER | Infeksi zombie tidak menyebar |
| ANTI_GRAVITY | Gravitasi terbalik |
| BALLOON_JAMMED | Balon tidak berfungsi |
| MINI_MOD | Aturan ketat (tidak bisa drop item) |
| GUARDIAN_PINEAPPLE | Pineapple guardian aktif |
| NOLOCKS | Tidak bisa pasang lock |
| HAUNTED | Efek hantu |
| NOGO | Tidak bisa masuk |
| NOEVENTS | Event khusus dinonaktifkan |
| RESTRICT_NOCLIP | Noclip diblokir |

### World Categories

Adventure, Art, Farm, Game, Guild, Information, Music, Parkour, Puzzle, Roleplay, Shop, Social, Storage, Story, Trade

### World Objects (Dropped Items)

Item yang di-drop menjadi floating object di world:
- Memiliki: item_id, posisi (x,y), jumlah, flags, unique object_id
- Bisa di-pickup oleh player yang berjalan melewatinya
- Auto-pickup items langsung masuk inventory tanpa perlu manual
- Gems drops dari breaking blocks

### Weather System

World memiliki base weather dan current weather. Weather machine mengubah tampilan visual world.

---

## Sistem Item

### Item Properties

Setiap item memiliki properti:
- **ID**: Nomor unik (0 - 17000+)
- **Name**: Nama item (encrypted di items.dat)
- **Type**: Kategori item (158+ tipe)
- **Rarity**: Kelangkaan (1-999)
- **Grow Time**: Waktu tumbuh seed (detik)
- **Break Hits**: Jumlah punch untuk hancur (value/6)
- **Collision**: Tipe collision (solid, platform, none, dll)
- **Clothing Type**: Slot pakaian (hair, shirt, pants, dll)
- **Max Stack**: Jumlah max per slot (default 200)
- **Spread Type**: Cara item menyebar saat di-place
- **Material**: Bahan item (mempengaruhi suara punch)

### Item Types Lengkap (158+ tipe)

| ID | Tipe | Deskripsi | Contoh |
|----|------|-----------|--------|
| 0 | FIST | Tool punch default | Fist |
| 1 | WRENCH | Tool interaksi | Wrench |
| 2 | DOOR | Pintu dengan label/tujuan | Wooden Door, Steel Door |
| 3 | LOCK | Proteksi area/world | Small Lock, World Lock |
| 4 | GEMS | Currency drop | Gem |
| 5 | TREASURE | Chest/treasure | Treasure Chest |
| 6 | DEADLY_BLOCK | Membunuh saat kontak | Spike, Lava |
| 7 | TRAMPOLINE | Memantulkan player | Trampoline, Bouncy Block |
| 8 | CONSUMABLE | Bisa dimakan/digunakan | Potion, Food |
| 9 | GATEWAY | Portal masuk world | World Portal |
| 10 | SIGN | Menampilkan text | Sign, Pointy Sign |
| 11 | SFX_FOREGROUND | Block dengan sound effect | Music Block |
| 12 | TOGGLEABLE_FG | Block on/off | Switch, Lever |
| 13 | MAIN_DOOR | Spawn point world | White Door |
| 14 | PLATFORM | One-way block | Platform, Shelf |
| 15 | BEDROCK | Indestructible | Bedrock |
| 16 | LAVA | Deadly liquid | Lava |
| 17 | FOREGROUND | Block solid standar | Dirt, Rock, Wood |
| 18 | BACKGROUND | Non-solid backdrop | Cave BG, Wallpaper |
| 19 | SEED | Bisa ditanam | Any Seed |
| 20 | CLOTHES | Pakaian wearable | Shirt, Hat, Wings |
| 21 | NORMAL_CLOTHES | Pakaian biasa | T-Shirt |
| 22 | BACK_CLOTHES | Item punggung | Cape, Wings |
| 23 | ANCES_CLOTHES | Ancestral item | Ances |
| 24 | CHEST_CLOTHES | Item dada | Chest Plate |
| 25 | BOUNCY | Pinball bumper | Pinball Bumper |
| 26 | POINTY | Spike deadly | Spike |
| 27 | PORTAL | Teleport ke portal lain | Portal |
| 28 | CHECKPOINT | Respawn point | Checkpoint |
| 29 | MUSIC_NOTE | Background music | Music Note |
| 30 | WEATHER_MACHINE | Ubah weather world | Weather Machine |
| 31 | ICE | Permukaan licin | Ice Block |
| 32 | PROVIDER | Produksi item berkala | Provider |
| 33 | MAILBOX | Terima mail | Mailbox |
| 34 | BULLETIN | Message board | Bulletin Board |
| 35 | PINATA | Container reward | Pinata |
| 36 | DICE | Random number | Dice Block |
| 37 | CHEMICAL | Combinable chemical | Chemical |
| 38 | VENDING_MACHINE | Toko otomatis | Vending Machine |
| 39 | LAB | Science station | Lab |
| 40 | ACHIEVEMENT | Display achievement | Achievement Block |
| 41 | FISH_TANK | Simpan ikan | Fish Tank |
| 42 | HEART_MONITOR | Track player | Heart Monitor |
| 43 | DONATION_BOX | Terima donasi | Donation Box |
| 44 | MANNEQUIN | Display pakaian | Mannequin |
| 45 | SECURITY_CAMERA | Monitor aktivitas | Security Camera |
| 46 | MAGIC_EGG | Tumbuh dengan egg | Magic Egg |
| 47 | GAME_RESOURCES | Team assignment | Game Block |
| 48 | GAME_GENERATOR | Start mini-game | Game Generator |
| 49 | XENONITE | Crystal force/block | Xenonite |
| 50 | DISPLAY_BLOCK | Display single item | Display Block |
| 51 | STORAGE | Simpan items | Storage Box |
| 52 | FORGE | Smelting/crafting | Forge |
| 53 | GIVING_TREE | Community gift | Giving Tree |
| 54 | STEAM_ORGAN | Instrumen musik | Steam Organ |
| 55 | TAMAGOTCHI | Virtual pet | Sewing Machine |
| 56 | SWING | Sewing machine | Sewing Machine |
| 57 | BURGLAR | Crime sensor | Burglar Alarm |
| 58 | SPOTLIGHT | Highlight player | Spotlight |
| 59 | LOBSTER_TRAP | Tangkap lobster | Lobster Trap |
| 60 | ART_CANVAS | Canvas lukis | Art Canvas |
| 61 | BATTLE_CAGE | Pet battle arena | Battle Cage |
| 62 | PET_TRAINER | Train pets | Pet Trainer |
| 63 | STEAM_ENGINE | Automation | Steam Engine |
| 64 | LOCKBOT | Automated lock | Lock-Bot |
| 65 | WEATHER_SPECIAL | Advanced weather | Heatwave, Background |
| 66 | SPIRIT_STORAGE | Simpan spirits | Spirit Storage |
| 67 | DISPLAY_SHELF | Display multiple | Display Shelf |
| 68 | VIP_ENTRANCE | Restricted door | VIP Door |
| 69 | CHALLENGE_TIMER | Speedrun timer | Challenge Timer |
| 70 | CHALLENGE_FLAG | Speedrun endpoint | Challenge Flag |
| 71 | FISH_MOUNT | Display ikan | Fish Mount |
| 72 | PORTRAIT | Player portrait | Portrait |
| 73 | WEATHER_SPECIAL2 | Stuff machine | Stuff Weather |
| 74 | FOSSIL_PREP | Fossil preparation | Fossil Prep |
| 75 | DNA_MACHINE | DNA extraction | DNA Machine |
| 76 | CHEMTANK | Chemical storage | Chem Tank |
| 77 | OVEN | Cooking station | Oven |
| 78 | SUPER_MUSIC | Audio rack | Super Music |
| 79 | GEIGER_CHARGER | Geiger charger | Geiger Charger |
| 80 | ADVENTURE_RESET | Reset adventure | Adventure Reset |
| 81 | ANCES | Ancestral slot | Ances item |
| 82 | ITEM_SUCKER | Magplant (remote suck) | Magplant |
| 83 | ROBOT | Automated robot | Robot |
| 84 | STATS_BLOCK | Display statistics | Stats Block |
| 85 | OUIJA_BOARD | Spirit communication | Ouija Board |
| 86 | AUTO_ACTION_BREAK | Auto breaker | Auto Break |
| 87 | AUTO_ACTION_HARVEST | Auto harvester | Auto Harvest |
| 88 | PHASED_BLOCK | Appear/disappear timer | Phased Block |
| 89 | PASSWORD_STORAGE | Password storage | Safe |
| 90 | WEATHER_INFINITY | Infinity weather | Infinity Weather |
| 91 | FRIENDS_ENTRANCE | Friends-only door | Friends Door |

### Collision Types

| ID | Tipe | Deskripsi |
|----|------|-----------|
| 0 | NONE | Tidak ada collision (background, passable) |
| 1 | FULL | Full block collision (solid) |
| 2 | JUMP_THROUGH | Platform (bisa lompat dari bawah) |
| 3 | GATEWAY | Portal/door (passable, triggers action) |
| 4 | IF_OFF | Collision hanya jika block OFF |
| 5 | ONE_WAY | Satu arah saja |
| 6 | VIP_DOOR | VIP door collision |
| 7 | JUMP_DOWN | Bisa turun dengan jump+down |
| 8 | ADVENTURE | Adventure item collision |
| 9 | IF_ON | Collision hanya jika block ON |
| 10 | FACTION | Faction block |
| 11 | GUILD | Guild block |
| 12 | CLOUD | Cloud (semi-solid) |

### Item Flags

| Flag | Efek |
|------|------|
| FLIPPED | Render mirrored |
| EDITABLE | Bisa di-wrench |
| SEEDLESS | Tidak bisa jadi seed |
| PERMANENT | Tidak bisa dihancurkan |
| DROPLESS | Tidak bisa di-drop |
| NO_SELF | Tidak bisa digunakan pada diri sendiri |
| WORLD_LOCK | Berfungsi sebagai world lock |
| BETA | Item beta |
| AUTOPICKUP | Auto-collected saat dilewati |
| MOD | Moderator-only |
| PUBLIC | Public item |
| FOREGROUND | Foreground layer |
| HOLIDAY | Holiday-exclusive |
| UNTRADABLE | Tidak bisa di-trade/drop |

---

## Farming dan Splicing

### Cara Farming

1. **Tanam Seed**: Place seed di tile kosong (atau dirt)
2. **Tunggu Grow Time**: Setiap seed punya waktu tumbuh berbeda
3. **Tree Tumbuh**: Seed berubah jadi tree secara bertahap
4. **Harvest**: Punch tree yang sudah matang untuk mendapat item
5. **Fruit Count**: Setiap tree menghasilkan 1-4 buah (random saat tanam)

### Grow Time

- Setiap item punya grow_time dalam detik
- Contoh: Dirt Seed = 31 detik, Rock Seed = 120 detik
- **Grow Spray Fertilizer**: Mempercepat pertumbuhan
- **Ultra Grow Spray**: Mempercepat lebih cepat lagi

### Splicing

Splicing adalah cara membuat item baru dengan menggabungkan dua seed berbeda:

1. Tanam Seed A di tile kosong
2. Tanam Seed B di tile yang SAMA (sudah ada Seed A)
3. Kedua seed bergabung menjadi **Spliced Tree**
4. Spliced tree menghasilkan item BARU berdasarkan kombinasi

Contoh:
`
Dirt Seed + Rock Seed = Cave Background Seed
Dirt Seed + Lava Seed = Obsidian Seed
`

### Seed Numbering

- Setiap item memiliki seed counterpart
- Seed ID = Item ID + 1 (selalu ganjil)
- Contoh: Dirt (2) -> Dirt Seed (3), Rock (4) -> Rock Seed (5)

### Provider System

- Provider blocks menghasilkan item secara berkala
- Memiliki timer dan grow time
- Contoh: Pinball Machine, Slot Machine, Crystal Block

---

## Sistem Lock

### Tipe Lock

| Lock | Cakupan | Fitur Khusus |
|------|---------|--------------|
| Small Lock | ~10 tiles radius | Area protection dasar |
| Big Lock | ~24 tiles radius | Area protection medium |
| Huge Lock | ~48 tiles radius | Area protection besar |
| World Lock | Seluruh world | Full world ownership |
| Diamond Lock | Seluruh world | Premium world lock |
| Royal Lock | Seluruh world | Silence guests, rainbow trail |
| Builder's Lock | Area | Build-only mode, restrict admins |
| Guild Lock | Seluruh world | Guild-based access |
| Lock-Bot | Area | Automated/programmable lock |

### Fitur Lock

- **Owner**: Player yang memasang lock
- **Access List**: Daftar player yang diberi izin
- **Public Toggle**: Siapa saja bisa build
- **Ignore Empty Air**: Area lock hanya cover non-air tiles
- **Disable Music Notes**: Matikan musik di area
- **Build Only**: Hanya bisa build, tidak bisa break (Builder's Lock)
- **Silence Guests**: Guest tidak bisa chat (Royal Lock)
- **Rainbow Trail**: Efek rainbow saat jalan (Royal Lock)

### Hierarki Akses

`
World Lock Owner > Area Lock Owner > Access List > Public > Guest
`

### Lock Mechanics

- Lock melindungi tile dari player yang tidak punya akses
- Area lock melindungi radius tertentu dari posisi lock
- World lock melindungi SEMUA tile di world
- Lock bisa di-wrench untuk manage access list
- Recalculate lock: re-apply coverage setelah perubahan

---

## Sistem Pemain (Player)

### Data Player

| Field | Deskripsi |
|-------|-----------|
| user_id | ID unik permanent (database) |
| net_id | ID per-world (berubah tiap join world) |
| raw_name | Nama asli |
| display_name | Nama dengan format warna |
| country | Kode negara |
| pos_x, pos_y | Posisi dalam pixel |
| current_world | Nama world saat ini |
| grow_id | Username (GrowID) |
| role | Level permission |
| gems | Jumlah gems |
| level | Level player |
| xp | Experience points |
| skin_color | Warna skin (ARGB) |

### Clothing Slots (10 slot)

| Slot | Nama | Contoh |
|------|------|--------|
| 0 | Hair | Spiky Hair, Long Hair |
| 1 | Shirt | T-Shirt, Armor |
| 2 | Pants | Jeans, Shorts |
| 3 | Shoes/Feet | Sneakers, Boots |
| 4 | Face | Sunglasses, Mask |
| 5 | Hand | Sword, Pickaxe |
| 6 | Back | Cape, Wings, Jetpack |
| 7 | Hat/Mask | Crown, Helmet |
| 8 | Necklace/Chest | Necklace, Chest Plate |
| 9 | Ances | Ancestral Wings, Aura |

### Inventory

- Default kapasitas: **16 slots**
- Max kapasitas: **596 slots** (upgrade via store)
- Setiap slot: item_id + count (max 200 per slot) + flags
- Starter items: Fist + Wrench (selalu ada, tidak bisa dihapus)

### Character State Properties

| Property | Default | Deskripsi |
|----------|---------|-----------|
| Speed | 260.0 | Kecepatan gerak |
| Gravity | 1000.0 | Kecepatan jatuh |
| Acceleration | 1000.0 | Akselerasi gerak |
| Punch Range | 128 | Jarak punch (pixel) |
| Build Range | 128 | Jarak place block (pixel) |
| Punch Strength | 350.0 | Knockback force |
| Water Speed | 150.0 | Kecepatan di air |

### Visual State Flags

- Noclip, Double Jump, Invisible
- No Hand/Eye/Body rendering
- Devil Horns, Golden Halo
- Frozen, Cursed, Duct Tape, Cigar
- Zombie, Hot Pepper, Haunted Shadows
- Geiger Radiation, Spotlight
- Flying Pineapple, Pineapple Aura
- Bubbled, Wet, Neon Gum, Rainbow Skin

---

## Ekonomi

### Gems

- **Mata uang utama** game
- Didapat dari: breaking blocks (random drop), collecting gem objects, consuming Black Gems (1000 gems)
- Digunakan untuk: beli item di store, upgrade backpack
- **Gem Bank**: Simpan gems aman (terpisah dari pocket gems)

### World Lock (WL) Economy

- **World Lock** adalah mata uang trading de facto antar player
- 1 World Lock = ~200 gems (harga store)
- Digunakan sebagai currency di Vending Machine
- Diamond Lock (DL) = 100 World Locks (nilai komunitas)
- Blue Gem Lock (BGL) = 100 Diamond Locks

### Growtoken

- **Premium currency** (Item ID 1486)
- Didapat dari: daily challenges, special events, achievements
- Digunakan untuk: beli exclusive items di Token Store
- Tidak bisa di-trade

### Backpack Upgrade

- Start: 16 slots
- Setiap upgrade: +10 slots
- Max: 596 slots
- Harga naik setiap pembelian

---

## Trading dan Vending

### Vending Machine

- Owner pasang item dengan harga (dalam World Locks)
- Dua mode pricing:
  - **X WL per item**: Bayar X WL dapat 1 item
  - **X item per WL**: Bayar 1 WL dapat X item
- Max stock: 5199 items
- Owner bisa: tambah stock, kosongkan, withdraw profit WL
- Item UNTRADABLE tidak bisa di-vend

### Drop Trading

- Player drop item di depan mereka
- Arah drop: kiri/kanan berdasarkan facing direction
- Tidak bisa drop di: solid block, main door, mini-mod world
- Item menjadi WorldObject (floating pickup)
- Player lain bisa pickup

### Trade System (Formal)

- Dua player bisa trade secara formal via trade window
- Kedua pihak harus confirm sebelum trade execute
- Mencegah scam dibanding drop trading

---

## Weather Machine

### Daftar Weather (60+)

| Weather | Efek Visual |
|---------|-------------|
| SUNNY | Langit cerah default |
| SUNSET | Langit oranye/pink |
| NIGHT | Langit gelap + bintang |
| RAINY | Hujan |
| SNOWY | Salju turun |
| ARID | Panas gurun |
| MARS | Langit merah Mars |
| SPOOKY | Atmosfer Halloween |
| NOTHINGNESS | Void/hitam total |
| UNDERSEA | Biru underwater |
| PARTY | Warna-warni perayaan |
| SPRING | Bunga/hijau |
| DIGITAL_RAIN | Matrix-style |
| MONOCHROME | Hitam putih |
| JUNGLE | Tropis lebat |
| VALENTINE | Hati/pink |
| HARVEST_MOON | Bulan panen |
| METEOR_SHOWER | Meteor jatuh |
| BLOOD_DRAGON | Merah gelap |
| NEBULA | Nebula luar angkasa |
| BALLOON | Festival balon |
| AUTUMN | Warna musim gugur |
| EPOCH_ICE | Era es prasejarah |
| EPOCH_VOLCANO | Era vulkanik |
| GROWGANOTH | Langit gelap evil |

### Weather Machine Special

| Tipe | Fitur Khusus |
|------|--------------|
| Heatwave | Custom RGB color tinting |
| Background | Gunakan background item sebagai world backdrop |
| Stuff Machine | Custom gravity, spin, invert, item display |
| Infinity | Infinite weather combinations |
| Guild Weather | Gravity + spin untuk guild worlds |

---

## Sistem Dialog

### Format Markup

`
set_default_color|o
add_label_with_icon|big|Welcome!|left|5016|
add_spacer|small|
add_textbox|Enter your details:|left|
add_text_input|input_name|Name:|default|30|
add_button|btn_ok|OK|noflags|0|0|
add_quick_exit|
end_dialog|dialog_name|Submit||
`

### Elemen Dialog

| Elemen | Deskripsi |
|--------|-----------|
| dd_label_with_icon | Label + icon item |
| dd_textbox | Text box |
| dd_text_input | Input field |
| dd_button | Tombol |
| dd_smalltext | Text kecil |
| dd_spacer | Spasi (small/big) |
| dd_item_picker | Pilih item dari inventory |
| dd_checkbox | Checkbox |
| dd_player_info | Panel info player |
| embed_data | Hidden data |
| dd_quick_exit | Tombol X close |
| end_dialog | Akhir dialog + submit button |
| set_default_color | Set warna default |

### Color Codes (Backtick)

`
