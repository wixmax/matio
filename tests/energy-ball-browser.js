// Open /tests/energy-ball-browser.html?touch=1 in Vite dev.
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
const near = (actual, expected) => Math.abs(actual - expected) < 0.001;

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
  const result = game.scene.getScene('ResultScene');
  const gameOver = game.scene.getScene('GameOverScene');
  const retryButton = (screen) => screen.buttons.find((button) => button.labelText.text === 'RETRY');
  const pickups = (type) => scene.collectionSystem.overlap.object2.getChildren()
    .filter((item) => item.collectibleType === type && !item.isCollected);
  const place = (x, y) => scene.player.respawnAt(x, y);
  const move = (x, y) => { place(x, y); step(); };
  const system = () => scene.energyBallSystem;
  const enemySystem = () => scene.enemySystem;
  const remaining = () => system().remainingMs;
  const cooldown = () => system().update(400);
  const clearProjectiles = () => {
    for (const ball of system().active) ball.destroy();
    step();
  };

  click(menu.startButton);
  check(scene.state === 'playing' && scene.level.id === 'world-01-level-01', 'Menu starts level 01');
  const initialBodies = scene.physics.world.bodies.size;
  const initialListeners = scene.input.listenerCount('pointerup');
  check(system() !== null && system().activeCount === 0 && !system().abilityActive,
    'Energy Ball starts inactive with no projectiles');
  check(!system().fire(), 'Firing without the ability is rejected');
  key('keydown', 67);
  step();
  key('keyup', 67);
  check(system().activeCount === 0, 'C does nothing while the ability is inactive');

  const [flower] = pickups('energy-flower');
  check(flower && flower.x === 352 && flower.y === 672 && flower.visible &&
    flower.texture.key.endsWith('energy-flower'), 'Level 01 renders the procedural energy flower at its cell center');
  const scoreBeforePickup = scene.currentCollectedScore();
  move(flower.x, flower.y + 32);
  step(2);
  const activatedRemaining = remaining();
  check(flower.isCollected, 'Real overlap collects the energy flower');
  check(pickups('energy-flower').length === 0, 'A collected flower leaves the pickup group');
  check(system().abilityActive, 'Collecting the flower activates the Energy Ball ability');
  check(activatedRemaining > 19900 && activatedRemaining <= 20000,
    'The ability starts at the configured 20-second window (got ' + activatedRemaining + ')');
  check(scene.currentCollectedScore() === scoreBeforePickup,
    'The energy flower grants no score (before ' + scoreBeforePickup + ', after ' + scene.currentCollectedScore() + ')');
  check(scene.gameHud.energyText.text === 'ENERGY · 20s' && scene.gameHud.energyText.visible &&
    scene.gameHud.energyText.scrollFactorX === 0, 'HUD shows ENERGY · 20s and stays camera-fixed');
  scene.collectionSystem.collect(flower);
  check(near(remaining(), activatedRemaining), 'Collecting the same flower again cannot extend the ability');

  clearProjectiles();
  move(288, 832);
  system().activate();
  cooldown();
  let fireCalls = 0;
  const realFire = system().fire.bind(system());
  system().fire = () => {
    fireCalls += 1;
    return realFire();
  };
  key('keydown', 67);
  step();
  const firstShot = [...system().active][0];
  check(firstShot && firstShot.body.velocity.x === 430 && firstShot.body.velocity.y === -80 &&
    firstShot.body.bounce.y === 0.75 && firstShot.body.gravity.y === -500 &&
    firstShot.body.allowGravity === true,
    'C applies the configured launch velocity, bounce and net gravity after group insertion');
  key('keydown', 67, true);
  step(30);
  key('keyup', 67);
  check(fireCalls === 1, 'Holding C after the cooldown does not repeat the shot');

  step(1);
  key('keydown', 75);
  step();
  key('keyup', 75);
  check(fireCalls === 2, 'K fires an independent second projectile request');
  system().fire = realFire;

  clearProjectiles();
  system().activate();
  cooldown();
  check(system().fire(), 'First limit test shot accepted');
  cooldown();
  check(system().fire(), 'Second limit test shot accepted');
  cooldown();
  check(!system().fire(), 'Maximum active projectile count rejects another shot');
  const limitBalls = [...system().active];
  limitBalls[0].destroy();
  system().update(1);
  check(system().fire(), 'A rejected shot does not consume the cooldown');
  clearProjectiles();

  key('keydown', 37);
  step();
  key('keyup', 37);
  cooldown();
  key('keydown', 67);
  step();
  key('keyup', 67);
  const leftShot = [...system().active][0];
  check(leftShot && leftShot.body.velocity.x === -430 && scene.player.facingDirection === -1,
    'Facing left launches the projectile left');
  clearProjectiles();

  move(256, 832);
  cooldown();
  check(system().fire(), 'Bounce test shot accepted');
  const bounceShot = [...system().active][0];
  let bounced = false;
  for (let frame = 0; frame < 90 && bounceShot.active; frame += 1) {
    step();
    if (bounceShot.body.blocked.down && bounceShot.body.velocity.y < -50) {
      bounced = true;
      break;
    }
  }
  check(bounced && bounceShot.active, 'The projectile bounces upward from the ground');
  clearProjectiles();

  cooldown();
  check(system().fire(), 'Wall test shot accepted');
  const wallShot = [...system().active][0];
  wallShot.body.reset(1500, 800);
  wallShot.body.setVelocity(430, 0);
  step(6);
  check(!wallShot.active && system().activeCount === 0, 'A blocking wall side destroys the projectile');

  cooldown();
  check(system().fire(), 'Lifetime test shot accepted');
  const lifetimeShot = [...system().active][0];
  system().update(2600);
  check(!lifetimeShot.active && system().activeCount === 0, 'Lifetime expiry removes the projectile');

  cooldown();
  check(system().fire(), 'Out-of-bounds test shot accepted');
  const escapedShot = [...system().active][0];
  escapedShot.body.reset(200, scene.geometry.worldHeight + 300);
  step();
  check(!escapedShot.active && system().activeCount === 0, 'Outside-world cleanup removes the projectile');

  scene.effectSystem.activate('growth');
  step();
  const bigBody = scene.player.physicsBody;
  system().activate();
  cooldown();
  check(scene.effectSystem.transformation.form === 'big' && system().fire(),
    'Big form accepts an Energy Ball shot');
  const bigShot = [...system().active].at(-1);
  check(bigShot.x > bigBody.right && bigShot.x - 10 > bigBody.right &&
    bigShot.y > bigBody.top && bigShot.y < bigBody.bottom &&
    bigShot.body.velocity.x === 430,
    'Big-form spawn is outside the current body at its hand height');
  clearProjectiles();

  const abilityBeforeFall = remaining();
  cooldown();
  check(system().fire(), 'Fall test projectile accepted');
  const beforeFallCount = system().activeCount;
  const collectedBeforeFall = pickups('energy-flower').length;
  scene.respawnPlayer();
  check(near(remaining(), abilityBeforeFall) && system().activeCount === beforeFallCount &&
    pickups('energy-flower').length === collectedBeforeFall,
    'Falling preserves the ability, remaining time, projectiles and collected flower');
  step();
  check(near(remaining(), abilityBeforeFall - delta), 'The preserved ability continues after respawn');

  check(scene.health.health === 3, 'Projectiles never damage the player');
  check(scene.bombSystem.active.size === 0 && scene.bombSystem.effects.size === 0,
    'Energy Ball creates no bomb fuse or delayed explosion');

  const victoryScore = scene.enemySystem.defeatedPoints;
  const victoryShot = [...system().active][0];
  const endingSystem = system();
  const endingEnemies = scene.enemySystem;
  scene.handleGoalReached();
  step(3);
  check(game.scene.isActive('ResultScene') && endingSystem.frozen && endingSystem.activeCount === 0 &&
    !endingSystem.fire() && endingEnemies.defeatedPoints === victoryScore && !victoryShot.active,
    'Victory freezes firing, removes projectiles and stops damage processing');
  click(retryButton(result));
  check(system().abilityActive === false && system().activeCount === 0 &&
    pickups('energy-flower').length === 1 && scene.physics.world.bodies.size === initialBodies &&
    scene.input.listenerCount('pointerup') === initialListeners,
    'Retry resets the ability and restores the flower with stable body/listener counts');

  const attacker = scene.enemySystem.runtime.enemies[0];
  system().activate();
  cooldown();
  system().fire();
  const failingSystem = system();
  const savedBeforeFailure = storage.get('matio.save.v1');
  for (let hit = 0; hit < 3; hit += 1) {
    scene.health.tick(2000);
    scene.enemySystem.resolvePlayerDamage(attacker);
  }
  step(3);
  check(game.scene.isActive('GameOverScene') && failingSystem.frozen && failingSystem.activeCount === 0 &&
    !failingSystem.fire(), 'Game Over freezes firing and removes active projectiles');
  click(retryButton(gameOver));
  check(!system().abilityActive && pickups('energy-flower').length === 1,
    'Game Over Retry resets the ability and restores the flower');
  check(storage.get('matio.save.v1') === savedBeforeFailure, 'A failed run writes no save');

  scene.scene.restart({ levelId: 'world-01-level-02' });
  step(3);
  check(scene.state === 'playing' && pickups('energy-flower').length === 2, 'Level 02 loads both flowers');
  const [flowerOne, flowerTwo] = pickups('energy-flower');
  move(flowerOne.x, flowerOne.y + 32);
  place(200, 1024);
  step(60);
  const decayed = remaining();
  move(flowerTwo.x, flowerTwo.y + 32);
  place(200, 1024);
  step(2);
  check(flowerOne.isCollected && flowerTwo.isCollected && decayed < 20000 &&
    remaining() > decayed && remaining() > 19900,
    'A second flower refreshes the full duration without stacking damage');

  const targets = enemySystem().runtime.enemies;
  const mushroom = targets.find((enemy) => enemy.enemyId === 'mushroom');
  const snail = targets.find((enemy) => enemy.enemyId === 'snail');
  const spiky = targets.find((enemy) => enemy.enemyId === 'spiky');
  const shootEnemy = (enemy) => {
    system().activate();
    cooldown();
    check(system().fire(), 'shot accepted for ' + enemy.enemyId);
    const ball = [...system().active].at(-1);
    ball.body.reset(enemy.arcadeBody.center.x, enemy.arcadeBody.center.y);
    step();
  };
  const pointsBefore = enemySystem().defeatedPoints;
  shootEnemy(mushroom);
  check(!mushroom.isAlive && scene.enemySystem.defeatedPoints === pointsBefore + 200,
    'One Energy Ball defeats a mushroom and awards 200 points once');
  shootEnemy(mushroom);
  check(scene.enemySystem.defeatedPoints === pointsBefore + 200,
    'A defeated enemy cannot be damaged or scored again');

  shootEnemy(snail);
  check(snail.isAlive && snail.health === 1 && scene.enemySystem.defeatedPoints === pointsBefore + 200,
    'First Energy Ball reduces a snail to one health without points');
  shootEnemy(snail);
  check(!snail.isAlive && scene.enemySystem.defeatedPoints === pointsBefore + 550,
    'A second projectile defeats the snail and awards 350 points once');

  const spikyDefeats = scene.enemySystem.snapshot.defeatedCount;
  shootEnemy(spiky);
  check(!spiky.isAlive && !spiky.definition.stompable &&
    scene.enemySystem.snapshot.defeatedCount === spikyDefeats + 1 &&
    scene.enemySystem.defeatedPoints === pointsBefore + 550,
    'Energy Ball defeats Spiky while its configured zero points are respected');

  const sharedSnail = targets.filter((enemy) => enemy.enemyId === 'snail' && enemy.isAlive)[0];
  shootEnemy(sharedSnail);
  check(sharedSnail.health === 1 && scene.enemySystem.defeatedPoints === pointsBefore + 550,
    'Energy Ball damages an enemy that bombs can also hit');
  scene.bombSystem.inventory.add();
  check(scene.bombSystem.throw(), 'Bomb accepted after the energy hit');
  const bomb = [...scene.bombSystem.active.keys()][0];
  bomb.body.reset(sharedSnail.arcadeBody.center.x, sharedSnail.arcadeBody.center.y);
  scene.bombSystem.update(1000);
  check(!sharedSnail.isAlive && scene.enemySystem.defeatedPoints === pointsBefore + 900,
    'Bomb finishes the same enemy through the shared damage path and scores once');

  const ceilingSetup = { x: 10 * 64 + 32, y: 14 * 64 + 24 };
  clearProjectiles();
  system().activate();
  cooldown();
  check(system().fire(), 'Ceiling test shot accepted');
  const ceilingShot = [...system().active].at(-1);
  ceilingShot.body.reset(ceilingSetup.x, ceilingSetup.y);
  ceilingShot.body.setVelocity(0, -450);
  const ceilingStart = ceilingShot.y;
  step(4);
  check(!ceilingShot.active && ceilingShot.y < ceilingStart && system().activeCount === 0,
    'A ceiling impact destroys the projectile deterministically');

  const goalScore = scene.enemySystem.defeatedPoints;
  system().activate();
  cooldown();
  check(system().fire(), 'Victory test shot accepted');
  const pendingShot = [...system().active].at(-1);
  const levelTwoEndingSystem = system();
  const levelTwoEndingEnemies = scene.enemySystem;
  scene.handleGoalReached();
  step(3);
  check(game.scene.isActive('ResultScene') && levelTwoEndingSystem.frozen &&
    levelTwoEndingSystem.activeCount === 0 && !pendingShot.active &&
    levelTwoEndingEnemies.defeatedPoints === goalScore,
    'Level 02 victory freezes projectile damage');
  click(retryButton(result));
  check(!system().abilityActive && pickups('energy-flower').length === 2,
    'Level 02 Retry restores both flowers and clears the ability');

  scene.scene.restart({ levelId: 'world-01-level-03' });
  step(3);
  check(scene.level.id === 'world-01-level-03' && pickups('energy-flower').length === 2,
    'Level 03 loads both flowers');
  const input = scene.inputManager;
  const controls = input.touchControls;
  check(input.touchControlsVisible && controls !== null, 'Forced touch controls exist');
  const bounds = game.canvas.getBoundingClientRect();
  const touch = (identifier, x, y) => {
    const clientX = bounds.left + x * bounds.width / 1280;
    const clientY = bounds.top + y * bounds.height / 720;
    const point = new Touch({ identifier, target: game.canvas, clientX, clientY });
    Object.defineProperties(point, { pageX: { value: clientX }, pageY: { value: clientY } });
    return point;
  };
  const touchEvent = (type, ...changedTouches) => game.canvas.dispatchEvent(
    new TouchEvent(type, { changedTouches, bubbles: true, cancelable: true }),
  );
  system().activate();
  cooldown();
  const moveTouch = touch(21, 228, 604);
  const jumpTouch = touch(22, 1152, 594);
  const throwTouch = touch(23, 1000, 594);
  const fireTouch = touch(24, 850, 594);
  touchEvent('touchstart', moveTouch, jumpTouch, throwTouch, fireTouch);
  input.update();
  check(input.getInputState().moveX === 1 && input.getInputState().jumpPressed &&
    input.consumeThrowRequest() && input.consumeFireRequest(),
    'RIGHT + JUMP + THROW + FIRE are independent simultaneous touch contacts');
  touchEvent('touchend', fireTouch);
  input.update();
  check(input.getInputState().moveX === 1 && input.getInputState().jumpHeld &&
    !input.consumeThrowRequest(), 'Releasing FIRE preserves direction and JUMP');
  touchEvent('touchmove', touch(21, 500, 400));
  check(!controls.rightHeld && controls.jumpHeld, 'Sliding off the direction control preserves other touches');
  window.dispatchEvent(new Event('blur'));
  check(controls.pointerControls.size === 0 && !input.consumeFireRequest() &&
    !input.consumeThrowRequest(), 'Blur releases every touch and clears queued fire');
  touchEvent('touchcancel', moveTouch, jumpTouch, throwTouch);

  const fireAgain = touch(31, 850, 594);
  touchEvent('touchstart', fireAgain);
  step();
  check(system().activeCount === 1, 'Touch FIRE launches a real projectile');
  touchEvent('touchend', fireAgain);
  step();
  touchEvent('touchstart', fireAgain);
  step();
  check(system().activeCount === 1, 'Repeated touch FIRE respects the cooldown and does not spam');
  touchEvent('touchend', fireAgain);

  scene.scene.restart({ levelId: 'world-01-level-01' });
  step(3);
  check(scene.physics.world.bodies.size === initialBodies &&
    scene.input.listenerCount('pointerup') === initialListeners && system().activeCount === 0,
    'Restarting the scene keeps body/listener counts stable and no projectiles alive');

  output.dataset.status = 'passed';
} catch (error) {
  checks.push('FAIL ' + (error.stack ?? error));
  output.dataset.status = 'failed';
} finally {
  Object.assign(Storage.prototype, originalStorage);
  output.textContent = checks.join('\n');
}
