// Open in Vite dev at /tests/growth-browser.html?touch=1. Use a test-only campaign.
import forms from '../content/config/player-forms.json';

const storage = new Map();
const originals = Object.fromEntries(
  ['getItem', 'setItem', 'removeItem'].map((method) => [method, Storage.prototype[method]]),
);
Storage.prototype.getItem = (key) => storage.get(key) ?? null;
Storage.prototype.setItem = (key, value) => storage.set(key, value);
Storage.prototype.removeItem = (key) => storage.delete(key);

const output = document.querySelector('#results');
const checks = [];
const check = (condition, name) => {
  if (!condition) throw new Error(name);
  checks.push('PASS ' + name);
};
const near = (actual, expected) => Math.abs(actual - expected) < 0.001;
const duration = forms.growth.durationMs;

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
  const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { keyCode: code, which: code }));
  const menu = game.scene.getScene('MenuScene');
  const scene = game.scene.getScene('GameScene');
  const result = game.scene.getScene('ResultScene');
  const gameOver = game.scene.getScene('GameOverScene');
  const retryButton = (screen) => screen.buttons.find((button) => button.labelText.text === 'RETRY');
  const pickups = (type) => scene.collectionSystem.overlap.object2.getChildren()
    .filter((item) => item.collectibleType === type && !item.isCollected);
  const place = (x, y) => scene.player.respawnAt(x, y);
  const move = (x, y) => { place(x, y); step(); };
  const body = () => scene.player.physicsBody;
  const form = () => scene.effectSystem.transformation.form;
  const pending = () => scene.effectSystem.transformation.pending;
  const remaining = () => scene.effectSystem.active.remainingMs('growth');
  const finish = () => {
    move(scene.geometry.goal.x, scene.geometry.goal.y);
    step(3);
  };
  const fall = () => move(250, scene.geometry.worldHeight + 3 * scene.geometry.tileSize);
  const frameJump = (framesHeld) => {
    const ground = scene.player.y;
    let apex = ground;
    key('keydown', 32);
    for (let frame = 0; frame < 80; frame += 1) {
      if (frame === framesHeld) key('keyup', 32);
      step();
      apex = Math.min(apex, scene.player.y);
    }
    check(scene.player.grounded && near(scene.player.y, ground), form() + ' jump lands on the original ground');
    return ground - apex;
  };
  const verifyJumpWindows = () => {
    move(1748, 768);
    key('keydown', 37);
    for (let frame = 0; frame < 30 && scene.player.grounded; frame += 1) step();
    key('keyup', 37);
    check(!scene.player.grounded && scene.player.coyoteAvailable, form() + ' form can fall off a platform with coyote time');
    key('keydown', 32);
    step();
    key('keyup', 32);
    check(scene.player.velocityY < 0, form() + ' form can jump just after leaving a ledge');
    step();

    place(256, 819);
    body().setVelocityY(160);
    key('keydown', 32);
    step();
    check(!scene.player.grounded && scene.player.jumpBuffered, form() + ' form buffers an airborne jump press');
    for (let frame = 0; frame < 8 && scene.player.velocityY > 0; frame += 1) step();
    key('keyup', 32);
    check(scene.player.velocityY < 0, form() + ' form executes the buffered jump on landing');
    step();
  };

  click(menu.startButton);
  check(scene.state === 'playing' && scene.level.id === 'world-01-level-01' && form() === 'small',
    'Menu starts level 01 in small form');
  const initialBodies = scene.physics.world.bodies.size;
  const initialListeners = scene.input.listenerCount('pointerup');
  check(body().width === 38 && body().height === 84 && scene.player.grounded && near(body().bottom, scene.player.y),
    'Small Arcade body, ground contact and feet match the baseline');
  check(frameJump(2) + 10 < frameJump(20), 'Small form supports variable jump height through keyboard input');
  verifyJumpWindows();
  const retainedBody = body();
  const [first] = pickups('growth-mushroom');
  check(first.x === 736 && first.y === 736 && first.visible && first.texture.key.endsWith('growth-mushroom'),
    'Level 01 renders the procedural growth mushroom at its cell center');
  const scoreBefore = scene.currentCollectedScore();
  place(first.x - 15, first.y + 32);
  body().setVelocityX(120);
  step();
  check(first.isCollected && form() === 'big' && body() === retainedBody &&
    body().width === 46 && body().height === 130 && scene.player.scale === 1.4 &&
    near(body().bottom, scene.player.y) && near(body().bottom, first.y + 32) &&
    near(body().left + body().width / 2, scene.player.x) && body().velocity.x > 0 && scene.player.grounded &&
    scene.currentCollectedScore() === scoreBefore,
    'Real overlap grows the same grounded body in motion, with aligned feet and zero points');
  check(remaining() === duration && scene.gameHud.growthText.text === 'BIG · 20s' &&
    scene.gameHud.growthText.scrollFactorX === 0, 'Growth starts at full duration and shows on the fixed HUD');
  scene.scene.pause();
  step(25);
  check(remaining() === duration, 'Pausing freezes the growth clock');
  scene.scene.resume();
  step();
  const beforeFall = remaining();
  fall();
  check(form() === 'big' && near(remaining(), beforeFall - delta) && !pickups('growth-mushroom').length &&
    near(scene.player.x, scene.geometry.spawn.x) && near(body().bottom, scene.geometry.spawn.y),
    'Falling preserves the open-spawn form, pickup and remaining time');
  move(160, 832);
  check(frameJump(2) + 10 < frameJump(20), 'Big form supports variable jump height through keyboard input');
  const startX = scene.player.x;
  key('keydown', 39);
  step(18);
  key('keyup', 39);
  check(scene.player.x > startX + 20 && scene.player.velocityX > 100 &&
    near(scene.player.x, body().left + body().width / 2), 'Big form accelerates and moves with keyboard input');
  verifyJumpWindows();

  const effects = scene.effectSystem;
  effects.activate('shield');
  check(effects.aura.visible && effects.aura.scale === 1.4 && near(effects.aura.y, body().top + body().height / 2),
    'Shield aura follows the large body center and scale');
  const [mushroom, snail, sideEnemy] = scene.enemySystem.runtime.enemies;
  const stomp = (enemy) => {
    place(enemy.arcadeBody.center.x, enemy.arcadeBody.top - 2);
    body().setVelocityY(260);
    step();
  };
  stomp(mushroom);
  check(!mushroom.isAlive && effects.active.shieldCharges === 1 && scene.health.health === 3 &&
    scene.player.velocityY < 0, 'Big form stomps a mushroom and bounces without health or shield loss');
  stomp(snail);
  check(snail.health === 1, 'Big form removes one hit point from a snail on the first stomp');
  stomp(snail);
  check(!snail.isAlive, 'A second big-form stomp defeats the snail');
  const side = () => {
    // Stage the enemy away from the goal sensor at the east end of its patrol.
    place(1950, 768);
    sideEnemy.arcadeBody.reset(2078, 832);
    step();
    place(sideEnemy.arcadeBody.right + body().width / 2 + 2, sideEnemy.arcadeBody.bottom);
    body().setVelocityX(-350);
    step(2);
  };
  side();
  check(scene.health.health === 3 && scene.health.invulnerable && effects.active.shieldCharges === 0,
    'Big form pays the shield charge on real side contact');
  side();
  check(scene.health.health === 3, 'Invulnerability blocks repeat damage in big form');
  scene.health.tick(1000);
  side();
  check(scene.health.health === 2 && remaining() > 0 && scene.player.isStunned && scene.player.velocityX > 0,
    'Unshielded damage knocks back big form and leaves growth active');

  move(976, 832);
  effects.activate('magnet');
  const coin = pickups('coin').find((item) => item.x === 928);
  const coinCount = scene.collectionSystem.counts.coins;
  step(25);
  const afterPull = scene.collectionSystem.counts.coins;
  scene.collectionSystem.collect(coin);
  check(coin.isCollected && afterPull > coinCount &&
    scene.collectionSystem.counts.coins === afterPull && form() === 'big',
    'Magnet in big form collects the nearby coin exactly once');

  const throwBomb = (expectedX, expectedY) => {
    scene.bombSystem.inventory.add();
    key('keydown', 88);
    step();
    key('keyup', 88);
    const projectile = [...scene.bombSystem.active.keys()].at(-1);
    check(projectile && near(projectile.x, expectedX) && near(projectile.y, expectedY) &&
      projectile.body.velocity.x === 430, form() + ' form throws at its own hand height outside the body');
  };
  move(256, 832);
  throwBomb(292, 832 - 130 * 55 / 84);
  const feetBeforeExpiry = scene.player.feet;
  effects.update(remaining() - 1);
  check(form() === 'big' && near(remaining(), 1), 'Growth stays active until the last millisecond');
  step();
  check(form() === 'small' && body() === retainedBody && body().width === 38 && body().height === 84 &&
    body().offset.x === 13 && body().offset.y === 12 && scene.player.scale === 1 &&
    near(body().bottom, feetBeforeExpiry.y) && near(body().x + body().width / 2, feetBeforeExpiry.x) &&
    scene.player.grounded, 'Expiry restores exact source size, offsets, ground contact and feet');
  step(23);
  check(!scene.gameHud.growthText.visible, 'Inactive growth HUD is hidden');
  throwBomb(288, 777);
  check(scene.cameras.main.scrollX >= 0 && scene.inputManager.touchControlsVisible,
    'Camera remains configured and forced touch controls are present');

  place(sideEnemy.arcadeBody.right + 21, sideEnemy.arcadeBody.bottom);
  effects.activate('growth');
  effects.update(delta);
  check(pending() && form() === 'small' && scene.health.health === 2 && sideEnemy.isAlive,
    'Growth checks the extra body width against a live enemy without producing a combat contact');
  place(256, 832);
  step();
  finish();
  check(game.scene.isActive('ResultScene') && effects.disposed && !effects.transformation.pending &&
    !effects.active.isActive('growth') && !effects.aura.scene, 'Victory disposes growth and its run effects');
  click(retryButton(result));
  check(form() === 'small' && !pending() && pickups('growth-mushroom').length === 1 &&
    scene.physics.world.bodies.size === initialBodies && scene.input.listenerCount('pointerup') === initialListeners,
    'Retry restores pickup and starts with stable body and listener counts');

  finish();
  click(result.buttons.find((button) => button.labelText.text === 'NEXT LEVEL'));
  check(scene.level.id === 'world-01-level-02', 'Campaign loads level 02');
  const [blocked] = pickups('growth-mushroom');
  // Clear the adjacent snail so knockback cannot affect the headroom check.
  const ceilingSnail = scene.enemySystem.runtime.enemies.find((enemy) =>
    enemy.enemyId === 'snail' && Math.abs(enemy.x - blocked.x) < 100);
  const snailCenter = ceilingSnail.arcadeBody.center;
  scene.enemySystem.damageEnemiesInRadius(snailCenter.x, snailCenter.y, 1, ceilingSnail.health);
  const floor = blocked.y + 96;
  move(blocked.x, floor);
  check(blocked.isCollected && pending() && form() === 'small' && remaining() === 0 &&
    scene.gameHud.growthText.text === 'PENDING GROWTH' && near(scene.player.y, floor),
    'Real overlap under the level 02 overhang banks the pickup and starts no time');
  step(15);
  check(pending() && remaining() === 0, 'Pending growth remains untimed under the ceiling');
  key('keydown', 32);
  let hitCeiling = false;
  for (let frame = 0; frame < 25; frame += 1) {
    step();
    hitCeiling ||= body().blocked.up;
  }
  key('keyup', 32);
  check(hitCeiling && pending() && near(body().bottom, floor), 'Small form hits the ceiling and lands without unsafe growth');
  key('keydown', 39);
  for (let frame = 0; frame < 30 && form() === 'small'; frame += 1) step();
  key('keyup', 39);
  check(form() === 'big' && near(remaining(), duration) && near(body().bottom, floor),
    'Walking out from the overhang starts the full effect without a vertical displacement');
  check(scene.cameras.main.scrollX > 0 && scene.gameHud.growthText.scrollFactorX === 0,
    'Camera scrolls while HUD stays fixed');
  const beforeCrampedFall = remaining();
  fall();
  check(form() === 'small' && pending() && near(remaining(), beforeCrampedFall - delta) &&
    near(body().bottom, scene.geometry.spawn.y), 'A fall to a cramped spawn retains time without penetration');
  move(1510, 960);
  check(form() === 'big' && near(remaining(), beforeCrampedFall - 2 * delta),
    'Leaving a cramped respawn restores big form with the original remaining time');

  const spiky = scene.enemySystem.runtime.enemies.find((enemy) => !enemy.definition.stompable);
  const healthBefore = scene.health.health;
  scene.health.tick(1000);
  stomp(spiky);
  check(spiky.isAlive && scene.health.health === healthBefore - 1 && form() === 'big',
    'Top contact with spiky damages big form without shrinking');
  finish();
  click(result.buttons.find((button) => button.labelText.text === 'NEXT LEVEL'));
  check(scene.level.id === 'world-01-level-03' && pickups('growth-mushroom').length === 2,
    'Campaign loads both level 03 mushrooms');
  const [one, two] = pickups('growth-mushroom');
  move(one.x, one.y + 32);
  step(65);
  const firstDuration = remaining();
  move(two.x, two.y + 32);
  check(one.isCollected && two.isCollected && firstDuration < duration - 1000 && remaining() === duration &&
    body().width === 46 && body().height === 130, 'Second pickup refreshes the duration without stacking the size');
  place(992, 1104);
  body().setVelocityY(-450);
  let bigHitCeiling = false;
  for (let frame = 0; frame < 7; frame += 1) {
    step();
    bigHitCeiling ||= body().blocked.up;
  }
  check(bigHitCeiling && form() === 'big' && body().top >= 960,
    'Big form collides with the underside of a solid bridge over water');
  const failed = scene.effectSystem;
  const savedBeforeFailure = storage.get('matio.save.v1');
  const attacker = scene.enemySystem.runtime.enemies[0];
  for (let hit = 0; hit < 3; hit += 1) {
    scene.health.tick(1000);
    place(attacker.arcadeBody.right + body().width / 2 + 2, attacker.arcadeBody.bottom);
    body().setVelocityX(-250);
    step();
  }
  step(3);
  check(game.scene.isActive('GameOverScene') && failed.disposed && !failed.active.isActive('growth') &&
    !failed.transformation.pending && storage.get('matio.save.v1') === savedBeforeFailure,
    'Game Over clears growth and preserves the save');
  click(retryButton(gameOver));
  check(form() === 'small' && pickups('growth-mushroom').length === 2, 'Game Over Retry restores both growth pickups');

  output.dataset.status = 'passed';
} catch (error) {
  checks.push('FAIL ' + (error.stack ?? error));
  output.dataset.status = 'failed';
} finally {
  Object.assign(Storage.prototype, originals);
  output.textContent = checks.join('\n');
}
