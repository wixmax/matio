import Phaser from 'phaser';
import type { PlayerInputState, PlayerVisualState } from '../types/player';
import type { PlayerMovementConfig } from '../types/player-config';
import type { WorldPoint } from '../types/level-runtime';
import { JumpController } from '../systems/jump-controller';
import { bodyAtFeet, bodySourceMetrics, SMALL_FORM, type PlayerFormMetrics } from '../systems/player-form-rules';
import { ensurePlayerTextures, PLAYER_TEXTURES } from './player-textures';

const RUN_FRAME_MS = 100;
const LANDING_VISUAL_MS = 110;
const RUN_SPEED_THRESHOLD = 12;

/** Neutral input used while a damage input lock is active. */
const NEUTRAL_INPUT: PlayerInputState = {
  moveX: 0,
  jumpPressed: false,
  jumpHeld: false,
};

const DAMAGE_FLASH_ALPHA = 0.45;

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
 * - Form changes apply validated collision metrics independently of animation.
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
  private stunRemainingMs = 0;
  private flashRemainingMs = 0;
  private flashIntervalMs = 0;
  private flashElapsedMs = 0;
  private flashOn = false;

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

    this.applyFormMetrics(SMALL_FORM);
    body.updateFromGameObject();
    body.setCollideWorldBounds(true);
    body.setMaxVelocity(movement.maxSpeed, movement.maxFallSpeed);
    body.setDragX(movement.deceleration);
    body.setBounce(0, 0);
    body.setAllowRotation(false);
  }

  /** Advances movement, jump rules and visuals for one frame. */
  tick(deltaMs: number, input: PlayerInputState): void {
    this.stunRemainingMs = Math.max(0, this.stunRemainingMs - deltaMs);

    // A hit briefly removes movement intent without disabling physics or the
    // whole player; gravity, collision and knockback keep running.
    const effectiveInput = this.stunRemainingMs > 0 ? NEUTRAL_INPUT : input;

    this.applyHorizontalIntent(effectiveInput.moveX);

    const grounded = this.isGrounded();
    this.jumpController.update(deltaMs, grounded, effectiveInput.jumpPressed);

    if (this.jumpController.consumeJump()) {
      this.arcadeBody.setVelocityY(this.jumpController.jumpVelocity);
      this.landingRemainingMs = 0;
    }

    const jumpCutVelocity = this.jumpController.getJumpCutVelocity(
      this.arcadeBody.velocity.y,
      effectiveInput.jumpHeld,
    );

    if (jumpCutVelocity !== null) {
      this.arcadeBody.setVelocityY(jumpCutVelocity);
    }

    this.updateDamageFlash(deltaMs);
    this.updateVisualState(deltaMs, grounded);
  }

  /** Teleports the player to a safe position and clears all motion/timers. */
  respawnAt(x: number, y: number): void {
    const body = this.arcadeBody;
    body.reset(x, y);

    this.jumpController.reset();
    this.landingRemainingMs = 0;
    this.wasGrounded = false;
    this.runFrameElapsedMs = 0;
    this.runFrameIndex = 0;
    this.currentVisualState = 'idle';
    this.stunRemainingMs = 0;
    this.flashRemainingMs = 0;
    this.flashElapsedMs = 0;
    this.flashOn = false;
    this.setAlpha(1);
    this.clearTint();

    this.facing = 1;
    this.setFlipX(false);
    this.setTexture(PLAYER_TEXTURES.idle);
    // reset() ignores the custom offset. Align both histories with the corrected
    // body so the pending Arcade postUpdate cannot displace the respawn.
    body.updateFromGameObject();
    body.prev.copy(body.position);
    body.prevFrame.copy(body.position);
  }

  get feet(): WorldPoint {
    const body = this.arcadeBody;
    return { x: body.left + body.width / 2, y: body.bottom };
  }

  /** Apply after Arcade's collision pass, before its sprite synchronization. */
  resizeForm(form: PlayerFormMetrics): void {
    const body = this.arcadeBody;
    const target = bodyAtFeet(this.feet, form);
    const shiftX = target.x - body.x;
    const shiftY = target.y - body.y;
    this.applyFormMetrics(form);
    body.position.set(target.x, target.y);
    body.updateCenter();
    // The shape change moves the top-left, but is neither player movement nor
    // a new stomp. Rebase both histories without changing velocity or flags.
    body.prev.set(body.prev.x + shiftX, body.prev.y + shiftY);
    body.prevFrame.set(body.prevFrame.x + shiftX, body.prevFrame.y + shiftY);
  }

  private applyFormMetrics(form: PlayerFormMetrics): void {
    const { width, height, offsetX, offsetY } = bodySourceMetrics(form);
    this.setScale(form.visualScale);
    this.arcadeBody.setSize(width, height, false);
    this.arcadeBody.setOffset(offsetX, offsetY);
    this.arcadeBody.updateBounds();
  }

  /** Drops a jump remembered before the browser lost focus. */
  cancelBufferedJump(): void {
    this.jumpController.cancelBufferedJump();
  }

  /** Stops movement without teleporting (used when a level is completed). */
  stopMotion(): void {
    this.arcadeBody.setAcceleration(0, 0);
    this.arcadeBody.setVelocity(0, 0);
  }

  /** Upward bounce after a successful stomp (negative velocity = up). */
  bounce(velocityY: number): void {
    this.arcadeBody.setVelocityY(velocityY);
    this.landingRemainingMs = 0;
  }

  /** Sets knockback velocity directly; physics still applies gravity/drag. */
  applyKnockback(velocityX: number, velocityY: number): void {
    this.arcadeBody.setAccelerationX(0);
    this.arcadeBody.setVelocity(velocityX, velocityY);
  }

  /** Ignores movement/jump intent for a short, configurable duration. */
  stun(durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      return;
    }

    this.stunRemainingMs = Math.max(this.stunRemainingMs, durationMs);
  }

  /** Alternates player alpha briefly so damage is visible without final art. */
  startDamageFlash(durationMs: number, intervalMs: number): void {
    if (
      !Number.isFinite(durationMs) ||
      !Number.isFinite(intervalMs) ||
      durationMs <= 0 ||
      intervalMs <= 0
    ) {
      return;
    }

    this.flashRemainingMs = durationMs;
    this.flashIntervalMs = intervalMs;
    this.flashElapsedMs = 0;
    this.flashOn = true;
    this.setAlpha(DAMAGE_FLASH_ALPHA);
  }

  get isStunned(): boolean {
    return this.stunRemainingMs > 0;
  }

  get physicsBody(): Phaser.Physics.Arcade.Body {
    return this.arcadeBody;
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

  private updateDamageFlash(deltaMs: number): void {
    if (this.flashRemainingMs <= 0) {
      return;
    }

    this.flashRemainingMs = Math.max(0, this.flashRemainingMs - deltaMs);
    this.flashElapsedMs += deltaMs;

    if (this.flashElapsedMs >= this.flashIntervalMs) {
      this.flashElapsedMs = 0;
      this.flashOn = !this.flashOn;
      this.setAlpha(this.flashOn ? DAMAGE_FLASH_ALPHA : 1);
    }

    if (this.flashRemainingMs === 0) {
      this.flashOn = false;
      this.setAlpha(1);
    }
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
