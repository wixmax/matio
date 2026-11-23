# Asset Guide

This document defines how art and audio enter the project. It applies to human and AI-generated
assets equally. Task 001 ships **no final art**; the menu and playground are drawn with Phaser
shapes and text on purpose.

## 1. Visual style

- **Colorful cartoon 2D**, friendly and readable at phone size.
- Thick, consistent dark outlines (see outline rules below); no thin hairline outlines.
- Soft cel shading with 2–3 tone steps per material. Light comes from the **top-left** in every
  asset and every scene.
- Saturated but controlled palette. Avoid muddy colors, heavy noise, photo textures and gradients
  that fight the flat cartoon look.
- Clear silhouettes: a character must be identifiable as a solid black shape.
- No baked drop shadows, no baked backgrounds, no text inside sprites.
- Props may include a small ground contact shadow **only** if it is drawn in the same sprite and
  the object never moves; otherwise the shadow is a separate effect.

### Outline and shading rules

| Asset | Canvas | Outline width | Notes |
| --- | --- | --- | --- |
| Character (standard) | 128×128 | 4 px at final size | Feet centered horizontally, bottom aligned |
| Character (large/boss) | 256×256 | 6–8 px | Same style, more internal detail |
| Tile | 64×64 | 3 px | Outline continues across tile seams |
| Item / pickup | 64×64 | 3 px | Readable at 32 px display size |
| Enemy (standard) | 128×128 | 4 px | Distinct silhouette from the player |
| UI panel | 9-slice source | 3 px | Must tile/stretch without distorting corners |

Outline color: `#1B2A41` (matches `PALETTE.ink`). Shadow color: `#1B2A41` at 15–25% alpha.
Highlights are a lighter tint of the base color, never pure white except on eyes/glints.

## 2. Grid and dimensions

- The world grid is **64×64 px**. Terrain, blocks and decorative props align to it.
- Characters are roughly **1.5–2 tiles tall** (96–128 px) so doorways and platforms read
  correctly. Use a 128×128 frame and draw the character within it.
- Standard frames:
  - characters/enemies: `128×128` (large: `256×256`)
  - tiles/props/items: `64×64`
  - effects: `64×64` or `128×128`, consistent within one sheet
  - UI icons: `64×64` source, displayed at 32/48 px
  - backgrounds: `1280×720` per layer (optional 2560×1440 masters for parallax)
- All frames in one animation set must share the same dimensions and pivot.
- Pivot: **feet center**. Draw the character standing on the bottom-center of the frame with a
  4 px safety margin; do not trim the frame per animation frame.
- Transparent PNG (RGBA, straight alpha). No matte/background, no anti-aliased halo.
- Keep at least 2 px transparent padding inside atlas frames to prevent texture bleed.

Atlas rules:

- Phaser-compatible JSON: TexturePacker `JSON Hash` or `JSON Array`.
- Maximum atlas size 2048×2048 for broad mobile compatibility.
- Frame names are kebab-case and match the source file name.
- One atlas per category (e.g. `characters-hero.json/png`), not one giant atlas for the game.
- Use power-of-two textures when convenient, but do not distort sprites to force it.

## 3. File formats

| Type | Format | Notes |
| --- | --- | --- |
| Sprites / tiles / UI | PNG-24 + alpha | Straight alpha, sRGB |
| Sprite sheets | PNG atlas + JSON | TexturePacker hash/array |
| Backgrounds | PNG or WebP | WebP only if the target browsers are confirmed |
| Music | OGG (Opus/Vorbis) + MP3 fallback | Loop points prepared |
| SFX | OGG + MP3 fallback | Mono, short (< 2 s typical) |
| Fonts | Bitmap font (`.fnt` + PNG) or licensed webfont | Decision pending; do not bundle unlicensed fonts |

Audio targets: 44.1 kHz. Mono SFX, stereo music. Normalize music around −16 LUFS and SFX peaks
around −12 dBFS. Avoid long silent intros on loops.

## 4. Naming conventions

All file names are lowercase **kebab-case** with a category prefix. No spaces, no camelCase, no
version suffixes like `final-final`.

