# Game Systems

## Farming & Splicing

### How Farming Works

1. Plant a seed on an empty tile (or on Dirt, item 610)
2. Each seed has a `growTime` in seconds (defined in items.dat)
3. Fruit count on plant: **1-4 random** (rarity 999 items always produce exactly 1)
4. When `current_time - planted_time >= growTime`, tree is ready
5. Punch the tree to harvest

### Harvest Results

- Drops the block version of the seed (item_id - 1), count = fruit count
- **21% chance** to also drop a seed back
- Gem drop: `rand() % (item.max_gems + 1)` gems (if item has max_gems > 0)
- XP gained: `item.rarity / 5` (minimum 1)

### Grow Time Modifiers

| Source | Reduction |
|--------|-----------|
| Ancestral items (5082-5170) | 8%-13% depending on item |
| Hand item 6846 | 2% |
| PlayMod 118 (Food: Tree Growth) | 5% |
| Grow Pass | Additional 5% multiplier |
| Machine 9844 (with fuel) | 25% |

### Splicing

Place a seed on a tile that already has a different seed planted. The server looks up the recipe:

- Searches all items for matching `r_1`/`r_2` recipe pairs
- On match: tile becomes the result seed, marked as spliced, timer resets
- Cannot splice if tree is already fully grown
- Cannot splice if tile already has 3 seeds (double-spliced)

Hardcoded special splices: `339+627→742`, `743+253→758`, `743+285→6674`

### Harvest Bonuses

| Source | Bonus |
|--------|-------|
| Guild level 8 | +10% yield |
| Guild level 16 | +20% yield |
| Guild level 24 | +30% yield |
| Magic Magnet (back item 8908) | Auto-collect to inventory (1/250 chance of breaking into item 8940) |
| PlayMod 14 (Lucky) | 30% chance of extra 1-5 gems |
| Harvest Festival event | Chance of mooncake drops based on rarity |

---

## Lock System

### Lock Types

**Area Locks** (protect a fixed number of tiles around the lock):

| Item | ID | Tile Coverage |
|------|----|---------------|
| Small Lock | 202 | 10 tiles |
| Big Lock | 204 | 48 tiles |
| Huge Lock | 206 | 200 tiles |
| Builder's Lock | 4994 | Area lock with build-only mode |

**World Locks** (protect the entire world):

| Item | ID | Notes |
|------|----|-------|
| World Lock | 242 | Costs 3000 gems, recycles for 300 |
| Diamond Lock | 5814 | Premium world lock |
| Royal Lock | 4802 | Extra options: Silence Peasants, Royal Rainbows |

Any lock with `BlockTypes::LOCK` that isn't in the area lock list (202, 204, 206, 4994, 10000) functions as a world lock.

### Access Check Order

1. World owner → full access
2. World admins (in `world.admins` list) → access
3. Area lock owner → access to their locked tiles
4. Area lock admins (in `block.admins` list) → access
5. Public flag set → anyone can build/break

### Lock Settings (wrench menu)

```
Allow anyone to Build and Break    (public toggle)
Allow admins to edit vending
Allow admins to edit magplant
Block picking up items
Disable Cheater Role
Disable Custom Music Blocks
Set as Home World
Minimum entry level                (world level requirement)
```

---

## Economy

### Gems

| Source | Amount |
|--------|--------|
| Breaking blocks | `rand() % (item.max_gems + 1)` |
| Harvesting trees | Same formula from tree's item |
| PlayMod 14 (Lucky) | 30% chance of extra 1-5 gems on harvest |
| PlayMod 134 (Energy Drink) | Double gems |
| Guild level 4/12/20/28 | +5%/+10%/+15%/+20% gems |

### World Lock as Currency

- Store price: **3000 gems** per World Lock
- Recycle value: **300 gems**
- 10-pack: 30,000 gems
- Used as pricing unit in Vending Machines

### Growtokens (Item 1486)

- Earned when a world owner enters a world that was in `top_yesterday` (popular worlds list)
- 1 Growtoken per qualifying world per day
- Tracked per-player to prevent double-claiming
- Spent in the Growtoken shop tab

---

## Vending Machine

- Block type: `BlockTypes::VENDING`
- Only works in world-locked worlds
- Stores: item_id, stock count, price, earned WLs

### Pricing Modes

| `price` value | Meaning |
|---------------|---------|
| > 0 | Buyer pays X World Locks for 1 item |
| < 0 | Buyer pays 1 World Lock for X items (bulk) |
| 0 | Machine disabled / not for sale |

