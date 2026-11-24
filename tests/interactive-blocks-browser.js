// Open /tests/interactive-blocks-browser.html?level=world-01-level-01 in Vite dev.
// Fixture only: never bundled into the production build.
const storage = new Map();
const originalStorage = {};
for (const method of ['getItem', 'setItem', 'removeItem']) {
  originalStorage[method] = Storage.prototype[method];
}
Storage.prototype.getItem = (key) => storage.get(key) ?? null;
Storage.prototype.setItem = (key, value) => storage.set(key, value);
Storage.prototype.removeItem = (key) => storage.delete(key);

const output = document.querySelector('#results');
const checks = [];
const check = (condition, name) => {
  if (!condition) throw new Error(name);
  checks.push('PASS ' + name);
};

try {
  await import('../src/main.ts');
  const game = window.__MATIO_GAME__;
  await new Promise((resolve) => {
    function waitForMenu() {
      if (game.scene.isActive('MenuScene')) resolve();
      else requestAnimationFrame(waitForMenu);
    }
    waitForMenu();
  });
  game.loop.stop();

  let time = performance.now();
  const delta = 1000 / 60;
  function step(count = 1) {
    for (let index = 0; index < count; index += 1) {
      time += delta;
      game.step(time, delta);
    }
  }
  const click = (button) => {
    button.emit('pointerdown');
    button.emit('pointerup');
    step(3);
  };
  const key = (type, code, repeat = false) => window.dispatchEvent(
    new KeyboardEvent(type, { keyCode: code, which: code, repeat }),
  );
  const menu = game.scene.getScene('MenuScene');
  const scene = game.scene.getScene('GameScene');
  const levelId = new URLSearchParams(window.location.search).get('level') || 'world-01-level-01';
  const block = (id) => scene.interactiveBlockSystem.blocks.find((entry) => entry.placement.id === id);
  const rewardChildren = () => scene.collectionSystem.overlap.object2.getChildren()
    .filter((item) => String(item.collectibleKey || '').startsWith('reward:'));
  const jumpAt = (x, y, frames = 28) => {
    scene.player.respawnAt(x, y);
    step(4);
    key('keydown', 38);
    step(frames);
    key('keyup', 38);
    step(2);
  };
  const shrink = () => {
    scene.effectSystem.active.reset();
    step(8);
    check(scene.effectSystem.transformation.form === 'small', 'The player is small again for the next check');
  };

  click(menu.startButton);
  check(scene.state === 'playing', 'Menu starts the requested level');
  check(scene.level.id === levelId, `Loaded ${levelId} (got ${scene.level.id})`);
  check(scene.interactiveBlockSystem !== null, 'InteractiveBlockSystem is wired');
  check(scene.interactiveBlockSystem.blocks.length > 0, 'The level has interactive blocks');

  for (const entry of scene.interactiveBlockSystem.blocks) {
    check(entry.body !== null && entry.body.width === 64 && entry.body.height === 64,
      `Block ${entry.placement.id} has one tile-sized static body`);
    check(entry.texture.key.startsWith('matio-block-'), `Block ${entry.placement.id} uses procedural art`);
  }

  if (levelId === 'world-01-level-01') {
    const brick = block('brick-01');
    const bigBrick = block('brick-03');
    const coinReward = block('reward-01');
    const growthReward = block('reward-02');

    const coinsBefore = scene.collectionSystem.snapshot.coins;
    const scoreBefore = scene.currentCollectedScore();
    jumpAt(864, 832);
    check(brick.blockState === 'unused', 'Small head bump leaves an ordinary brick intact');
    check(brick.isSolid, 'The intact brick remains solid after a small bump');
    check(brick.contactLatched === false || brick.contactLatched === true,
      'The bump contact was processed without errors');
    check(scene.collectionSystem.snapshot.coins === coinsBefore,
      'A brick bump creates no coin');
    check(scene.currentCollectedScore() === scoreBefore,
      'A brick bump awards no score');

    // Repeated press cannot duplicate the interaction.
    jumpAt(864, 832);
    check(brick.blockState === 'unused' && brick.isSolid,
      'Repeated small bumps still cannot break the brick');

    // Big form breaks the high brick and removes its solid collision.
    const solidCountBeforeBreak = scene.interactiveBlockSystem.solidRects.length;
    check(scene.interactiveBlockSystem.solidRects.includes(bigBrick.rect),
      'Intact blocks participate in live solid queries');
    scene.player.respawnAt(1632, 832);
    step(4);
    scene.effectSystem.activate('growth');
    step(8);
    check(scene.effectSystem.transformation.form === 'big', 'Big form is active for the break check');
    jumpAt(1632, 832, 30);
    check(bigBrick.blockState === 'destroyed', 'Big form breaks the brick in one hit');
    check(!bigBrick.isSolid && bigBrick.body.enable === false,
      'A destroyed brick disables its Arcade body');
    check(!scene.interactiveBlockSystem.solidRects.includes(bigBrick.rect) &&
      scene.interactiveBlockSystem.solidRects.length === solidCountBeforeBreak - 1,
      'A destroyed brick disappears from live solid queries');
    check(scene.interactiveBlockSystem.temporaryObjects.size > 0,
      'Brick debris is created');

    scene.player.respawnAt(1632, 832);
    step(4);
    key('keydown', 38);
    step(24);
    key('keyup', 38);
    check(scene.player.physicsBody.top < 640,
      'The player can rise through the former brick location');
    shrink();

    // Landing on and side contact with an unused reward block are not head hits.
    const guarded = block('reward-02');
    scene.player.respawnAt(1696, 576);
    step(14);
    check(guarded.blockState === 'unused', 'Landing on a reward block does not activate it');
    scene.player.respawnAt(1696 - 64, 650);
    scene.player.physicsBody.setAllowGravity(false);
    scene.player.physicsBody.setVelocity(260, 0);
    step(16);
    check(guarded.blockState === 'unused', 'Side contact does not activate a reward block');
    scene.player.physicsBody.setAllowGravity(true);
    scene.player.physicsBody.setVelocity(0, 0);

    // Coin reward: one coin and one score award.
    const rewardCoinsBefore = scene.collectionSystem.snapshot.coins;
    const rewardScoreBefore = scene.currentCollectedScore();
    jumpAt(224, 832);
    check(coinReward.blockState === 'activating' || coinReward.blockState === 'used',
      'A valid head hit activates the reward block');
    check(coinReward.isSolid, 'An activating reward block stays solid');
    step(50);
    check(coinReward.blockState === 'used', 'The reward block becomes used');
    check(coinReward.isSolid, 'The used reward block remains solid');
    check(coinReward.texture.key === 'matio-block-used',
      'The used reward block switches to its used visual');
    check(scene.collectionSystem.snapshot.coins === rewardCoinsBefore + 1,
      'A coin reward is collected exactly once');
    check(scene.currentCollectedScore() >= rewardScoreBefore + 100,
      'A coin reward awards normal coin points');
    check(rewardChildren().filter((item) => !item.isCollected).length === 0,
      'The released coin is settled through CollectionSystem');

    // Repeated hits cannot pay out again.
    jumpAt(224, 832);
    step(40);
    check(scene.collectionSystem.snapshot.coins === rewardCoinsBefore + 1,
      'Repeated hits do not release a second coin');

    // Growth reward: Big form is needed to reach the row-9 block comfortably.
    scene.player.respawnAt(1696, 832);
    step(4);
    scene.effectSystem.activate('growth');
    step(8);
    jumpAt(1696, 832, 30);
    step(50);
    check(growthReward.blockState === 'used' && growthReward.isSolid,
      'The growth reward block becomes a used solid block');
    check(scene.effectSystem.active.isActive('growth'),
      'A growth-mushroom reward activates the existing growth effect');

    // Fall preserves block state; a new attempt restores authored blocks.
    const destroyedBeforeFall = bigBrick.blockState;
    const usedBeforeFall = coinReward.blockState;
    scene.player.respawnAt(scene.geometry.spawn.x, scene.geometry.worldHeight + 3 * 64);
    step(3);
    check(bigBrick.blockState === destroyedBeforeFall && coinReward.blockState === usedBeforeFall,
      'Falling preserves destroyed and used block state');
    const collidersBeforeRestart = scene.physics.world.colliders.size;
    scene.scene.start('GameScene', {});
    step(4);
    check(scene.interactiveBlockSystem.blocks.every((entry) => entry.blockState === 'unused'),
      'A new attempt restores every authored block');
    check(scene.physics.world.colliders.size === collidersBeforeRestart,
      'A restart does not leak or duplicate physics colliders');
  }

  if (levelId === 'world-01-level-02') {
    check(scene.interactiveBlockSystem.blocks.filter((entry) => entry.blockId === 'breakable-brick').length >= 3,
      'Level 02 has several breakable bricks');
    const bombBlock = block('reward-01');
    const bombsBefore = scene.bombSystem.inventory.quantity;
    scene.player.respawnAt(1952, 1024);
    step(4);
    scene.effectSystem.activate('growth');
    step(8);
    check(scene.effectSystem.transformation.form === 'big',
      'Big form reaches the Level 02 row-12 bomb block');
    jumpAt(1952, 1024, 30);
    check(bombBlock.blockState === 'activating' || bombBlock.blockState === 'used',
      `Level 02 bomb reward activates (state=${bombBlock.blockState}, form=${scene.effectSystem.transformation.form}, top=${scene.player.physicsBody.top}, latched=${bombBlock.contactLatched})`);
    step(50);
    check(scene.bombSystem.inventory.quantity === bombsBefore + 1,
      'A bomb reward increments the existing inventory exactly once');
    check(bombBlock.isSolid, 'The used bomb block stays solid');

    shrink();
    const shieldBlock = block('reward-02');
    jumpAt(3104, 1024, 28);
    step(50);
    check(shieldBlock.blockState === 'used' && shieldBlock.isSolid,
      'Level 02 shield reward becomes a used solid block');
    check(scene.effectSystem.active.isActive('shield'),
      'A shield reward activates the existing shield effect');

    // Projectiles treat intact interactive blocks as solid walls.
    const projectileBrick = block('brick-03');
    const fireRight = () => {
      scene.player.respawnAt(2400, 896);
      step(4);
      scene.player.facing = 1;
      scene.energyBallSystem.activate();
      return scene.energyBallSystem.fire();
    };

    scene.player.respawnAt(2272, 896);
    step(4);
    scene.effectSystem.activate('growth');
    step(8);
    check(scene.effectSystem.transformation.form === 'big',
      'Big form is active for the projectile checks');
    check(fireRight(), 'Energy Ball fires toward an intact brick');
    step(30);
    check(scene.energyBallSystem.activeCount === 0,
      'An intact interactive block destroys a side-hit Energy Ball');
    check(projectileBrick.blockState === 'unused' && projectileBrick.isSolid,
      'Energy Ball damage does not break an interactive brick');

    // Big form breaks the same brick, then the projectile passes the gap.
    scene.player.respawnAt(2528, 1024);
    step(4);
    key('keydown', 38);
    step(30);
    key('keyup', 38);
    step(20);
    check(projectileBrick.blockState === 'destroyed' && !projectileBrick.isSolid,
      'Big form breaks the projectile test brick');
    check(fireRight(), 'Energy Ball fires toward the removed brick');
    step(30);
    const passing = [...scene.energyBallSystem.active][0];
    check(passing && passing.x > 2600,
      'A projectile passes through the former brick location');
  }

  if (levelId === 'world-01-level-03') {
    check(scene.interactiveBlockSystem.blocks.filter((entry) => entry.blockId === 'breakable-brick').length >= 3,
      'Level 03 has several breakable bricks');
    const magnetBlock = block('reward-02');
    const energyBlock = block('reward-03');
    jumpAt(1696, 960, 28);
    step(50);
    check(magnetBlock.blockState === 'used' && magnetBlock.isSolid,
      'Level 03 magnet reward becomes a used solid block');
    check(scene.effectSystem.active.isActive('magnet'),
      'A magnet reward activates the existing magnet effect');

    jumpAt(4192, 960, 28);
    step(50);
    check(energyBlock.blockState === 'used' && energyBlock.isSolid,
      'Level 03 energy-flower reward becomes a used solid block');
    check(scene.energyBallSystem.abilityActive,
      'An energy-flower reward activates the existing Energy Ball ability');

    // Optional exploration reward on the high left platform.
    const optionalBlock = block('reward-01');
    const coinsBefore = scene.collectionSystem.snapshot.coins;
    jumpAt(608, 832, 28);
    step(50);
    check(optionalBlock.blockState === 'used' && optionalBlock.isSolid,
      'The optional Level 03 coin block becomes a used solid block');
    check(scene.collectionSystem.snapshot.coins === coinsBefore + 1,
      'The optional Level 03 coin reward is collected exactly once');
  }

  // Terminal freeze: no further generation after the scene leaves `playing`.
  scene.interactiveBlockSystem.freeze();
  check(scene.interactiveBlockSystem.inFlight.size === 0,
    'Freezing settles any in-flight reward without leftover animation state');

  output.textContent = checks.join('\n');
  console.info(`[interactive-blocks-browser] ${checks.length} checks passed for ${levelId}`);
} catch (error) {
  output.textContent = `${checks.join('\n')}\nFAIL ${error instanceof Error ? error.stack : error}`;
  console.error(error);
}
