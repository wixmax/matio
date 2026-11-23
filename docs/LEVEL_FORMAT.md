# Level Format — schema version 1

Levels are JSON files under `content/levels/<world>/`. The reference example is
`content/levels/world-01/level-01.json`. The TypeScript contract lives in
`src/types/level.ts`; validation lives in `src/systems/level-validator.ts`.

> Status: the contract and validator exist. There is **no loader and no level rendering yet**.
> `GameScene` currently shows a hardcoded presentation placeholder, not this JSON.

## 1. Coordinate system

| Rule | Value |
| --- | --- |
| Unit for placement | **Tiles** (never pixels) |
| Origin | Top-left of the level |
| X axis | Increases to the right |
| Y axis | Increases **downwards** |
| Default tile size | **64 px** (`DEFAULT_TILE_SIZE`) |
| Object anchor | The object's tile cell (top-left semantics) |
| Spawn/goal anchor | The character's feet cell |
| Runtime movement units | **Pixels per second** (px/s), px/s² for gravity |

Conversion at runtime: `pixelX = tileX * tileSize`, `pixelY = tileY * tileSize`.
Movement tuning is runtime configuration and never belongs in a level file.

## 2. File shape

Top-level fields:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `schemaVersion` | integer | yes | Must be `1`; other versions are rejected |
| `id` | string | yes | Lowercase kebab-case, globally unique, e.g. `world-01-level-01` |
| `name` | string | yes | Non-empty display name |
| `tileSize` | integer | no | Default `64`; integer in `1..256` |
| `size` | object | yes | `{ width, height }`, integers in `1..512` tiles |
| `theme` | string | no | Non-empty visual theme id, e.g. `meadow` |
| `spawn` | object | yes | `{ x, y }` integer cell inside the level |
| `goal` | object | yes | `{ x, y }` integer cell inside the level |
| `terrain` | array | yes | Rectangular terrain areas (may be empty) |
| `objects` | array | no | Placed pickups/power-ups; default `[]` |

Unknown extra fields are ignored so newer content can be loaded by older builds when the change is
additive. Breaking changes require a new `schemaVersion`.

### Terrain area

```json
{ "type": "ground", "x": 0, "y": 13, "width": 40, "height": 2 }
```

| Field | Rules |
| --- | --- |
| `type` | `ground`, `platform`, `block` or `water` |
| `x`, `y` | Integer, `>= 0`, inside level bounds |
| `width`, `height` | Integers `>= 1` |
| bounds | `x + width <= size.width` and `y + height <= size.height` |

`water` is terrain, not an object: it will receive its own collision/animation behavior later.
`platform` is intended for one-way platforms; that behavior is not implemented yet.

### Object

```json
{ "id": "star-01", "type": "star", "x": 16, "y": 5 }
```

| Field | Rules |
| --- | --- |
| `id` | Optional, non-empty, unique within the level |
| `type` | `coin`, `star`, `bomb`, `shield` or `magnet` |
| `x`, `y` | Integer, `>= 0`, inside level bounds |

Enemies are intentionally **not** in this schema yet; they will be added with their own array or a
later schema version once AI behavior definitions exist.

## 3. Complete example

```json
{
  "schemaVersion": 1,
  "id": "world-01-level-01",
  "name": "Sunny Meadow",
  "tileSize": 64,
  "size": { "width": 40, "height": 15 },
  "theme": "meadow",
  "spawn": { "x": 2, "y": 12 },
  "goal": { "x": 37, "y": 12 },
  "terrain": [
    { "type": "ground", "x": 0, "y": 13, "width": 40, "height": 2 },
    { "type": "platform", "x": 8, "y": 9, "width": 4, "height": 1 },
    { "type": "platform", "x": 15, "y": 7, "width": 3, "height": 1 },
    { "type": "block", "x": 22, "y": 11, "width": 1, "height": 1 },
    { "type": "water", "x": 27, "y": 13, "width": 4, "height": 2 }
  ],
  "objects": [
    { "type": "coin", "x": 6, "y": 11 },
    { "type": "coin", "x": 7, "y": 11 },
    { "id": "star-01", "type": "star", "x": 16, "y": 5 },
    { "type": "bomb", "x": 23, "y": 10 },
    { "id": "shield-01", "type": "shield", "x": 31, "y": 8 }
  ]
}
```

## 4. Validation

Validation is a pure function with two entry points:

```ts
validateLevel(unknown): ValidationResult<LevelDefinition>
parseLevelJson(text: string): ValidationResult<LevelDefinition>
```

`ValidationResult` is either `{ ok: true, value }` with a normalized `LevelDefinition` (defaults
applied, every required field present) or `{ ok: false, errors }`.

Error shape:

```ts
interface ValidationError {
  path: string;    // "$.terrain[2].width"
  message: string; // "terrain area exceeds the level width (x + width must be <= 40); received 35 + 10."
}
```

Rules enforced today:

1. Root must be a JSON object.
2. `schemaVersion` is required, an integer, and exactly `1`.
3. `id` is a non-empty lowercase kebab-case string.
4. `name` is a non-empty string.
5. `tileSize` defaults to 64; when present it must be an integer in `1..256`.
6. `size.width`/`height` are integers in `1..512`.
7. `spawn`/`goal` have integer `x`/`y` inside the level (`0 <= x < width`, `0 <= y < height`).
8. `terrain` must be an array; each area has a known type, integer coordinates, `width/height >= 1`,
   and fits inside the level.
9. `objects`, when present, must be an array; each object has a known type, integer in-bounds
   coordinates, and a unique non-empty `id` when provided.
10. All errors are collected in one pass (not fail-fast).

Malformed JSON becomes a single `$` error from `parseLevelJson` with the parser's reason.

### Rejected-content policy

When the loader arrives, invalid content must **not** be partially rendered and must not crash the
game. The expected behavior is a readable error state listing every `path`/`message`, plus a console
error in development. Silent fallbacks (skipping bad terrain, guessing coordinates) are forbidden.

## 5. Evolution policy

- `schemaVersion` starts at `1` and is always an integer.
- Additive fields can ship without a version bump only if old builds can ignore them safely.
- Renames, removals, unit changes and meaning changes require a new version **and** a migration
  function plus tests for both versions.
- The validator rejects versions it does not explicitly support; never "best effort" parse a newer
  schema.
- Keep a valid example for every supported version under `content/levels/`.