### Vending Hub (Item 9270)

Aggregates all DigiVend machines in a world into a single checkout interface.

---

## Fishing

### Requirements

Fishing rod equipped in hand slot. Valid rod IDs: 3040, 3010, 2912, 3008, 3100, 5740, 6254, 6256, 6258, 6932, 10262

### Flow

1. Use bait on water tile → starts fishing timer
2. Wait for `fish_seconds` to pass
3. Reel in → random item from rod's `randomitem[]` array
4. If item is `BlockTypes::FISH`: weight = `rand() % item.fish_max_lb + 1`

### Modifiers

| Source | Effect |
|--------|--------|
| Rod 3040 or Fishing Day event | Fish weight × 1.25 (capped at max_lb) |
| Rod 10262 | Only catches fish-type items |
| Necklace 7746 | +6 XP bonus per catch |
| PlayMod 145 (Sparkling Gems) | 125 gems on catch |
| GROWFISHER_ worlds | Special loot table (items 5836, 5838, 4426, 2410) |

### Leveling

- Fishing has its own level (`ff_lvl`) and XP (`ff_xp`)
- XP to next level: `5 * (ff_lvl² + 2)`
- 1 hour cooldown after leaving GROWFISHER_ worlds

---

## Surgery

### How It Works

1. Use surgery tool on a patient (real player or Surg-E robot)
2. Random malady assigned from pool
3. Player performs surgery mini-game (select correct tools)
4. Success/fail based on skill check

### Skill System

- `surgery_skill` ranges 0-100
- Increases by 1 on each successful cure
- Fail chance: `30 - (surgery_skill / 4)` percent

### Maladies (randomly assigned)

Broken arm, broken leg, bird flu, turtle flu, monkey flu, nose job, lung tumor, heart attack, brain tumor, liver infection, kidney failure, appendicitis, swallowed World Lock, herniated disc, broken everything, serious head injury, serious trauma, massive trauma, torn punching muscle, gem cuts, Grumbleteeth, chicken feet, broken heart, brain worms, ecto bones, Moldy Guts

### Surgery PlayMods

| PlayMod | ID | Duration | Effect |
|---------|-----|----------|--------|
| Calm Nerves | 83 | 120s | Steadier hands |
| Spicey Skills | 84 | 1800s | Half skill fail rate |
| Malpractice | 86 | 3600s | Banned from surgery (after fail) |
| Recovering | 87 | 3600s | Patient recovery period |

### Leveling

- Surgery has its own level (`s_lvl`) and XP (`s_xp`)
- XP to next level: `10 * (s_lvl² + 2)`

---

## Geiger Counter

### Flow

1. Equip Geiger Counter (clothing item)
2. Geiger detects radiation in world (audio/visual cues)
3. Find the source tile, punch it → get crystal item
4. Counter needs recharging after use

### Charging

- Punch a **Geiger Charger** block to charge
- `geiger_` counter increments per punch (0-100%)
- At 100%: resets, gives back charged item

### Item Chain

```
Uncharged → 2286 (Geiger Counter) → 2204 (Geiger Counter: Charged)
Alternate: → 2560 → 2558
```

### PlayMod

- **Irradiated** (PlayMod 10): 1800 seconds duration, applied when finding items
- During Geiger Day event: Irradiated lasts only 10 minutes

### Leveling

- Own level (`g_lvl`) and XP (`g_xp`)
- XP to next level: `5 * (g_lvl² + 2)`

---

## Guild System

### Structure

```
guild_id            unique ID
guild_name          name
guild_description   description
guild_level         1-30
guild_xp            experience
guild_members       vector of members
guild_mascot        [foreground_id, background_id]
guild_world         home world name
guild_logs          activity log
guild_settings      settings flags
```

### Roles

| ID | Role |
|----|------|
| 0 | Member |
| 1 | Elder |
| 2 | Co-Leader |
| 3 | Leader |

### Creation

- Cost: 500 gems (250 for Super Supporters)
- Requires: player owns the world (has World Lock)

### Size

- Max members = `guild_level * 5`

### Level Perks (confirmed from source)

