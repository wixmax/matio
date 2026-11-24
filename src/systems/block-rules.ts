import type {
  InteractiveBlockId,
  InteractiveBlocksConfig,
  InteractiveBlockState,
} from '../types/interactive-block';
import { isBlockRewardType, isInteractiveBlockObject } from '../types/interactive-block';
import type { GridPoint, LevelDefinition, LevelObject } from '../types/level';
import type { PixelRect } from '../types/level-runtime';
import type { PlayerForm } from '../types/player-form';
import type { ValidationError } from '../types/validation';
import {
  findSolidTerrainAtCell,
  planRewardRelease,
  type RewardReleaseFailure,
} from './level-geometry';

export { planRewardRelease, type RewardReleaseFailure, type RewardReleaseResolution } from './level-geometry';

/**
 * Pure interactive-block decisions (Phaser-free).
 *
 * The head-bump classifier deliberately uses previous-step Arcade body geometry:
 * separation can zero velocity before the collider callback runs, so velocity
 * alone is not reliable evidence of an upward hit.
 */

/** Minimum horizontal body overlap before a contact can count as a head hit. */
export const HEAD_BUMP_MIN_HORIZONTAL_OVERLAP_PX = 2;

/** The previous top may sit at most this far above the underside (growth/teleport guard). */
export const HEAD_BUMP_PREVIOUS_TOLERANCE_PX = 4;

/** The current top may sit this far below the underside before separation is visible. */
export const HEAD_BUMP_CURRENT_TOLERANCE_PX = 4;

/** A valid hit must have moved the body upward by at least this much. */
export const HEAD_BUMP_MIN_RISE_PX = 0.5;

export interface HeadBumpEvidence {
  readonly block: PixelRect;
  /** Current player body edges, after Arcade separation when available. */
  readonly playerLeft: number;
  readonly playerRight: number;
  readonly playerTop: number;
  readonly playerBottom: number;
  /** Player body top before the current physics step (`body.prev.y`). */
  readonly previousPlayerTop: number;
  /** Contact flags set by Arcade for this step. */
  readonly blockedUp: boolean;
  readonly touchingUp: boolean;
}

/**
 * Classifies a genuine hit from below.
 *
 * Rejected cases include side collisions, landing on top, growth expansion into
 * an overhead block, respawn/teleport overlap and any contact where the player
 * was already above the block underside.
 */
export function isHeadBump(evidence: HeadBumpEvidence): boolean {
  if (!evidence.blockedUp && !evidence.touchingUp) {
    return false;
  }

  if (!hasHorizontalOverlap(evidence.playerLeft, evidence.playerRight, evidence.block)) {
    return false;
  }

  const blockBottom = evidence.block.y + evidence.block.height;

  // The player must still extend below the block: this rejects standing on top
  // and any body entirely above the block.
  if (evidence.playerBottom <= blockBottom) {
    return false;
  }

  // A head hit starts from below. If the previous body top was already above
  // the underside, the overlap was created by growth, a teleport or a side
  // squeeze, not by an upward jump.
  if (evidence.previousPlayerTop < blockBottom - HEAD_BUMP_PREVIOUS_TOLERANCE_PX) {
    return false;
  }

  // After separation the top should sit at the underside. Allow a few pixels of
  // penetration before the callback but reject bodies clearly above it.
  if (evidence.playerTop < blockBottom - HEAD_BUMP_CURRENT_TOLERANCE_PX) {
    return false;
  }

  if (evidence.playerTop > blockBottom + HEAD_BUMP_CURRENT_TOLERANCE_PX) {
    return false;
  }

  return evidence.playerTop < evidence.previousPlayerTop - HEAD_BUMP_MIN_RISE_PX;
}

function hasHorizontalOverlap(left: number, right: number, block: PixelRect): boolean {
  const overlap = Math.min(right, block.x + block.width) - Math.max(left, block.x);
  return overlap >= HEAD_BUMP_MIN_HORIZONTAL_OVERLAP_PX;
}

/** Centralized break permission; shipped configuration allows only Big form. */
export function isFormAllowedToBreak(
  blockId: InteractiveBlockId,
  form: PlayerForm,
  config: Pick<InteractiveBlocksConfig, 'break'>,
): boolean {
  return blockId === 'breakable-brick' && config.break.forms.includes(form);
}

