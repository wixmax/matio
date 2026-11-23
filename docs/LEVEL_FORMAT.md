# Level Format — schema version 1

Levels are JSON files under `content/levels/<world>/`. They are discovered automatically at build
time; adding a valid file is enough to register a playable level.

- Contract: `src/types/level.ts`
- Schema validation: `src/systems/level-validator.ts`
- Discovery/catalog: `src/systems/LevelRepository.ts` + `src/core/level-repository.ts`
- Geometry conversion: `src/systems/level-geometry.ts`
- Phaser construction: `src/systems/LevelLoader.ts` + `src/factories/`
- Default level / dev selector: `src/core/level-config.ts`

Status: schema 1 is implemented end-to-end (discovery, validation, terrain, colliders, collectibles,
enemies, goal completion, camera, respawn, combat, scoring/rating, progression, save and error view).
`coin`, `star` and `enemy` objects are instantiated; `bomb`, `shield` and `magnet` are validated but
intentionally not implemented. Enemy support is an additive schema 1 extension: older builds ignore
the new object type, and no existing field changed meaning.

## 1. Coordinate system and anchors

| Rule | Value |
| --- | --- |
| Unit for placement | **Tiles** (never pixels) |
| Origin | Top-left of the level |
| X axis | Increases to the right |
| Y axis | Increases **downwards** |
| Default tile size | **64 px** (`DEFAULT_TILE_SIZE`) |
| Terrain anchor | **Top-left tile** of the area |
| Spawn/goal anchor | **Bottom-center of the named cell** |
| Enemy anchor | **Bottom-center of the named cell** (feet) |
| Collectible anchor | **Center of the named cell** |
| Runtime movement units | Pixels per second (px/s), px/s² for gravity |

Conversion:

```text
terrain pixel rect = (x * tileSize, y * tileSize, width * tileSize, height * tileSize)

spawn/goal/enemy pixel = (x * tileSize + tileSize / 2, (y + 1) * tileSize)

collectible pixel = ((x + 0.5) * tileSize, (y + 0.5) * tileSize)

enemy patrol pixel extents = minX * tileSize .. (maxX + 1) * tileSize
```

The spawn/goal cell names the cell that contains the entity's feet (or flag base). A spawn at
`{ "x": 5, "y": 12 }` on a ground row beginning at tile 13 produces feet at
`x = 5 * 64 + 32 = 352`, `y = (12 + 1) * 64 = 832`. The player is never offset by body or sprite
dimensions on top of this conversion.

A collectible at `{ "x": 6, "y": 11 }` with tile size 64 is centered at `(416, 736)`.

An enemy at `{ "x": 12, "y": 12 }` with tile size 64 has its feet at `(800, 832)`. Patrol bounds
`minX: 10, maxX: 16` mean the enemy body may span world X `640..1088` (body edges), not the cell
centers. Patrol columns are inclusive.

**Authoring rule:** place spawn/goal in an empty cell directly above solid terrain. A spawn cell
inside solid terrain is rejected by the loader with an `unsafe-spawn` error before any terrain is
created. The goal cell may be above a platform/ground and is rendered as a flag marker.

World dimensions are always `size.width * tileSize` by `size.height * tileSize`.

## 2. Discovery and the level catalog

`src/core/level-repository.ts` uses:

```ts
import.meta.glob('/content/levels/**/*.json', {
  eager: true,
  query: '?raw',
  import: 'default',
});
```

This runs at build time, so levels work in `npm run dev`, `npm run build`, `npm run preview` and a
future Android WebView without a server, `fetch`, or Node filesystem access. All level JSON is small;
no level artwork is loaded here. If levels later become large, the eager glob can be changed to lazy
loading without changing the JSON contract.

Shipped levels:

| ID | File | Name | Size (tiles) | Coins | Stars | Enemies | Unimplemented |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `world-01-level-01` | `world-01/level-01.json` | Green Introduction | 40×15 | 12 | 2 | 2 mushroom, 1 snail | bomb, shield |
| `world-01-level-02` | `world-01/level-02.json` | Platform Challenge | 80×18 | 26 | 3 | 3 mushroom, 2 snail, 1 spiky | — |
| `world-01-level-03` | `world-01/level-03.json` | Water Valley | 90×16 | 29 | 4 | 3 mushroom, 1 snail, 2 spiky | — |

The **default level** is `world-01-level-01` (`DEFAULT_LEVEL_ID`).

Development selector (ignored in production builds, and it takes priority over menu selection in
development):

