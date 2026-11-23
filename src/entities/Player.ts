import Phaser from 'phaser';
import type { PlayerInputState, PlayerVisualState } from '../types/player';
import type { PlayerMovementConfig } from '../types/player-config';
import { JumpController } from '../systems/jump-controller';
import { ensurePlayerTextures, PLAYER_BODY, PLAYER_TEXTURES } from './player-textures';

const RUN_FRAME_MS = 100;
const LANDING_VISUAL_MS = 110;
const RUN_SPEED_THRESHOLD = 12;

/**
 * Reusable player entity.
 *
 * Responsibilities:
 * - Apply movement rules through Arcade Physics (velocity/acceleration only).
 * - Consume a normalized `PlayerInputState`; never reads keyboard or pointers.
 * - Own facing and procedural visual state.
 *
 * Conventions:
 * - Sprite origin is (0.5, 1): `player.y` is the feet position.
 * - The collision body is 38x84 at offset (13, 12) inside the 64x96 frame, so the
 *   body bottom matches the feet exactly. Horizontally it is centered.
 * - The body does not scale with visuals; state changes only swap textures.
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  private readonly arcadeBody: Phaser.Physics.Arcade.Body;
  private readonly movement: PlayerMovementConfig;
  private readonly jumpController: JumpController;

  private facing: -1 | 1 = 1;
  private currentVisualState: PlayerVisualState = 'idle';
  private landingRemainingMs = 0;
  private wasGrounded = false;
  private runFrameElapsedMs = 0;
  private runFrameIndex: 0 | 1 = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, movement: PlayerMovementConfig) {
    ensurePlayerTextures(scene);
    super(scene, x, y, PLAYER_TEXTURES.idle);

    this.movement = movement;
    this.jumpController = new JumpController(movement);

    scene.add.existing(this);
    this.setOrigin(0.5, 1);
    this.setDepth(10);

    scene.physics.add.existing(this);

    const body = this.body;
    if (!(body instanceof Phaser.Physics.Arcade.Body)) {
      throw new Error('Player requires a dynamic Arcade Physics body.');
    }
    this.arcadeBody = body;

    body.setSize(PLAYER_BODY.width, PLAYER_BODY.height, false);
    body.setOffset(PLAYER_BODY.offsetX, PLAYER_BODY.offsetY);
    body.setCollideWorldBounds(true);
    body.setMaxVelocity(movement.maxSpeed, movement.maxFallSpeed);
    body.setDragX(movement.deceleration);
    body.setBounce(0, 0);
    body.setAllowRotation(false);
  }

  /** Advances movement, jump rules and visuals for one frame. */
  tick(deltaMs: number, input: PlayerInputState): void {
    this.applyHorizontalIntent(input.moveX);

    const grounded = this.isGrounded();
    this.jumpController.update(deltaMs, grounded, input.jumpPressed);

    if (this.jumpController.consumeJump()) {
      this.arcadeBody.setVelocityY(this.jumpController.jumpVelocity);
      this.landingRemainingMs = 0;
    }

    const jumpCutVelocity = this.jumpController.getJumpCutVelocity(
      this.arcadeBody.velocity.y,
      input.jumpHeld,
    );

    if (jumpCutVelocity !== null) {
      this.arcadeBody.setVelocityY(jumpCutVelocity);
    }

    this.updateVisualState(deltaMs, grounded);
  }

  /** Teleports the player to a safe position and clears all motion/timers. */
  respawnAt(x: number, y: number): void {
    // Body.reset positions the body's top-left and the sprite, but not the body
    // offset. The next physics preUpdate re-applies the offset before syncing
    // prev/prevFrame, so do not call updateFromGameObject here: doing so would
    // make postUpdate shift the sprite by the body offset.
    this.arcadeBody.reset(x, y);
    this.arcadeBody.setVelocity(0, 0);
    this.arcadeBody.setAccelerationX(0);

    this.jumpController.reset();
    this.landingRemainingMs = 0;
    this.wasGrounded = false;
    this.runFrameElapsedMs = 0;
    this.runFrameIndex = 0;
    this.currentVisualState = 'idle';

    this.facing = 1;
    this.setFlipX(false);
    this.setTexture(PLAYER_TEXTURES.idle);
  }

  /** Drops a jump remembered before the browser lost focus. */
  cancelBufferedJump(): void {
    this.jumpController.cancelBufferedJump();
  }

  get grounded(): boolean {
    return this.isGrounded();
  }

  get visualState(): PlayerVisualState {
    return this.currentVisualState;
  }

  get coyoteAvailable(): boolean {
    return this.jumpController.coyoteAvailable;
  }

  get jumpBuffered(): boolean {
    return this.jumpController.bufferActive;
  }

  get velocityX(): number {
    return this.arcadeBody.velocity.x;
  }

  get velocityY(): number {
    return this.arcadeBody.velocity.y;
  }

  get facingDirection(): -1 | 1 {
    return this.facing;
  }

  private applyHorizontalIntent(moveX: PlayerInputState['moveX']): void {
    if (moveX === 0) {
      this.arcadeBody.setAccelerationX(0);
      return;
    }

    this.arcadeBody.setAccelerationX(moveX * this.movement.acceleration);

    if (this.facing !== moveX) {
      this.facing = moveX;
      this.setFlipX(moveX < 0);
    }
  }

  private updateVisualState(deltaMs: number, grounded: boolean): void {
    if (grounded && !this.wasGrounded) {
      this.landingRemainingMs = LANDING_VISUAL_MS;
    } else {
      this.landingRemainingMs = Math.max(0, this.landingRemainingMs - deltaMs);
    }

    this.wasGrounded = grounded;

    const velocityY = this.arcadeBody.velocity.y;
    let nextState: PlayerVisualState;

    if (velocityY < -1) {
      // Covers the first frame of a (possibly buffered) jump, where the body can
      // still be reported as grounded before physics separates it.
      nextState = 'rising';
    } else if (!grounded) {
      nextState = 'falling';
    } else if (this.landingRemainingMs > 0) {
      nextState = 'landing';
    } else if (Math.abs(this.arcadeBody.velocity.x) > RUN_SPEED_THRESHOLD) {
      nextState = 'running';
    } else {
      nextState = 'idle';
    }

    if (nextState === 'running') {
      this.runFrameElapsedMs += deltaMs;
      if (this.runFrameElapsedMs >= RUN_FRAME_MS) {
        this.runFrameElapsedMs = 0;
        this.runFrameIndex = this.runFrameIndex === 0 ? 1 : 0;
      }
    } else {
      this.runFrameElapsedMs = 0;
      this.runFrameIndex = 0;
    }

    const textureKey = this.textureForState(nextState);

    if (this.texture.key !== textureKey) {
      this.setTexture(textureKey);
    }

    this.currentVisualState = nextState;
  }

  private textureForState(state: PlayerVisualState): string {
    switch (state) {
      case 'idle':
        return PLAYER_TEXTURES.idle;
      case 'running':
        return this.runFrameIndex === 0 ? PLAYER_TEXTURES.runA : PLAYER_TEXTURES.runB;
      case 'rising':
        return PLAYER_TEXTURES.rise;
      case 'falling':
        return PLAYER_TEXTURES.fall;
      case 'landing':
        return PLAYER_TEXTURES.land;
    }
  }

  private isGrounded(): boolean {
    return this.arcadeBody.blocked.down || this.arcadeBody.touching.down;
  }
}