/** Reward blocks pay out only from `unused`; every other state is idempotent. */
export function canActivateRewardBlock(state: InteractiveBlockState): boolean {
  return state === 'unused';
}

export interface BodyRect {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** Tolerance used to decide whether a latched contact has separated. */
export const BLOCK_LATCH_RELEASE_TOLERANCE_PX = 4;

/**
 * True while the player is still pressed against the block underside. Used to
 * rearm a block after a real separation, not merely after one frame.
 */
export function isPlayerPressedFromBelow(
  block: PixelRect,
  body: BodyRect,
  tolerancePx = BLOCK_LATCH_RELEASE_TOLERANCE_PX,
): boolean {
  const blockBottom = block.y + block.height;
  const overlap = Math.min(body.right, block.x + block.width) - Math.max(body.left, block.x);

  return overlap >= 1 &&
    body.top <= blockBottom + tolerancePx &&
    body.bottom > blockBottom + tolerancePx + 4;
}

/** Stable reward key derived from the authored block id, never from an index. */
export function rewardRuntimeKey(blockId: string): string {
  return `reward:${blockId}`;
}

/**
 * Semantic placement validation, called by LevelLoader before any Phaser object
 * is created and by content tests for every shipped level.
 */
export function validateInteractiveBlockPlacements(level: LevelDefinition): ValidationError[] {
  const errors: ValidationError[] = [];
  const occupied = new Map<string, number>();

  level.objects.forEach((object, index) => {
    if (!isInteractiveBlockObject(object)) {
      return;
    }

    const path = `$.objects[${index}]`;
    const cell = { x: object.x, y: object.y };

    if (findSolidTerrainAtCell(level, cell) !== null) {
      errors.push({
        path,
        message: `interactive block "${object.id}" must not overlap solid terrain at (${object.x}, ${object.y}).`,
      });
    }

    const key = `${object.x},${object.y}`;
    const previous = occupied.get(key);

    if (previous !== undefined) {
      errors.push({
        path,
        message: `duplicate interactive-block occupancy at (${object.x}, ${object.y}); it is already used by objects[${previous}].`,
      });
    } else {
      occupied.set(key, index);
    }

    const below = { x: object.x, y: object.y + 1 };

    if (
      !isCellInside(level.size, below) ||
      findSolidTerrainAtCell(level, below) !== null ||
      hasInteractiveBlockAt(level.objects, below)
    ) {
      errors.push({
        path,
        message: `interactive block "${object.id}" needs an empty cell directly below it so the player can strike its underside.`,
      });
    }

    if (object.blockId !== 'reward-block') {
      return;
    }

    if (object.reward === undefined) {
      errors.push({ path: `${path}.reward`, message: 'is required for a reward-block.' });
      return;
    }

    if (!isBlockRewardType(object.reward.type)) {
      errors.push({
        path: `${path}.reward.type`,
        message: `unsupported reward type "${String(object.reward.type)}".`,
      });
      return;
    }

    const resolution = planRewardRelease(level, cell);

    if (!resolution.ok) {
      errors.push({
        path: `${path}.reward`,
        message: releaseFailureMessage(resolution.reason, object.id),
      });
    }
  });

  return errors;
}

function releaseFailureMessage(reason: RewardReleaseFailure, id: string): string {
  switch (reason) {
    case 'blocked-emergence':
      return `reward-block "${id}" needs two empty cells above it (emergence and visual headroom).`;
    case 'no-ground-below':
      return `reward-block "${id}" must stand above solid ground so its reward has a reachable landing cell.`;
    case 'no-settle-space':
      return `reward-block "${id}" has no open cell between itself and the ground below for its reward to settle into.`;
    case 'blocked-settle-path':
      return `reward-block "${id}" has another interactive block in its settle column.`;
  }
}

function hasInteractiveBlockAt(objects: readonly LevelObject[], cell: GridPoint): boolean {
  return objects.some((object) =>
    isInteractiveBlockObject(object) && object.x === cell.x && object.y === cell.y,
  );
}

function isCellInside(
  size: { readonly width: number; readonly height: number },
  cell: GridPoint,
): boolean {
  return cell.x >= 0 && cell.y >= 0 && cell.x < size.width && cell.y < size.height;
}