```text
http://localhost:5173/?level=world-01-level-02
```

Unknown IDs show a blocking error screen listing available IDs and a BACK TO MENU button. Duplicate
IDs make that ID unavailable rather than silently choosing one file.

## 3. File shape

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `schemaVersion` | integer | yes | Must be `1` |
| `id` | string | yes | Lowercase kebab-case, globally unique, e.g. `world-01-level-04` |
| `name` | string | yes | Non-empty display name |
| `tileSize` | integer | no | Default `64`; integer in `1..256` |
| `size` | object | yes | `{ width, height }` integers in `1..512` tiles |
| `theme` | string | no | Backdrop theme id: `meadow`, `cliffs`, `valley` (unknown falls back to meadow) |
| `spawn` | object | yes | Bottom-center anchored cell inside the level |
| `goal` | object | yes | Bottom-center anchored cell inside the level |
| `terrain` | array | yes | Rectangular areas (may be empty) |
| `objects` | array | no | Future pickups/power-ups; default `[]` |
| `goalMarker` | — | — | Not a field; marker is derived from `goal` |

Unknown extra fields are ignored for forward compatibility. Breaking changes require a new
`schemaVersion`.

## 4. Terrain areas

```json
{ "type": "platform", "x": 8, "y": 12, "width": 4, "height": 1 }
```

| Type | Solid | Placeholder appearance | Notes |
| --- | --- | --- | --- |
| `ground` | **yes** | soil with grass cap | Main walkable surface |
| `platform` | **yes** | stone with grass cap | Jump-through is **not** implemented; solid all sides |
| `block` | **yes** | stone block with inset | Compact step/obstacle |
| `water` | **no** | translucent blue | Visual only; no swimming, damage or physics |

Rules:

| Field | Rules |
| --- | --- |
| `x`, `y` | Integer, `>= 0`, top-left tile |
| `width`, `height` | Integers `>= 1` |
| bounds | `x + width <= size.width`, `y + height <= size.height` |

Each area becomes **one** visual rectangle and, for solid types, **one** static Arcade body. The
placeholder renderer adds a few decorative strips without physics. Tile-by-tile bodies are avoided
for performance.

## 5. Object behavior

The schema accepts `coin`, `star`, `enemy`, `bomb`, `shield` and `magnet` objects with optional
unique IDs.

| Type | Implemented | Behavior |
| --- | --- | --- |
| `coin` | **yes** | Non-solid pickup, 100 points, counter/HUD update |
| `star` | **yes** | Non-solid pickup, 500 points, stronger feedback |
| `enemy` | **yes** | Patrol entity from an archetype; stomp/damage/score rules apply |
| `bomb` | no | Valid content, preserved, never instantiated, no score |
| `shield` | no | Valid content, preserved, never instantiated, no score |
| `magnet` | no | Valid content, preserved, never instantiated, no score |

Rules:

- Collectible placement is the **center** of the cell; use empty cells and prefer cells above a
  reachable platform or ground.
- A collectible must never be authored inside solid terrain. A content test enforces this for every
  shipped level.
- Collection is idempotent per run. Collected objects stay collected after a fall; Retry creates a
  fresh attempt and restores them.
- Spawn positions must not overlap solid terrain. The loader checks the spawn cell as a safety guard.
- Unimplemented objects are logged in development with their counts and ignored at runtime.

### 5.1 Enemy objects

```json
{
  "id": "mushroom-01",
  "type": "enemy",
  "enemyId": "mushroom",
  "x": 12,
  "y": 12,
  "patrol": { "minX": 10, "maxX": 16 }
}
```

| Field | Rules |
| --- | --- |
| `id` | Optional; unique across every object in the level |
| `type` | `"enemy"` |
| `enemyId` | Required lowercase kebab-case ID declared in `content/config/enemies.json` |
| `x`, `y` | Integer tile cell inside the level; anchor is bottom-center (feet) |
| `patrol.minX`, `patrol.maxX` | Integer tile columns, `minX <= maxX`, inside `0..size.width-1`, containing `x` |

Placement rules (enforced by the loader before any enemy is created):

1. The enemy cell must not overlap solid terrain.
2. The cell directly below must be solid (`ground`/`platform`/`block`), so the enemy starts grounded.
3. `enemyId` must exist in the enemy registry; unknown archetypes show a blocking load error.
4. Patrol bounds become body-edge pixel extents (`minX*tile .. (maxX+1)*tile`). Keep them on solid
   ground; the behavior also reverses at authored bounds, walls and missing ledges.
