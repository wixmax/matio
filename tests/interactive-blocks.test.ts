import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import config from '../content/config/interactive-blocks.json';
import {
  canActivateRewardBlock,
  isFormAllowedToBreak,
  isHeadBump,
  isPlayerPressedFromBelow,
  planRewardRelease,
  rewardRuntimeKey,
  validateInteractiveBlockPlacements,
} from '../src/systems/block-rules';
import { validateInteractiveBlocksConfig } from '../src/systems/block-config-validator';
import { reachableCoinDistance } from '../src/systems/effect-rules';
import { createLevelGeometry } from '../src/systems/level-geometry';
import { validateLevel } from '../src/systems/level-validator';
import type { LevelDefinition, LevelFile } from '../src/types/level';

const LEVELS_ROOT = fileURLToPath(new URL('../content/levels', import.meta.url));
const TILE = 64;

const validConfig = validateInteractiveBlocksConfig(config);
if (!validConfig.ok) throw new Error(JSON.stringify(validConfig.errors));

function baseLevel(overrides: Partial<LevelFile> = {}): LevelFile {
  return {
    schemaVersion: 1,
    id: 'block-test',
    name: 'Block Test',
    tileSize: TILE,
    size: { width: 20, height: 14 },
    spawn: { x: 1, y: 12 },
    goal: { x: 18, y: 12 },
    terrain: [{ type: 'ground', x: 0, y: 13, width: 20, height: 1 }],
    objects: [],
    ...overrides,
  };
}

function definition(overrides: Partial<LevelFile> = {}): LevelDefinition {
  const result = validateLevel(baseLevel(overrides));

  if (!result.ok) {
    throw new Error(JSON.stringify(result.errors));
  }

  return result.value;
}

function errorsOf(level: LevelDefinition) {
  return validateInteractiveBlockPlacements(level);
}

function collectLevelPaths(directory: string): string[] {
  const paths: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      paths.push(...collectLevelPaths(path));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      paths.push(path);
    }
  }

  return paths;
}

function parseLevel(path: string): LevelDefinition {
  const text = readFileSync(path, 'utf8');
  const result = validateLevel(JSON.parse(text));

  if (!result.ok) {
    throw new Error(`${path}: ${JSON.stringify(result.errors)}`);
  }

  return result.value;
}

function rewardTypes(level: LevelDefinition): string[] {
  return level.objects.flatMap((object) =>
    object.type === 'interactive-block' && object.blockId === 'reward-block'
      ? [object.reward?.type ?? '']
      : [],
  );
}

