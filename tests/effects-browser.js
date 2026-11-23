// Run in Vite dev at /tests/effects-browser.html?touch=1.
// Keep the test campaign isolated from the browser's Matio save.
const storage = new Map();
const methods = ['getItem', 'setItem', 'removeItem'];
const originals = Object.fromEntries(methods.map((method) => [method, Storage.prototype[method]]));
Storage.prototype.getItem = (key) => storage.get(key) ?? null;
Storage.prototype.setItem = (key, value) => storage.set(key, value);
Storage.prototype.removeItem = (key) => storage.delete(key);

const output = document.querySelector('#results');
const checks = [];
function check(condition, name) {
  if (!condition) throw new Error(name);
  checks.push('PASS ' + name);
}

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
  function click(button) {
    button.emit('pointerdown');
    button.emit('pointerup');
    step(3);
  }
  const menu = game.scene.getScene('MenuScene');
  const scene = game.scene.getScene('GameScene');
  click(menu.levelButtons[0]);
  check(scene.state === 'playing' && scene.level.id === 'world-01-level-01', 'Menu level card starts level 01');
  const pickupGroup = () => scene.collectionSystem.overlap.object2;
  const pickups = (type) => pickupGroup().getChildren().filter(
    (item) => item.collectibleType === type && !item.isCollected,
  );
  const itemAt = (type, x) => pickups(type).find((pickup) => pickup.x === x);
  function move(x, y) {
    scene.player.respawnAt(x, y);
    step();
  }
  function sideCollision(enemy) {
    scene.player.respawnAt(enemy.x + 42, 832);
    scene.player.physicsBody.setVelocityX(-120);
    step(2);
  }
  const health = () => scene.health.health;
  const effects = () => scene.effectSystem.active;
  const overlapListenerCount = scene.input.listenerCount('pointerup');
  const initialBodyCount = scene.physics.world.bodies.size;
  const shield = pickups('shield')[0];
  const magnet = pickups('magnet')[0];
  const [enemy] = scene.enemySystem.runtime.enemies;
  check(shield.x === 416 && shield.y === 800 && magnet.x === 544 && magnet.y === 736,
    'Shield and magnet start at the JSON cell centers');
  const baseline = scene.currentCollectedScore();
  move(383, 832);
  check(shield.isCollected && effects().shieldCharges === 1 && scene.effectSystem.aura.visible
    && scene.currentCollectedScore() === baseline, 'Shield overlaps, shows aura and grants no points');
  check(scene.gameHud.shieldText.text === 'SHIELD  1 · 15s', 'Shield HUD renders charge and rounded seconds');
  move(480, 792);
  check(scene.effectSystem.aura.x === scene.player.physicsBody.center.x
    && scene.effectSystem.aura.y === scene.player.physicsBody.center.y, 'Aura follows airborne player body');

  sideCollision(enemy);
  check(health() === 3 && effects().shieldCharges === 0 && scene.effectSystem.flash.visible
    && !scene.effectSystem.aura.visible, 'Real side collision spends shield and flashes without costing health');
  step(3);
  check(health() === 3, 'Repeated side collision is ignored during invulnerability');
  move(480, 832);
  step(65);
  sideCollision(enemy);
  check(health() === 2, 'Next eligible side collision inflicts normal damage');
  scene.effectSystem.activate('shield');
  sideCollision(enemy);
  check(health() === 2 && effects().shieldCharges === 1, 'Existing damage invulnerability takes priority over shield');
  move(enemy.x, 786);
  scene.player.physicsBody.setVelocityY(210);
  step(5);
  check(!enemy.isAlive && health() === 2 && effects().shieldCharges === 1,
    'Real falling stomp defeats the enemy without damaging shield or health');

  const near = itemAt('coin', 672);
  const distant = itemAt('coin', 2272);
  const star = itemAt('star', 608);
  const before = scene.collectionSystem.snapshot;
  move(544, 768);
  check(magnet.isCollected && effects().isActive('magnet') && scene.gameHud.magnetText.text === 'MAGNET  12s',
    'Magnet overlaps and shows the 12-second HUD indicator');
  check(near.x < 672 && distant.x === 2272 && star.x === 608, 'Only an in-range coin is pulled toward the player');
  step(20);
  const collected = scene.collectionSystem.snapshot;
  check(near.isCollected && collected.coins > before.coins && collected.stars === before.stars
    && collected.collectedPoints - before.collectedPoints === (collected.coins - before.coins) * 100,
    'Magnet settlement uses the normal coin count and points');
  scene.collectionSystem.collect(near);
  check(scene.collectionSystem.snapshot.coins === collected.coins, 'A second settlement cannot duplicate the reward');

  const blocked = itemAt('coin', 1568);
  move(1496, 832);
  step(12);
  check(blocked.x === 1568 && !blocked.isCollected, 'Block prevents attraction through terrain');
  check(scene.cameras.main.scrollX > 0 && scene.gameHud.magnetText.scrollFactorX === 0,
    'Camera scrolls and the effect HUD stays fixed');
  move(1568, 768);
  check(blocked.isCollected && scene.collectionSystem.snapshot.coins === collected.coins + 1,
    'Ordinary Arcade overlap still collects a coin through the same ledger');

  const shieldTime = effects().remainingMs('shield');
  const magnetTime = effects().remainingMs('magnet');
  scene.scene.pause();
  step(30);
  check(effects().remainingMs('shield') === shieldTime && effects().remainingMs('magnet') === magnetTime,
    'Scene pause stops both clocks');
  scene.scene.resume();
  step();
  scene.scene.sleep();
  step(30);
  check(Math.abs(effects().remainingMs('magnet') - (magnetTime - delta)) < 0.01,
    'Scene sleep stops the effect clock');
  scene.scene.wake();
  const respawns = scene.respawnCount;
  move(448, scene.geometry.worldHeight + 3 * scene.geometry.tileSize);
  check(scene.respawnCount === respawns + 1 && shield.isCollected && magnet.isCollected
    && effects().shieldCharges === 1 && effects().isActive('magnet')
    && Math.abs(effects().remainingMs('magnet') - (magnetTime - 2 * delta)) < 0.01,
    'Actual fall respawn preserves collected pickups, charges and elapsed gameplay time');

  scene.effectSystem.update(12000);
  check(!effects().isActive('magnet'), 'Magnet expires in gameplay time');
  scene.effectSystem.update(15000);
  step();
  check(!effects().isActive('shield') && !scene.effectSystem.aura.visible && scene.gameHud.shieldText.text === '',
    'Expired shield clears its aura, charges and HUD');

  scene.effectSystem.activate('shield');
  scene.effectSystem.activate('magnet');
  const completed = scene.effectSystem;
  const completedCollection = scene.collectionSystem;
  move(scene.geometry.goal.x, scene.geometry.goal.y);
  step(3);
  check(game.scene.isActive('ResultScene') && completed.disposed && !completed.aura.scene
    && !completed.active.isActive('magnet'), 'Real goal overlap disposes effect state and visual objects on Victory');
  const result = game.scene.getScene('ResultScene');
  check(result.result.collectedCoins === collected.coins + 1 && result.result.ratingStars === 1,
    'Result uses the settled coin count and existing rating rules');
  const settledCount = completedCollection.snapshot.coins;
  completedCollection.collect(distant);
  completed.activate('magnet');
  check(completedCollection.snapshot.coins === settledCount && !completed.active.isActive('magnet'),
    'Stale effect and collection calls cannot affect a completed run');
  click(result.buttons[0]);
  check(pickups('shield').length === 1 && pickups('magnet').length === 1
    && !effects().isActive('shield') && !effects().isActive('magnet')
    && scene.input.listenerCount('pointerup') === overlapListenerCount
    && scene.physics.world.bodies.size === initialBodyCount, 'Retry recreates pickups, bodies and listeners exactly once');

  scene.effectSystem.activate('magnet');
  const failed = scene.effectSystem;
  const savedBeforeFailure = new Map(storage);
  const retryEnemy = scene.enemySystem.runtime.enemies[0];
  for (let hit = 0; hit < 3; hit += 1) {
    scene.health.tick(1000);
    sideCollision(retryEnemy);
  }
  step(3);
  check(game.scene.isActive('GameOverScene') && failed.disposed && !failed.flash.scene
    && !failed.active.isActive('magnet'), 'Third eligible side collision sends Game Over and disposes effects');
  check(JSON.stringify([...savedBeforeFailure]) === JSON.stringify([...storage]), 'Failed run leaves the save untouched');

  game.scene.getScene('GameOverScene').scene.start('MenuScene');
  step(3);
  click(menu.levelButtons[1]);
  check(scene.state === 'playing' && scene.level.id === 'world-01-level-02'
    && pickups('shield').length === 1 && pickups('magnet').length === 2, 'Unlocked level 02 loads from its menu card');
  const [firstMagnet, secondMagnet] = pickups('magnet');
  move(firstMagnet.x, firstMagnet.y + 32);
  step(60);
  const beforeRefresh = effects().remainingMs('magnet');
  move(secondMagnet.x, secondMagnet.y + 32);
  check(beforeRefresh < 11500 && effects().remainingMs('magnet') > 11900,
    'Second magnet pickup refreshes the one existing effect');
  move(scene.geometry.goal.x, scene.geometry.goal.y);
  step(3);
  click(result.buttons[1]);
  check(scene.state === 'playing' && scene.level.id === 'world-01-level-03'
    && pickups('shield').length === 2 && pickups('magnet').length === 1, 'Victory unlocks level 03 with its authored pickups');
  const [firstShield, secondShield] = pickups('shield');
  move(firstShield.x, firstShield.y + 50);
  step(60);
  const beforeShieldRefresh = effects().remainingMs('shield');
  move(secondShield.x, secondShield.y + 32);
  check(firstShield.isCollected && secondShield.isCollected && beforeShieldRefresh < 14500
    && effects().remainingMs('shield') > 14900 && effects().shieldCharges === 1,
    'Second shield refreshes duration at the one-charge cap');
  check(scene.inputManager.touchControls !== null, 'Forced touch UI still exists on level 03');
  output.dataset.status = 'passed';
} catch (error) {
  checks.push('FAIL ' + (error.stack ?? error));
  output.dataset.status = 'failed';
} finally {
  Object.assign(Storage.prototype, originals);
  output.textContent = checks.join('\n');
}
