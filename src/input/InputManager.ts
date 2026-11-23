import Phaser from 'phaser';
import type { PlayerInputState } from '../types/player';
import { computePlayerInputState } from './input-state';
import { TouchControls } from './TouchControls';

export interface InputManagerOptions {
  /** Enables the R respawn shortcut (development only). */
  readonly enableResetKey?: boolean;
  /** Called when focus/pause clears transient input (drop buffered jumps). */
  readonly onFocusLost?: () => void;
}

const CAPTURED_KEY_CODES = [
  Phaser.Input.Keyboard.KeyCodes.LEFT,
  Phaser.Input.Keyboard.KeyCodes.RIGHT,
  Phaser.Input.Keyboard.KeyCodes.UP,
  Phaser.Input.Keyboard.KeyCodes.SPACE,
];

const NEUTRAL_INPUT: PlayerInputState = {
  moveX: 0,
  jumpPressed: false,
  jumpHeld: false,
};

/**
 * Unified input layer.
 *
 * - Keyboard and touch feed the same normalized `PlayerInputState`.
 * - Jump is edge-triggered; holding it never repeats.
 * - Left + right resolves to neutral through pure logic.
 * - Pointer ownership and keyboard captures are fully released on shutdown,
 *   so restarting the scene cannot duplicate listeners or leave stuck input.
 */
export class InputManager {
  private readonly scene: Phaser.Scene;
  private readonly keyboard: Phaser.Input.Keyboard.KeyboardPlugin;
  private readonly onFocusLost: (() => void) | undefined;
  private readonly touchControls: TouchControls | null;

  private readonly keyLeft: Phaser.Input.Keyboard.Key;
  private readonly keyRight: Phaser.Input.Keyboard.Key;
  private readonly keyA: Phaser.Input.Keyboard.Key;
  private readonly keyD: Phaser.Input.Keyboard.Key;
  private readonly keyJumpUp: Phaser.Input.Keyboard.Key;
  private readonly keyJumpW: Phaser.Input.Keyboard.Key;
  private readonly keyJumpSpace: Phaser.Input.Keyboard.Key;
  private readonly keyReset: Phaser.Input.Keyboard.Key | null;
  private readonly registeredKeys: Phaser.Input.Keyboard.Key[] = [];

  private inputState: PlayerInputState = NEUTRAL_INPUT;
  private previousJumpHeld = false;
  private resetRequested = false;
  private destroyed = false;

  constructor(scene: Phaser.Scene, options: InputManagerOptions = {}) {
    this.scene = scene;
    this.onFocusLost = options.onFocusLost;

    const keyboard = scene.input.keyboard;

    if (keyboard === null) {
      throw new Error('Keyboard input is unavailable; keyboard: true is required in the game config.');
    }

    this.keyboard = keyboard;

    const addKey = (keyCode: number): Phaser.Input.Keyboard.Key => {
      const key = keyboard.addKey(keyCode);
      this.registeredKeys.push(key);

      return key;
    };

    this.keyLeft = addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyRight = addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.keyA = addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyJumpUp = addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyJumpW = addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyJumpSpace = addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyReset =
      options.enableResetKey === true ? addKey(Phaser.Input.Keyboard.KeyCodes.R) : null;

    keyboard.addCapture(CAPTURED_KEY_CODES);

    this.touchControls = shouldShowTouchControls(scene) ? new TouchControls(scene) : null;

    window.addEventListener('blur', this.handleFocusLost);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    scene.events.on(Phaser.Scenes.Events.PAUSE, this.handleFocusLost, this);
    scene.events.on(Phaser.Scenes.Events.SLEEP, this.handleFocusLost, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  /** Polls physical devices once per frame. Call before updating the player. */
  update(): void {
    if (this.destroyed) {
      return;
    }

    const upPressed = Phaser.Input.Keyboard.JustDown(this.keyJumpUp);
    const wPressed = Phaser.Input.Keyboard.JustDown(this.keyJumpW);
    const spacePressed = Phaser.Input.Keyboard.JustDown(this.keyJumpSpace);

    const touchJumpPressed = this.touchControls?.consumeJumpPressed() ?? false;

    const jumpHeld =
      this.keyJumpUp.isDown ||
      this.keyJumpW.isDown ||
      this.keyJumpSpace.isDown ||
      (this.touchControls?.jumpHeld ?? false);

    const leftHeld =
      this.keyLeft.isDown || this.keyA.isDown || (this.touchControls?.leftHeld ?? false);

    const rightHeld =
      this.keyRight.isDown || this.keyD.isDown || (this.touchControls?.rightHeld ?? false);

    this.inputState = computePlayerInputState({
      leftHeld,
      rightHeld,
      jumpHeld,
      jumpEvent: upPressed || wPressed || spacePressed || touchJumpPressed,
      previousJumpHeld: this.previousJumpHeld,
    });

    this.previousJumpHeld = jumpHeld;

    if (this.keyReset !== null && Phaser.Input.Keyboard.JustDown(this.keyReset)) {
      this.resetRequested = true;
    }
  }

  getInputState(): PlayerInputState {
    return this.inputState;
  }

  get touchControlsVisible(): boolean {
    return this.touchControls !== null;
  }

  /** Returns true once per R press (development builds only). */
  consumeResetRequest(): boolean {
    if (!this.resetRequested) {
      return false;
    }

    this.resetRequested = false;

    return true;
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;

    this.scene.events.off(Phaser.Scenes.Events.PAUSE, this.handleFocusLost, this);
    this.scene.events.off(Phaser.Scenes.Events.SLEEP, this.handleFocusLost, this);
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);

    window.removeEventListener('blur', this.handleFocusLost);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    this.touchControls?.destroy();

    this.keyboard.removeCapture(CAPTURED_KEY_CODES);

    for (const key of this.registeredKeys) {
      this.keyboard.removeKey(key, true, true);
    }

    this.registeredKeys.length = 0;
    this.inputState = NEUTRAL_INPUT;
    this.previousJumpHeld = false;
    this.resetRequested = false;
  }

  private readonly handleFocusLost = (): void => {
    this.keyboard.resetKeys();
    this.touchControls?.releaseAll();

    this.inputState = NEUTRAL_INPUT;
    this.previousJumpHeld = false;
    this.resetRequested = false;

    this.onFocusLost?.();
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      this.handleFocusLost();
    }
  };
}

/**
 * Touch controls are shown on touch-capable devices only.
 *
 * Developer overrides:
 * - `?touch=1` in dev builds.
 * - `VITE_FORCE_TOUCH_CONTROLS=true` (works in production builds too).
 */
function shouldShowTouchControls(scene: Phaser.Scene): boolean {
  const forceFromEnv = import.meta.env.VITE_FORCE_TOUCH_CONTROLS;

  if (forceFromEnv === 'true' || forceFromEnv === '1') {
    return true;
  }

  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('touch') === '1') {
    return true;
  }

  if (scene.sys.game.device.input.touch) {
    return true;
  }

  return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
}