```text
char-hero-idle-01.png
char-hero-run-01.png
char-hero-jump-01.png
enemy-slime-idle-01.png
tile-grass-top-01.png
tile-grass-fill-01.png
tile-stone-block-01.png
item-coin-01.png
item-star-01.png
item-bomb-01.png
prop-meadow-tree-01.png
bg-meadow-sky.png
bg-meadow-far.png
bg-meadow-near.png
ui-button-primary.png
ui-panel-wood.png
ui-icon-pause.png
fx-coin-spark-01.png
sfx-coin-pickup.ogg
sfx-jump.ogg
music-meadow-loop.ogg
```

Animations use a stable base name plus a two-digit frame index: `char-hero-run-01`,
`char-hero-run-02`, … Frame numbering is contiguous and starts at `01`.

## 5. Directory mapping

```text
public/assets/characters/    Player skins and animation atlases
public/assets/enemies/       Enemy sprites and atlases
public/assets/tilesets/      Terrain tiles and tileset atlases
public/assets/backgrounds/   Sky, far/mid/near parallax layers
public/assets/ui/            Buttons, panels, icons, HUD elements
public/assets/items/         Coins, stars, power-ups
public/assets/effects/       Particles, impacts, sparkles
public/assets/audio/         Music and SFX (subfolder by type if it grows)
```

Never reference assets by absolute URL. Use paths relative to `public/`:

```ts
this.load.atlas('characters-hero', 'assets/characters/characters-hero.png', 'assets/characters/characters-hero.json');
```

## 6. AI-generated asset requirements

AI generation is allowed, but consistency is a review criterion, not a nice-to-have.

### 6.1 Style lock

Keep one canonical **style prompt** in the project and reuse it verbatim for every asset. It must
specify:

- "2D side-view cartoon platformer asset, thick dark outline (#1B2A41), 2–3 tone cel shading,
  light from top-left, saturated friendly palette, no texture noise, no background, no text".
- Exact palette hex values used by the project (`src/ui/theme.ts` is the reference).
- Camera rule: **pure side view** for characters/enemies/tiles; no 3/4 perspective, no top-down.
- Scale rule: character occupies ~80% of a 128×128 frame height, feet at bottom center.

### 6.2 Reference-driven consistency

1. Generate or approve one **reference sheet** (front/side/idle/run/jump) before batch work.
2. Feed the reference image plus the style prompt for every new frame and skin.
3. Keep the same seed where the tool allows it; otherwise keep the same reference and prompt.
4. Reject outputs with different outline weight, light direction, proportions or palette.
5. Generate at 2× target size and downscale with a high-quality resampler; then clean edges.

### 6.3 Post-processing checklist

- [ ] Transparent background, no white fringe or halo.
- [ ] Frame dimensions exactly match the spec; pivot at bottom center.
- [ ] Outline color and width measured against the reference.
- [ ] Palette snapped to the project palette (quantize to the approved swatches).
- [ ] No text, signature, watermark or UI chrome baked into the sprite.
- [ ] Feet/contact point aligned consistently; no jitter between frames.
- [ ] Reviewed at 100% and at phone display size (roughly 0.5×).

### 6.4 Provenance

Record for every generated asset: tool/model name, prompt used, reference image, generation date,
and any manual cleanup. Keep this with the asset batch (for example a short `.md` beside the
atlas) until a formal `docs/ASSET_SOURCES.md` exists. Do not introduce copyrighted characters,
logos or recognizable third-party IP.

## 7. Audio consistency

- One coherent instrument set per world; do not mix orchestral, chiptune and rock in one level.
- SFX should be recognizable with the music at normal volume; avoid harsh high frequencies.
- Loop music seamlessly; verify loop points by ear and with a waveform tool.
- Name files by action/object, not by number: `sfx-coin-pickup`, not `sfx-01`.
- Respect mobile autoplay rules: audio starts only after the first user gesture.

## 8. Placeholder policy

Until a task explicitly introduces final art:

- Use Phaser shapes and text, as in `MenuScene` and `GameScene`.
- Do not commit generated art "just to test" without following this guide; it normalizes
  low-quality assets into the repository.
- Placeholder colors come from `src/ui/theme.ts`, not ad-hoc hex values in scenes.