5. Keep enemy cells out of the player spawn cell and leave a safe approach.

Archetype balance (health, speed, stompable, damage, score) is **not** authored per level. Edit
`content/config/enemies.json`; the level only references the archetype ID.

## 6. Complete working example (level 01)

```json
{
  "schemaVersion": 1,
  "id": "world-01-level-01",
  "name": "Green Introduction",
  "tileSize": 64,
  "size": { "width": 40, "height": 15 },
  "theme": "meadow",
  "spawn": { "x": 5, "y": 12 },
  "goal": { "x": 34, "y": 12 },
  "terrain": [
    { "type": "ground", "x": 0, "y": 13, "width": 40, "height": 2 },
    { "type": "platform", "x": 8, "y": 12, "width": 4, "height": 1 },
    { "type": "platform", "x": 17, "y": 12, "width": 3, "height": 1 },
    { "type": "block", "x": 24, "y": 12, "width": 1, "height": 1 },
    { "type": "platform", "x": 27, "y": 12, "width": 5, "height": 1 }
  ],
  "objects": [
    { "type": "coin", "x": 6, "y": 11 },
    { "type": "coin", "x": 7, "y": 11 },
    { "id": "star-01", "type": "star", "x": 9, "y": 10 },
    { "type": "bomb", "x": 23, "y": 10 },
    {
      "id": "mushroom-01",
      "type": "enemy",
      "enemyId": "mushroom",
      "x": 12,
      "y": 12,
      "patrol": { "minX": 12, "maxX": 16 }
    }
  ]
}
```

The shipped level 01 contains 12 coins, 2 collectible stars, 3 enemies and legacy `bomb`/`shield`
entries. Legacy objects are preserved but not created; coins, stars and enemies use the same JSON
array and share duplicate-ID validation.

## 7. Validation and loading errors

Validation reuses the existing pure functions:

```ts
validateLevel(unknown): ValidationResult<LevelDefinition>
parseLevelJson(text: string): ValidationResult<LevelDefinition>
```

The repository reports:

| Failure | User-facing behavior |
| --- | --- |
| `unknown-level` | Error panel with requested ID and available IDs |
| `invalid-level` | Error panel with file path and every `path`/`message` |
| `duplicate-id` | ID unavailable; panel explains both files |
| `unsafe-spawn` | Error panel before any terrain is created |
| `load-failed` | Defensive engine failure panel; never partial gameplay |

All errors include the level ID. GameScene does not create the player, input manager or colliders
when loading fails. A BACK TO MENU button is always available.

Rules still enforced by the validator:

1. Root object, supported `schemaVersion = 1`.
2. Non-empty kebab-case unique ID and name.
3. `tileSize` default 64, integer `1..256`.
4. Positive size dimensions up to 512 tiles.
5. Integer spawn/goal inside bounds.
6. Terrain type + integer positive dimensions fitting the level.
7. Object type/coords bounds + unique non-empty IDs.
8. Enemy objects: non-empty kebab-case `enemyId`, ordered in-bounds patrol columns containing the
   enemy cell. The loader additionally cross-checks the archetype registry and terrain support.
9. Malformed JSON becomes a single `$` parse error.

## 8. Camera and respawn contract

- World/camera bounds come from `size × tileSize`; axes smaller than the viewport are padded and
  centered, larger axes follow the player.
- Camera zoom stays `1`; follow smoothing is `0.1` on X/Y (`CAMERA_FOLLOW_LERP_*`).
- Touch controls and level HUD use `scrollFactor(0)`, so they never move with the camera.
- Respawn occurs when player feet exceed `worldHeight + 2 * tileSize`. The player resets to the
  JSON spawn with zero velocity/acceleration and cleared jump timers; the camera re-centers on spawn.
- The bottom world edge is open (no invisible floor); gaps and water are intentionally deadly.

## 9. How to create `level-04.json` without modifying TypeScript

1. Create `content/levels/world-01/level-04.json`.
2. Start from a valid level and set a new unique `id` and `name`.
3. Set `size` and choose `tileSize` (normally omit it; default 64).
4. Place `spawn` and `goal` in empty cells **directly above** solid terrain. Remember the anchor is
   the bottom-center of the named cell.
5. Add terrain rectangles inside the size bounds. Keep vertical steps within the jump arc
   (roughly 100–110 px / 1.5 tiles with current tuning) and gaps within a running jump
   (roughly 3 tiles / 192 px).
