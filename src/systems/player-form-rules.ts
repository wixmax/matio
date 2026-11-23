import type { LevelGeometry, PixelRect, WorldPoint } from '../types/level-runtime';
import type { PlayerFormsConfig } from '../types/player-form';

export const PLAYER_FRAME_WIDTH = 64;
export const PLAYER_FRAME_HEIGHT = 96;

export const SMALL_FORM = { width: 38, height: 84, visualScale: 1 } as const;

export function bigForm(config: PlayerFormsConfig['growth']) {
  return {
    width: Math.round(SMALL_FORM.width * config.bodyWidthMultiplier),
    height: Math.round(SMALL_FORM.height * config.bodyHeightMultiplier),
    visualScale: config.visualScale,
  };
}

export type PlayerFormMetrics = ReturnType<typeof bigForm>;

/** Arcade sizes and offsets are in unscaled source pixels. */
export function bodySourceMetrics(form: PlayerFormMetrics) {
  const width = form.width / form.visualScale;
  const height = form.height / form.visualScale;
  return {
    width,
    height,
    offsetX: (PLAYER_FRAME_WIDTH - width) / 2,
    offsetY: PLAYER_FRAME_HEIGHT - height,
  };
}

export function bodyAtFeet(feet: WorldPoint, form: PlayerFormMetrics): PixelRect {
  return {
    x: feet.x - form.width / 2,
    y: feet.y - form.height,
    width: form.width,
    height: form.height,
  };
}

export function bodiesOverlap(a: PixelRect, b: PixelRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;
}

export function hasGrowthRoom(
  body: PixelRect,
  world: Pick<LevelGeometry, 'worldWidth' | 'worldHeight'>,
  solids: readonly PixelRect[],
): boolean {
  return body.x >= 0 && body.y >= 0 &&
    body.x + body.width <= world.worldWidth && body.y + body.height <= world.worldHeight &&
    !solids.some((solid) => bodiesOverlap(body, solid));
}
