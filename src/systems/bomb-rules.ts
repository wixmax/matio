import type { BombConfig } from '../types/bomb';

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
