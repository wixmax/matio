import type { PlayerHealth } from './player-health';
import type { PixelRect, WorldPoint } from '../types/level-runtime';

export function resolveEnemyDamage(
  health: PlayerHealth,
  amount: number,
  absorb: () => boolean,
): 'ignored' | 'absorbed' | 'damaged' | 'defeated' {
  if (!health.canTakeDamage(amount)) return 'ignored';
  if (absorb()) {
    health.startInvulnerability();
    return 'absorbed';
  }
  return health.damage(amount).died ? 'defeated' : 'damaged';
}

export function magnetStep(
  distance: number,
  collectionDistance: number,
  speed: number,
  deltaMs: number,
): number {
  return Math.min(Math.max(0, distance - collectionDistance), speed * (Math.max(0, deltaMs) / 1000));
}

export function reachableCoinDistance(
  x: number,
  y: number,
  target: WorldPoint,
  radius: number,
  halfWidth: number,
  halfHeight: number,
  solids: readonly PixelRect[],
): number | null {
  const dx = target.x - x;
  const dy = target.y - y;
  const squared = dx * dx + dy * dy;
  if (squared > radius * radius || !isMagnetPathClear(x, y, target, halfWidth, halfHeight, solids)) {
    return null;
  }
  return Math.sqrt(squared);
}

/** Tests the entire straight path against solids expanded by the coin body. */
export function isMagnetPathClear(
  x: number,
  y: number,
  target: WorldPoint,
  halfWidth: number,
  halfHeight: number,
  solids: readonly PixelRect[],
): boolean {
  const dx = target.x - x;
  const dy = target.y - y;
  const minX = Math.min(x, target.x);
  const maxX = Math.max(x, target.x);
  const minY = Math.min(y, target.y);
  const maxY = Math.max(y, target.y);

  for (const rect of solids) {
    const left = rect.x - halfWidth;
    const right = rect.x + rect.width + halfWidth;
    const top = rect.y - halfHeight;
    const bottom = rect.y + rect.height + halfHeight;

    if (maxX < left || minX > right || maxY < top || minY > bottom) continue;

    // Clip the path's parameter [0, 1] to each slab. For an axis with no
    // movement, the bounding check already confirms it lies inside that slab.
    const xEntry = dx === 0 ? 0 : ((dx > 0 ? left : right) - x) / dx;
    const xExit = dx === 0 ? 1 : ((dx > 0 ? right : left) - x) / dx;
    const yEntry = dy === 0 ? 0 : ((dy > 0 ? top : bottom) - y) / dy;
    const yExit = dy === 0 ? 1 : ((dy > 0 ? bottom : top) - y) / dy;

    if (Math.max(0, xEntry, yEntry) <= Math.min(1, xExit, yExit)) return false;
  }
  return true;
}