describe('interactive block level validation - structural', () => {
  it('accepts a breakable brick and a reward block', () => {
    const level = baseLevel({
      objects: [
        { id: 'brick-01', type: 'interactive-block', blockId: 'breakable-brick', x: 5, y: 10 },
        {
          id: 'reward-01',
          type: 'interactive-block',
          blockId: 'reward-block',
          x: 8,
          y: 10,
          reward: { type: 'coin' },
        },
      ],
    });

    const result = validateLevel(level);
    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.objects).toHaveLength(2);
      expect(result.value.objects[0]).toEqual({
        id: 'brick-01',
        type: 'interactive-block',
        blockId: 'breakable-brick',
        x: 5,
        y: 10,
      });
    }
  });

  it('requires an id for every interactive block', () => {
    const result = validateLevel({
      ...baseLevel(),
      objects: [{ type: 'interactive-block', blockId: 'breakable-brick', x: 5, y: 10 }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map(({ path }) => path)).toContain('$.objects[0].id');
  });

  it('rejects an unknown block archetype', () => {
    const result = validateLevel({
      ...baseLevel(),
      objects: [{ id: 'brick-01', type: 'interactive-block', blockId: 'golden-block', x: 5, y: 10 }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toContainEqual(expect.objectContaining({ path: '$.objects[0].blockId' }));
    }
  });

  it('rejects a reward declared on a breakable brick', () => {
    const result = validateLevel({
      ...baseLevel(),
      objects: [{
        id: 'brick-01',
        type: 'interactive-block',
        blockId: 'breakable-brick',
        x: 5,
        y: 10,
        reward: { type: 'coin' },
      }],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map(({ path }) => path)).toContain('$.objects[0].reward');
  });

  it('requires a supported reward on a reward block', () => {
    const missing = validateLevel({
      ...baseLevel(),
      objects: [{ id: 'reward-01', type: 'interactive-block', blockId: 'reward-block', x: 5, y: 10 }],
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.errors.map(({ path }) => path)).toContain('$.objects[0].reward');

    const unsupported = validateLevel({
      ...baseLevel(),
      objects: [{
        id: 'reward-01',
        type: 'interactive-block',
        blockId: 'reward-block',
        x: 5,
        y: 10,
        reward: { type: 'star' },
      }],
    });
    expect(unsupported.ok).toBe(false);
    if (!unsupported.ok) {
      expect(unsupported.errors.map(({ path }) => path)).toContain('$.objects[0].reward.type');
    }
  });

  it('rejects blocks outside the level bounds and non-integer cells', () => {
    const result = validateLevel({
      ...baseLevel(),
      objects: [
        { id: 'brick-01', type: 'interactive-block', blockId: 'breakable-brick', x: 20, y: 10 },
        { id: 'brick-02', type: 'interactive-block', blockId: 'breakable-brick', x: 5.5, y: 10 },
      ],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const paths = result.errors.map(({ path }) => path);
      expect(paths).toContain('$.objects[0].x');
      expect(paths).toContain('$.objects[1].x');
    }
  });

  it('keeps duplicate-ID validation shared with collectibles', () => {
    const result = validateLevel(baseLevel({
      objects: [
        { id: 'shared', type: 'coin', x: 2, y: 10 },
        { id: 'shared', type: 'interactive-block', blockId: 'breakable-brick', x: 5, y: 10 },
      ],
    }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map(({ path }) => path)).toContain('$.objects[1].id');
  });
});

describe('interactive block placement validation - semantics', () => {
  it('rejects a block inside solid terrain', () => {
    const level = definition({
      terrain: [
        { type: 'ground', x: 0, y: 13, width: 20, height: 1 },
        { type: 'block', x: 5, y: 10, width: 1, height: 1 },
      ],
      objects: [{ id: 'brick-01', type: 'interactive-block', blockId: 'breakable-brick', x: 5, y: 10 }],
    });

    expect(errorsOf(level).map(({ path }) => path)).toContain('$.objects[0]');
  });

  it('rejects two blocks in the same cell', () => {
    const level = definition({
      objects: [
        { id: 'brick-01', type: 'interactive-block', blockId: 'breakable-brick', x: 5, y: 10 },
        { id: 'reward-01', type: 'interactive-block', blockId: 'reward-block', x: 5, y: 10, reward: { type: 'coin' } },
      ],
    });

    expect(errorsOf(level).map(({ path }) => path)).toContain('$.objects[1]');
  });

  it('requires an empty cell directly below every block', () => {
    const level = definition({
      terrain: [
        { type: 'ground', x: 0, y: 13, width: 20, height: 1 },
        { type: 'platform', x: 5, y: 11, width: 1, height: 1 },
      ],
      objects: [{ id: 'brick-01', type: 'interactive-block', blockId: 'breakable-brick', x: 5, y: 10 }],
    });

    expect(errorsOf(level).map(({ path }) => path)).toContain('$.objects[0]');
  });

  it('rejects a reward block with a ceiling in its emergence/headroom cells', () => {
    const level = definition({
      terrain: [
        { type: 'ground', x: 0, y: 13, width: 20, height: 1 },
        { type: 'platform', x: 5, y: 8, width: 1, height: 1 },
      ],
      objects: [{
        id: 'reward-01',
        type: 'interactive-block',
        blockId: 'reward-block',
        x: 5,
        y: 10,
        reward: { type: 'coin' },
      }],
    });

    expect(errorsOf(level).map(({ path }) => path)).toContain('$.objects[0].reward');
  });

  it('rejects a reward block without solid ground below', () => {
    const level = definition({
      terrain: [],
      objects: [{
        id: 'reward-01',
        type: 'interactive-block',
        blockId: 'reward-block',
        x: 5,
        y: 10,
        reward: { type: 'coin' },
      }],
    });

    expect(errorsOf(level).map(({ path }) => path)).toContain('$.objects[0].reward');
  });

  it('rejects a reward block with no settle space above the ground', () => {
    const level = definition({
      objects: [{
        id: 'reward-01',
        type: 'interactive-block',
        blockId: 'reward-block',
        x: 5,
        y: 12,
        reward: { type: 'coin' },
      }],
    });

    expect(errorsOf(level).map(({ path }) => path)).toContain('$.objects[0].reward');
  });

  it('rejects another interactive block in the settle column', () => {
    const level = definition({
      objects: [
        { id: 'brick-01', type: 'interactive-block', blockId: 'breakable-brick', x: 5, y: 11 },
        {
          id: 'reward-01',
          type: 'interactive-block',
          blockId: 'reward-block',
          x: 5,
          y: 10,
          reward: { type: 'coin' },
        },
      ],
    });

    const errors = errorsOf(level);
    expect(errors.map(({ path }) => path)).toContain('$.objects[1].reward');
  });
});

describe('reward release planning', () => {
  it('emerges above the block and settles into the open cell above ground', () => {
    const level = definition({
      objects: [{
        id: 'reward-01',
        type: 'interactive-block',
        blockId: 'reward-block',
        x: 5,
        y: 10,
        reward: { type: 'coin' },
      }],
    });
    const plan = planRewardRelease(level, { x: 5, y: 10 });

    expect(plan).toEqual({
      ok: true,
      plan: {
        emergeCell: { x: 5, y: 9 },
        emerge: { x: 5.5 * TILE, y: 9.5 * TILE },
        landingCell: { x: 5, y: 12 },
        landing: { x: 5.5 * TILE, y: 12.5 * TILE },
      },
    });
  });

  it('reports deterministic failure reasons instead of guessing', () => {
    const noGround = definition({ terrain: [] });
    expect(planRewardRelease(noGround, { x: 5, y: 10 })).toEqual({
      ok: false,
      reason: 'no-ground-below',
    });

    const ceiling = definition({
      terrain: [
        { type: 'ground', x: 0, y: 13, width: 20, height: 1 },
        { type: 'platform', x: 5, y: 8, width: 1, height: 1 },
      ],
    });
    expect(planRewardRelease(ceiling, { x: 5, y: 10 })).toEqual({
      ok: false,
      reason: 'blocked-emergence',
    });
  });
});

describe('head bump classification', () => {
  const block = { x: 100, y: 100, width: 64, height: 64 };
  const blockBottom = block.y + block.height;

  function evidence(overrides: Partial<Parameters<typeof isHeadBump>[0]> = {}) {
    return {
      block,
      playerLeft: 110,
      playerRight: 154,
      playerTop: blockBottom,
      playerBottom: blockBottom + 84,
      previousPlayerTop: blockBottom + 8,
      blockedUp: true,
      touchingUp: false,
      ...overrides,
    };
  }

  it('accepts a rising upward collision with horizontal overlap', () => {
    expect(isHeadBump(evidence())).toBe(true);
  });

  it('rejects side collisions without an upward contact flag', () => {
    expect(isHeadBump(evidence({
      blockedUp: false,
      touchingUp: false,
      playerTop: 130,
      previousPlayerTop: 138,
    }))).toBe(false);
  });

  it('rejects landing on top of the block', () => {
    expect(isHeadBump(evidence({
      blockedUp: true,
      playerTop: block.y - 84,
      previousPlayerTop: block.y - 86,
      playerBottom: block.y,
    }))).toBe(false);
  });

  it('rejects downward or non-upward contact', () => {
    expect(isHeadBump(evidence({
      playerTop: blockBottom + 2,
      previousPlayerTop: blockBottom,
    }))).toBe(false);
  });

  it('rejects a body that was already above the underside (growth/teleport)', () => {
    expect(isHeadBump(evidence({
      previousPlayerTop: blockBottom - 20,
      playerTop: blockBottom - 10,
      playerBottom: blockBottom + 74,
    }))).toBe(false);
  });

  it('rejects a contact without enough horizontal overlap', () => {
    expect(isHeadBump(evidence({
      playerLeft: 60,
      playerRight: 101,
    }))).toBe(false);
  });

  it('keeps a latched contact until a real separation, then rearms', () => {
    const pressed = { left: 110, right: 154, top: blockBottom, bottom: blockBottom + 84 };
    expect(isPlayerPressedFromBelow(block, pressed)).toBe(true);

    const separated = { ...pressed, top: blockBottom + 20, bottom: blockBottom + 104 };
    expect(isPlayerPressedFromBelow(block, separated)).toBe(false);

    const standingOnTop = { left: 110, right: 154, top: block.y - 84, bottom: block.y };
    expect(isPlayerPressedFromBelow(block, standingOnTop)).toBe(false);
  });
});

describe('interactive block rules', () => {
  it('allows only the configured form to break a breakable brick', () => {
    const rules = validConfig.value;

    expect(isFormAllowedToBreak('breakable-brick', 'big', rules)).toBe(true);
    expect(isFormAllowedToBreak('breakable-brick', 'small', rules)).toBe(false);
    expect(isFormAllowedToBreak('reward-block', 'big', rules)).toBe(false);
    expect(isFormAllowedToBreak('reward-block', 'small', rules)).toBe(false);
  });

  it('allows reward activation only from the unused state', () => {
    expect(canActivateRewardBlock('unused')).toBe(true);
    expect(canActivateRewardBlock('activating')).toBe(false);
    expect(canActivateRewardBlock('used')).toBe(false);
    expect(canActivateRewardBlock('destroyed')).toBe(false);
  });

  it('lets intact block rectangles obstruct the magnet and removed ones stop doing so', () => {
    const coin = { x: 0, y: 32 };
    const target = { x: 200, y: 32 };
    const blockRect = { x: 80, y: 0, width: 32, height: 64 };

    expect(reachableCoinDistance(coin.x, coin.y, target, 400, 13, 13, [blockRect])).toBeNull();
    expect(reachableCoinDistance(coin.x, coin.y, target, 400, 13, 13, [])).toBe(200);
  });

  it('derives a stable reward key from the authored block id', () => {
    expect(rewardRuntimeKey('reward-01')).toBe('reward:reward-01');
    expect(rewardRuntimeKey('reward-01')).not.toBe(rewardRuntimeKey('reward-02'));
    expect(rewardRuntimeKey('reward-01')).not.toBe('coin:0');
  });
});

describe('interactive block content - shipped levels', () => {
  const paths = collectLevelPaths(LEVELS_ROOT);
  const levels = paths.map((path) => ({ path, level: parseLevel(path) }));

  it('validates every shipped interactive-block placement', () => {
    for (const { path, level } of levels) {
      expect(validateInteractiveBlockPlacements(level), path).toEqual([]);
    }
  });

  it('places blocks in all three levels without changing authored totals', () => {
    for (const { level } of levels) {
      const blocks = level.objects.filter((object) => object.type === 'interactive-block');
      expect(blocks.length, level.id).toBeGreaterThan(0);
      expect(new Set(blocks.map((block) => block.id)).size).toBe(blocks.length);
      expect(createLevelGeometry(level).interactiveBlocks.length).toBe(blocks.length);
    }

    const one = levels.find(({ level }) => level.id === 'world-01-level-01')!.level;
    expect(one.objects.filter((object) => object.type === 'interactive-block' && object.blockId === 'breakable-brick').length).toBeGreaterThanOrEqual(2);
    expect(rewardTypes(one)).toEqual(expect.arrayContaining(['coin', 'growth-mushroom']));

    const two = levels.find(({ level }) => level.id === 'world-01-level-02')!.level;
    expect(two.objects.filter((object) => object.type === 'interactive-block' && object.blockId === 'breakable-brick').length).toBeGreaterThanOrEqual(3);
    expect(rewardTypes(two)).toEqual(expect.arrayContaining(['bomb', 'shield']));

    const three = levels.find(({ level }) => level.id === 'world-01-level-03')!.level;
    expect(three.objects.filter((object) => object.type === 'interactive-block' && object.blockId === 'breakable-brick').length).toBeGreaterThanOrEqual(3);
    expect(rewardTypes(three)).toEqual(expect.arrayContaining(['magnet', 'energy-flower']));
  });

  it('keeps authored coin/star totals unchanged', () => {
    const one = levels.find(({ level }) => level.id === 'world-01-level-01')!.level;
    const two = levels.find(({ level }) => level.id === 'world-01-level-02')!.level;
    const three = levels.find(({ level }) => level.id === 'world-01-level-03')!.level;

    expect(createLevelGeometry(one).collectibleTotals).toEqual({ coins: 12, stars: 2 });
    expect(createLevelGeometry(two).collectibleTotals).toEqual({ coins: 26, stars: 3 });
    expect(createLevelGeometry(three).collectibleTotals).toEqual({ coins: 29, stars: 4 });
  });

  it('derives block rects from the level tile size, not a hardcoded 64', () => {
    const level = definition({
      tileSize: 32,
      size: { width: 20, height: 14 },
      terrain: [{ type: 'ground', x: 0, y: 13, width: 20, height: 1 }],
      objects: [{
        id: 'reward-01',
        type: 'interactive-block',
        blockId: 'reward-block',
        x: 5,
        y: 10,
        reward: { type: 'coin' },
      }],
    });
    const [placement] = createLevelGeometry(level).interactiveBlocks;

    expect(placement?.rect).toEqual({ x: 5 * 32, y: 10 * 32, width: 32, height: 32 });
    expect(placement?.release?.emerge).toEqual({ x: 5.5 * 32, y: 9.5 * 32 });
    expect(placement?.release?.landing).toEqual({ x: 5.5 * 32, y: 12.5 * 32 });
  });

  it('produces one-tile rects and complete release plans', () => {
    for (const { level } of levels) {
      const geometry = createLevelGeometry(level);
      const keys = geometry.interactiveBlocks.map((placement) => placement.key);

      expect(new Set(keys).size).toBe(keys.length);

      for (const placement of geometry.interactiveBlocks) {
        expect(placement.key).toBe(`block:${placement.id}`);
        expect(placement.rect).toEqual({
          x: placement.cell.x * TILE,
          y: placement.cell.y * TILE,
          width: TILE,
          height: TILE,
        });

        if (placement.blockId === 'reward-block') {
          expect(placement.reward).not.toBeNull();
          expect(placement.release).not.toBeNull();
          expect(placement.release!.landingCell.y).toBeGreaterThan(placement.cell.y);
          expect(placement.release!.emergeCell.y).toBeLessThan(placement.cell.y);
        } else {
          expect(placement.reward).toBeNull();
          expect(placement.release).toBeNull();
        }
      }
    }
  });
});
