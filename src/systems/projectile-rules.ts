import type { PixelRect, WorldPoint } from '../types/level-runtime';
import type { WeaponDefinition } from '../types/weapon';

/**
 * Pure weapon/projectile decisions.
 *
 * These functions stay Phaser-free so spawning, firing cadence, terrain
 * classification and hit accounting are unit-testable without a browser.
 */

export const ENERGY_BALL_BODY_SIZE = 20;

/** Extra pixels between the player body edge and the projectile body edge. */
const SPAWN_GAP_PX = 2;

/** Fraction of the current body height measured from the top (hand height). */
const HAND_HEIGHT_RATIO = 0.42;

/**
 * Places a projectile just outside the current physics body, at a proportional
 * hand height. Using the live body rect keeps small and big forms correct and
 * prevents the projectile from spawning inside the player.
 */
export function energyBallSpawn(body: PixelRect, facing: -1 | 1): WorldPoint {
  const clearance = ENERGY_BALL_BODY_SIZE / 2 + SPAWN_GAP_PX;

  return {
    x: facing === 1 ? body.x + body.width + clearance : body.x - clearance,
    y: body.y + body.height * HAND_HEIGHT_RATIO,
  };
}

/**
 * Firing eligibility. A rejected attempt must not spend the cooldown, so the
 * caller only records the timestamp after this returns true.
 */
export function canFireEnergyBall(
  settings: Pick<WeaponDefinition, 'maxActiveProjectiles' | 'cooldownMs'>,
  abilityActive: boolean,
  activeCount: number,
  timeSinceFireMs: number,
): boolean {
  return abilityActive &&
    activeCount < settings.maxActiveProjectiles &&
    timeSinceFireMs >= settings.cooldownMs;
}

export interface ProjectileBlockedFlags {
  readonly left: boolean;
  readonly right: boolean;
  readonly up: boolean;
  readonly down: boolean;
}

export type ProjectileTerrainContact = 'bounce' | 'destroy' | 'none';

/**
 * A floor/platform top bounces; a wall, block side or ceiling destroys the
 * projectile. Corner contacts prefer destruction so side impacts stay
 * deterministic.
 */
export function classifyProjectileTerrainContact(
  flags: ProjectileBlockedFlags,
): ProjectileTerrainContact {
  if (flags.left || flags.right || flags.up) {
    return 'destroy';
  }

  if (flags.down) {
    return 'bounce';
  }

  return 'none';
}

/**
 * Per-projectile target accounting. Returns true only for a new enemy key while
 * the target budget remains, so repeated overlap callbacks can never double-hit
 * the same enemy or exceed `maxTargets`.
 */
export function registerProjectileHit(
  targets: Set<string>,
  key: string,
  maxTargets: number,
): boolean {
  if (targets.has(key) || targets.size >= maxTargets) {
    return false;
  }

  targets.add(key);
  return true;
}

/** True once the projectile center leaves the world plus a safety margin. */
export function isProjectileOutsideWorld(
  x: number,
  y: number,
  world: { readonly width: number; readonly height: number },
  marginPx = 64,
): boolean {
  return x < -marginPx || x > world.width + marginPx ||
    y < -marginPx || y > world.height + marginPx;
}