6. Add `coin`/`star` objects in empty cells after the path. Place at least one star on an optional
   platform. `bomb`/`shield`/`magnet` remain valid but have no runtime effect.
7. Optionally add `enemy` objects: empty cell, solid ground directly below, archetype from
   `content/config/enemies.json`, ordered patrol columns containing the enemy cell. Keep the spawn
   cell clear and add the new ID to `content/config/level-order.json` if it belongs to the campaign.
8. Save, reload the dev server, and open:

   ```text
   http://localhost:5173/?level=world-01-level-04
   ```

9. Run `npm run test`, `npm run typecheck` and `npm run build`. No scene, factory or loader code
   changes are required.

Minimal example:

```json
{
  "schemaVersion": 1,
  "id": "world-01-level-04",
  "name": "Training Steps",
  "tileSize": 64,
  "size": { "width": 24, "height": 12 },
  "theme": "meadow",
  "spawn": { "x": 2, "y": 10 },
  "goal": { "x": 21, "y": 10 },
  "terrain": [
    { "type": "ground", "x": 0, "y": 11, "width": 24, "height": 1 },
    { "type": "platform", "x": 5, "y": 10, "width": 4, "height": 1 },
    { "type": "block", "x": 12, "y": 10, "width": 1, "height": 1 },
    { "type": "platform", "x": 16, "y": 10, "width": 3, "height": 1 }
  ],
  "objects": [
    { "type": "coin", "x": 3, "y": 10 },
    { "type": "coin", "x": 6, "y": 9 },
    { "id": "star-01", "type": "star", "x": 7, "y": 8 }
  ]
}
```

This level is 1536×768 px, wider and taller than the viewport. Spawn feet = `(160, 704)`; the ground
top is also 704, so the player starts standing correctly.

### 9.1 Campaign order (`content/config/level-order.json`)

```json
{
  "schemaVersion": 1,
  "levels": [
    "world-01-level-01",
    "world-01-level-02",
    "world-01-level-03"
  ]
}
```

- Order is explicit and never inferred from file discovery.
- IDs must be unique and reference existing levels; startup blocks with an error otherwise.
- The first ID starts unlocked. Completing a level unlocks the next one.
- The final level has no next level; the result screen then offers only Retry/Main Menu.
- The development `?level=` selector can open locked levels; it is ignored in production.

### 9.2 Scoring, rating and save configuration

- `content/config/scoring.json` holds coin/star/completion points and the 2-star coin ratio.
- `content/config/enemies.json` holds archetype balance; `content/config/combat.json` holds player
  health, invulnerability, knockback, stomp bounce and contact tolerance.
- `content/config/level-order.json` holds the campaign order.
- `matio.save.v1` in localStorage holds a versioned save. Menu displays unlocked levels and best
  ratings; GameScene/ResultScene read the same validated store.
- A level with zero coins or zero collectible stars cannot receive the corresponding higher rating
  threshold; empty levels award only 1 star on completion.

### 9.3 How to add a fourth enemy archetype (JSON + existing behavior)

1. Choose a lowercase kebab-case ID, for example `armored-beetle`.
2. Add it to `content/config/enemies.json`:

   ```json
   "armored-beetle": {
     "health": 3,
     "speed": 25,
     "behavior": "patrol",
     "stompable": true,
     "damage": 2,
     "score": 500
   }
   ```

3. Reference it from a level object:

   ```json
   {
     "id": "beetle-01",
     "type": "enemy",
     "enemyId": "armored-beetle",
     "x": 18,
     "y": 11,
     "patrol": { "minX": 17, "maxX": 20 }
   }
   ```

4. Reload with `?level=<id>`. The placeholder texture is generated automatically under
   `matio-enemy-armored-beetle`; no TypeScript change is needed.
5. Run `npm run test`, `npm run typecheck` and `npm run build`.

This works because `patrol` is an implemented behavior. JSON cannot create **new logic**: a new
behavior value (for example `"chase"` or `"flyer"`) requires an implementation in
`src/systems/enemy-behaviors.ts`, integration in `Enemy.tick()`, validation in
`validateEnemiesConfig()`, and tests. Do not add a behavior name to JSON expecting it to work.

## 10. Evolution policy

- `schemaVersion` starts at `1` and is always an integer.
- Additive fields may ship without a version bump only if old builds can ignore them safely.
- Renames, removals, unit changes and meaning changes require a new version plus migration and tests.
- The validator rejects versions it does not explicitly support; never best-effort parse a newer
  schema.
- Keep at least one valid example for every supported version under `content/levels/`.
