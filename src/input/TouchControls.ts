import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../core/constants';
import { TouchControlButton } from './TouchControlButton';

type TouchControl = 'left' | 'right' | 'jump' | 'throw';

const LEFT_POSITION = { x: 108, y: GAME_HEIGHT - 116 } as const;
const RIGHT_POSITION = { x: 228, y: GAME_HEIGHT - 116 } as const;
const JUMP_POSITION = { x: GAME_WIDTH - 128, y: GAME_HEIGHT - 126 } as const;
const THROW_POSITION = { x: GAME_WIDTH - 280, y: GAME_HEIGHT - 126 } as const;

const MOVE_RADIUS = 52;
const JUMP_RADIUS = 62;

/**
 * On-screen movement controls for touch devices.
 *
 * Multitouch model:
 * - Every pointer may own at most one control (map pointerId -> control).
 * - A press assigns ownership; a global pointer-up/up-outside or leaving the
 *   button's circle releases it, so input cannot stick.
 * - Jump presses are queued so a tap shorter than one frame is never lost.
 *
 * Layout uses the logical 1280x720 space; ScaleManager maps it to any landscape
 * viewport. Controls are fixed to the camera (scrollFactor 0).
 */
export class TouchControls {
  private readonly scene: Phaser.Scene;
  private readonly buttons: Readonly<Record<TouchControl, TouchControlButton>>;
  private readonly pointerControls = new Map<number, TouchControl>();

  private jumpPressedQueued = false;
  private throwPressedQueued = false;
  private destroyed = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const left = new TouchControlButton(scene, LEFT_POSITION.x, LEFT_POSITION.y, {
      icon: 'left',
      radius: MOVE_RADIUS,
      onPointerDown: (pointerId) => this.assignPointer(pointerId, 'left'),
    });

    const right = new TouchControlButton(scene, RIGHT_POSITION.x, RIGHT_POSITION.y, {
      icon: 'right',
      radius: MOVE_RADIUS,
      onPointerDown: (pointerId) => this.assignPointer(pointerId, 'right'),
    });

    const jump = new TouchControlButton(scene, JUMP_POSITION.x, JUMP_POSITION.y, {
      icon: 'jump',
      radius: JUMP_RADIUS,
      onPointerDown: (pointerId) => this.assignPointer(pointerId, 'jump'),
    });
    const throwButton = new TouchControlButton(scene, THROW_POSITION.x, THROW_POSITION.y, {
      icon: 'throw', radius: MOVE_RADIUS,
      onPointerDown: (pointerId) => this.assignPointer(pointerId, 'throw'),
    });

    this.buttons = { left, right, jump, throw: throwButton };

    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    scene.input.on(Phaser.Input.Events.GAME_OUT, this.onGameOut, this);
  }

  get leftHeld(): boolean {
    return this.isControlHeld('left');
  }

  get rightHeld(): boolean {
    return this.isControlHeld('right');
  }

  get jumpHeld(): boolean {
    return this.isControlHeld('jump');
  }

  /** Returns true once per jump press, including taps shorter than a frame. */
  consumeJumpPressed(): boolean {
    if (!this.jumpPressedQueued) {
      return false;
    }

    this.jumpPressedQueued = false;

    return true;
  }

  consumeThrowPressed(): boolean {
    const pressed = this.throwPressedQueued;
    this.throwPressedQueued = false;
    return pressed;
  }

  /** Releases every pointer (focus loss, pause, shutdown). */
  releaseAll(): void {
    this.pointerControls.clear();
    this.jumpPressedQueued = false;
    this.throwPressedQueued = false;

    for (const button of Object.values(this.buttons)) {
      button.setPressed(false);
    }
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.releaseAll();

    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.scene.input.off(Phaser.Input.Events.GAME_OUT, this.onGameOut, this);

    for (const button of Object.values(this.buttons)) {
      button.destroy();
    }
  }

  private assignPointer(pointerId: number, control: TouchControl): void {
    const existing = this.pointerControls.get(pointerId);

    if (existing === control) {
      return;
    }

    if (existing !== undefined) {
      this.releasePointer(pointerId);
    }

    this.pointerControls.set(pointerId, control);
    this.buttons[control].setPressed(true);

    if (control === 'jump') {
      this.jumpPressedQueued = true;
    }
    if (control === 'throw') this.throwPressedQueued = true;
  }

  private releasePointer(pointerId: number): void {
    const control = this.pointerControls.get(pointerId);

    if (control === undefined) {
      return;
    }

    this.pointerControls.delete(pointerId);
    this.buttons[control].setPressed(this.isControlHeld(control));
  }

  private isControlHeld(control: TouchControl): boolean {
    for (const heldControl of this.pointerControls.values()) {
      if (heldControl === control) {
        return true;
      }
    }

    return false;
  }

  private readonly onPointerUp = (pointer: Phaser.Input.Pointer): void => {
    this.releasePointer(pointer.id);
  };

  private readonly onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    const control = this.pointerControls.get(pointer.id);

    if (control === undefined || !pointer.isDown) {
      return;
    }

    if (!this.buttons[control].isPointerWithin(pointer)) {
      this.releasePointer(pointer.id);
    }
  };

  /** The pointer left the canvas; drop every owned control. */
  private readonly onGameOut = (): void => {
    this.releaseAll();
  };
}
