import type { BombConfig } from '../types/bomb';
import type { PixelRect, WorldPoint } from '../types/level-runtime';
import { SMALL_FORM } from './player-form-rules';

export const BOMB_BODY_SIZE = 24;

export function bombSpawn(body: PixelRect, facing: -1 | 1): WorldPoint {
  const clearance = BOMB_BODY_SIZE / 2 + 1;
  return {
    x: facing === 1 ? body.x + body.width + clearance : body.x - clearance,
    y: body.y + body.height * (1 - 55 / SMALL_FORM.height),
  };
}

export interface ExplosionRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function explosionIntersectsRect(x: number, y: number, radius: number, rect: ExplosionRect): boolean {
  const nearestX = Math.max(rect.x, Math.min(x, rect.x + rect.width));
  const nearestY = Math.max(rect.y, Math.min(y, rect.y + rect.height));
  return (x - nearestX) ** 2 + (y - nearestY) ** 2 <= radius ** 2;
}

export function canThrowBomb(
  settings: Pick<BombConfig['bomb'], 'maxActiveBombs' | 'throwCooldownMs'>,
  available: boolean,
  activeCount: number,
  timeSinceThrowMs: number,
): boolean {
  return available && activeCount < settings.maxActiveBombs
    && timeSinceThrowMs >= settings.throwCooldownMs;
}