| Level | Perk |
|-------|------|
| 2 | +5% XP |
| 4 | +5% Gems |
| 6 | +5 inventory slots |
| 8 | +10% harvest yield |
| 10 | +10% XP |
| 12 | +10% Gems |
| 14 | +10 inventory slots |
| 16 | +20% harvest yield |
| 18 | +15% XP |
| 20 | +15% Gems |
| 22 | +15 inventory slots |
| 24 | +30% harvest yield |
| 26 | +20% XP |
| 28 | +20% Gems |
| 30 | Guild Mastery (all maxed + exclusive aura) |

### Guild Potions (PlayMods 146-149)

Fishing boost, Blocks boost (1% extra), Geiger boost, Gems boost (1% bonus) — each lasts 1800 seconds.

---

## PlayMods (Buffs/Effects)

PlayMods are temporary effects applied to players. Each has an ID, duration, and gameplay effect.

### Notable PlayMods (from source)

| ID | Name | Duration | Effect |
|----|------|----------|--------|
| 2/3/49 | Frozen | 2-10s | Cannot move |
| 10 | Irradiated | 1800s | Geiger radiation visual |
| 11 | Duct Tape | 300s | Cannot chat (muted) |
| 14/29/36/80 | Lucky | 1800s | 30% chance extra gems on harvest |
| 18/72 | Floating! | 2s | Gravity set to -30 |
| 25 | Antidote! | 3600s | Immune to zombie infection |
| 27 | Golden Halo! | 1800s | Good status visual |
| 28 | Infected! | 60s | Zombie virus, spreads on punch |
| 53 | Food: Extra XP | 1800s | 25% chance of double XP |
| 76 | Banned | 60s | Account ban |
| 83 | Calm Nerves | 120s | Surgery: steadier hands |
| 84 | Spicey Skills | 1800s | Surgery: half fail rate |
| 118 | Food: Tree Growth | 1800s | Trees grow 5% faster |
| 119 | Spikeproof | 5s | Immune to spikes and lava |
| 125 | Moderator Role | 2678400s | Grants moderator powers |
| 134 | Energy Drink | 1800s | Double gems and XP |
| 139 | Curse | 60s | Cursed (sent to hell world) |
| 143 | Cheater Role | 604800s | Cheater access |
| 146-149 | Guild Potions | 1800s | Fishing/Blocks/Geiger/Gems boost |

### How They Work

- Stored per-player as `{id, expiration_timestamp, applied_by}`
- Clothing items can grant passive PlayMods via `playmod` field
- Consumable items apply PlayMods on use
- Expired mods are removed on next tick/check

---

## World Flags

Defined as a bitmask (`uint32_t`):

```cpp
enum eWorldFlags {
    WORLDFLAG_NUKED              = (1 << 0),   // 1
    WORLDFLAG_RESTRICT_NOCLIP    = (1 << 1),   // 2
    WORLDFLAG_JAMMED             = (1 << 2),   // 4
    WORLDFLAG_PUNCH_JAMMER       = (1 << 3),   // 8
    WORLDFLAG_ZOMBIE_JAMMER      = (1 << 4),   // 16
    WORLDFLAG_ANTI_GRAVITY       = (1 << 5),   // 32
    WORLDFLAG_BALLOON_JAMMED     = (1 << 6),   // 64
    WORLDFLAG_MINI_MOD           = (1 << 7),   // 128
    WORLDFLAG_GUARDIAN_PINEAPPLE = (1 << 8),   // 256
    WORLDFLAG_NOLOCKS            = (1 << 9),   // 512
    WORLDFLAG_HAUNTED            = (1 << 10),  // 1024
    WORLDFLAG_NOGO               = (1 << 11),  // 2048
    WORLDFLAG_NOEVENTS           = (1 << 12),  // 4096
};
```

These are set/cleared by placing or removing specific jammer items in the world.

### NiceTopia Implementation (alternative)

NiceTopia uses `active_jammers` vector (item IDs) instead of a bitmask:

```
Item 226   → "JAMMED" (Signal Jammer)
Item 1276  → "NOPUNCH" (Punch Jammer)
Item 1278  → "IMMUNE" (Zombie Jammer)
Item 4884  → "NOWAR"
Other      → "ANTIGRAVITY"
```

---

## Achievements

- Stored as `map<string, int>` — achievement title → progress count
- Total: **169** achievements tracked
- Accessible via `/alist` command or profile wrench
- Actual achievement definitions/criteria are loaded from external data (not hardcoded in examined source)

---

## Crime System

> Only `BlockTypes::CRIME_VILLAIN` enum exists in the source. No crime gameplay logic is implemented in the examined codebases. The block type appears decorative/placeholder only.
