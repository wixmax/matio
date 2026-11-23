// Open /tests/bomb-browser.html?touch=1 in Vite dev. The fixture never enters the build.
// Isolate campaign writes from the browser's existing Matio save.
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
function check(condition, name) {
  if (!condition) throw new Error(name);
  checks.push('PASS ' + name);
}

try {
  await import('../src/main.ts');
  const game = window.__MATIO_GAME__;
  const key = (type, code, repeat = false) => window.dispatchEvent(
    new KeyboardEvent(type, { keyCode: code, which: code, repeat }),
  );
  await new Promise((resolve) => {
    function waitForMenu() {
      if (game.scene.isActive('MenuScene')) resolve();
      else requestAnimationFrame(waitForMenu);
    }
    waitForMenu();
  });
  game.loop.stop();
  let time = performance.now();
  function step(count = 1) {
    for (let i = 0; i < count; i++) {
      time += 1000 / 60;
      game.step(time, 1000 / 60);
    }
  }
  const click = (button) => {
    button.emit('pointerdown');
    button.emit('pointerup');
  };
  click(game.scene.getScene('MenuScene').startButton);
  step(3);
  const scene = game.scene.getScene('GameScene');
  check(scene.state === 'playing', 'Main Menu starts level 01');
  const initialListeners = scene.input.listenerCount('pointerup');
  const initialBodies = scene.physics.world.bodies.size;
  const movePlayer = (x, y) => scene.player.respawnAt(x, y);
  const bombs = scene.bombSystem;
  while (bombs.inventory.add()) { /* Fill the run's inventory for the overlap check. */ }
  movePlayer(480, 832);
  step(3);
  check(bombs.inventory.quantity === 5 && bombs.pickups.getLength() === 2, 'full inventory leaves the pickup available');
  bombs.inventory.reset();
  step(3);
  check(bombs.inventory.quantity === 1 && bombs.pickups.getLength() === 1, 'JSON pickup grants one bomb');
  check(scene.gameHud.bombsText.text === 'BOMBS × 1', 'HUD reflects inventory');
  movePlayer(160, 832);
  key('keydown', 88);
  step();
  const projectile = [...bombs.active.keys()][0];
  check(projectile?.body.velocity.x === 430 && projectile.body.velocity.y === -300, 'X launches with configured velocity');
  const initialY = projectile.y;
  bombs.inventory.add();
  key('keydown', 88, true);
  step(12);
  check(projectile.x > 192 && projectile.y < initialY && bombs.inventory.quantity === 1, 'Arcade arc and held X does not repeat');
  let collided = false;
  for (let frame = 0; frame < 49; frame++) {
    step();
    collided ||= projectile.body?.blocked.down === true;
  }
  key('keyup', 88);
  check(collided && !projectile.active && bombs.active.size === 0 && bombs.effects.size === 1
    && bombs.inventory.quantity === 1, 'terrain collision, one fuse detonation and no held-key repeat');
  step(15);
  check(bombs.effects.size === 0 && scene.health.health === 3, 'effect expires and player is undamaged');
  key('keydown', 37);
  key('keydown', 74);
  step();
  const left = [...bombs.active.keys()][0];
  check(left?.body.velocity.x === -430 && bombs.inventory.quantity === 0, 'J follows left facing and spends one');
  key('keyup', 37);
  key('keyup', 74);
  check(!bombs.throw(), 'empty throw is rejected');
  bombs.inventory.add();
  check(!bombs.throw() && bombs.inventory.quantity === 1, 'cooldown rejection preserves ammunition');
  scene.respawnPlayer();
  check(bombs.inventory.quantity === 1 && bombs.pickups.getLength() === 1 && bombs.active.size === 1,
    'fall respawn preserves inventory, collected pickups and live projectiles');

  const finish = (trigger, next) => {
    const run = scene.bombSystem;
    const enemySystem = scene.enemySystem;
    const score = enemySystem.defeatedPoints;
    if (!run.active.size) {
      run.inventory.add();
      check(run.throw(), 'had an active projectile before ' + next);
    }
    trigger();
    step(80);
    check(game.scene.isActive(next) && run.active.size === 0 && run.effects.size === 0
      && enemySystem.defeatedPoints === score && !run.throw(), next + ' cancels pending combat');
  };
  finish(() => {
    const { x, y } = scene.geometry.goal;
    movePlayer(x, y);
  }, 'ResultScene');
  check(storage.has('matio.save.v1'), 'victory writes test campaign progress');
  const saveAfterVictory = storage.get('matio.save.v1');
  const retry = () => {
    const result = game.scene.isActive('ResultScene') ? 'ResultScene' : 'GameOverScene';
    click(game.scene.getScene(result).buttons.find((button) => button.labelText.text === 'RETRY'));
    step(3);
    check(scene.bombSystem.inventory.quantity === 0 && scene.bombSystem.pickups.getLength() === 2
      && scene.bombSystem.active.size === 0 && scene.input.listenerCount('pointerup') === initialListeners
      && scene.physics.world.bodies.size === initialBodies, 'retry restores pickups and keeps body/listener counts stable');
  };
  retry();
  finish(() => {
    const system = scene.enemySystem;
    const attacker = system.runtime.enemies[0];
    system.resolvePlayerDamage(attacker);
    system.resolvePlayerDamage(attacker);
    check(scene.health.health === 2 && scene.health.invulnerable, 'contact damage respects invulnerability');
    for (let hit = 0; hit < 2; hit++) {
      scene.health.tick(2000);
      system.resolvePlayerDamage(attacker);
    }
  }, 'GameOverScene');
  check(storage.get('matio.save.v1') === saveAfterVictory, 'Game Over preserves existing save');
  retry();
  scene.scene.restart({ levelId: 'world-01-level-02' });
  step(3);
  check(scene.state === 'playing' && scene.bombSystem.pickups.getLength() === 3, 'level 02 loads');
  const enemies = scene.enemySystem;
  const [mushroom, snail, spiky] = ['mushroom', 'snail', 'spiky'].map(
    (id) => enemies.runtime.enemies.find((enemy) => enemy.texture.key === 'matio-enemy-' + id),
  );
  const blastAt = (enemy) => {
    const run = scene.bombSystem;
    run.inventory.add();
    check(run.throw(), 'projectile accepted for ' + enemy.texture.key);
    const shot = [...run.active.keys()][0];
    shot.body.reset(enemy.arcadeBody.center.x, enemy.arcadeBody.center.y);
    run.update(1000);
  };
  blastAt(mushroom);
  check(!mushroom.isAlive && !mushroom.arcadeBody.enable && enemies.defeatedPoints === 200,
    'mushroom defeated, body disabled and 200 points');
  blastAt(mushroom);
  check(enemies.defeatedPoints === 200, 'dead mushroom does not score twice');
  blastAt(snail);
  check(snail.health === 1 && enemies.defeatedPoints === 200, 'first snail hit deals damage without points');
  blastAt(snail);
  check(!snail.isAlive && enemies.defeatedPoints === 550, 'second snail hit awards 350 points');
  blastAt(spiky);
  check(!spiky.isAlive && !spiky.definition.stompable && enemies.defeatedPoints === 550,
    'bomb defeats Spiky and its configured zero points are respected');

  scene.handleGoalReached();
  step(3);
  game.scene.getScene('ResultScene').scene.start('GameScene', { levelId: 'world-01-level-03' });
  step(3);
  check(scene.state === 'playing' && scene.bombSystem.pickups.getLength() === 3, 'level 03 loads');
  const input = scene.inputManager;
  const bounds = game.canvas.getBoundingClientRect();
  const touch = (identifier, x, y) => {
    const clientX = bounds.left + x * bounds.width / 1280;
    const clientY = bounds.top + y * bounds.height / 720;
    const point = new Touch({ identifier, target: game.canvas, clientX, clientY });
    // Chromium leaves page coordinates at zero on constructed touch points.
    Object.defineProperties(point, { pageX: { value: clientX }, pageY: { value: clientY } });
    return point;
  };
  const touchEvent = (type, ...changedTouches) => game.canvas.dispatchEvent(
    new TouchEvent(type, { changedTouches, bubbles: true, cancelable: true }),
  );
  for (const [x, direction] of [[108, -1], [228, 1]]) {
    const move = touch(1, x, 604);
    const jump = touch(2, 1152, 594);
    const fire = touch(3, 1000, 594);
    touchEvent('touchstart', move, jump, fire);
    input.update();
    check(input.getInputState().moveX === direction && input.getInputState().jumpPressed
      && input.consumeThrowRequest(), 'direction ' + direction + ' simultaneously with JUMP and THROW');
    touchEvent('touchend', fire);
    input.update();
    check(input.getInputState().moveX === direction && input.getInputState().jumpHeld,
      'releasing THROW preserves direction and JUMP');
    touchEvent('touchstart', fire);
    touchEvent('touchend', jump);
    input.update();
    check(!input.getInputState().jumpHeld && input.consumeThrowRequest()
      && [...input.touchControls.pointerControls.values()].includes('throw'), 'releasing JUMP preserves THROW ownership');
    touchEvent('touchcancel', move);
    input.update();
    check(input.getInputState().moveX === 0 && !input.getInputState().jumpHeld,
      'touch cancellation releases held controls');
    touchEvent('touchcancel', fire);
  }
  const controls = scene.inputManager.touchControls;
  const move = touch(1, 228, 604);
  const jump = touch(2, 1152, 594);
  const fire = touch(3, 1000, 594);
  touchEvent('touchstart', move, jump, fire);
  scene.bombSystem.inventory.add();
  step();
  check(scene.player.facingDirection === 1 && scene.player.velocityY < 0
    && scene.bombSystem.active.size === 1, 'simultaneous touch drives movement, jump and a real projectile');
  touchEvent('touchmove', touch(1, 500, 400));
  check(!controls.rightHeld && controls.jumpHeld, 'sliding off movement preserves the other pointer');
  window.dispatchEvent(new Event('blur'));
  check(controls.pointerControls.size === 0 && !input.consumeThrowRequest(), 'blur clears all held and queued inputs');
  touchEvent('touchcancel', move, jump, fire);

  const targets = scene.enemySystem;
  const [first, second, outside] = targets.runtime.enemies;
  first.arcadeBody.reset(640, 832);
  second.arcadeBody.reset(665, 832);
  outside.arcadeBody.reset(1000, 832);
  const outsideHealth = outside.health;
  const run = scene.bombSystem;
  const shot = [...run.active.keys()][0];
  shot.body.reset(640, 806);
  run.update(1000);
  check(!first.isAlive && second.health === 1 && outside.health === outsideHealth
    && targets.defeatedPoints === 200, 'one blast damages each in-range enemy once and leaves an outside enemy alone');
  run.update(10);
  check(second.health === 1 && run.effects.size === 1, 'expired projectile cannot damage targets again');
  scene.scene.restart({ levelId: 'world-01-level-03' });
  step(3);
  check(run.effects.size === 0 && scene.bombSystem.inventory.quantity === 0
    && scene.input.listenerCount('pointerup') === initialListeners, 'scene shutdown removes an active effect and input stays clean');
  output.dataset.status = 'passed';
} catch (error) {
  checks.push('FAIL ' + (error.stack ?? error));
  output.dataset.status = 'failed';
} finally {
  Object.assign(Storage.prototype, originalStorage);
  output.textContent = checks.join('\n');
}
