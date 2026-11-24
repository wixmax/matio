import Phaser from 'phaser';
import type { Player } from '../entities/Player';
import type { EnemySystem } from './EnemySystem';
import type { BombConfig } from '../types/bomb';
import type { LevelDefinition } from '../types/level';
import { cellCenter } from './level-geometry';
import { bombSpawn, BOMB_BODY_SIZE, canThrowBomb } from './bomb-rules';
import { BombInventory } from './bomb-inventory';
import { PALETTE } from '../ui/theme';

const TEXTURE = 'matio-bomb';
const EXPLOSION_DURATION_MS = 220;

export class BombSystem {
  readonly inventory: BombInventory;
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly enemies: Pick<EnemySystem, 'damageEnemiesInRadius'>;
  private readonly settings: BombConfig['bomb'];
  private readonly active = new Map<Phaser.Physics.Arcade.Sprite, number>();
  private readonly effects = new Map<Phaser.GameObjects.Graphics, number>();
  private readonly pickups: Phaser.Physics.Arcade.Group;
  private readonly pickupCollider: Phaser.Physics.Arcade.Collider;
  private readonly terrainCollider: Phaser.Physics.Arcade.Collider;
  private readonly projectiles: Phaser.Physics.Arcade.Group;
  private readonly onChanged: () => void;
  private readonly fallLimit: number;
  private elapsedMs = 0;
  private lastThrowMs = -Infinity;
  private frozen = false;

  constructor(scene: Phaser.Scene, level: LevelDefinition, player: Player, enemies: Pick<EnemySystem, 'damageEnemiesInRadius'>,
    solids: readonly Phaser.GameObjects.GameObject[], config: BombConfig, onChanged: () => void) {
    this.scene = scene;
    this.player = player;
    this.enemies = enemies;
    this.settings = config.bomb;
    this.fallLimit = (level.size.height + 2) * level.tileSize;
    this.inventory = new BombInventory(this.settings.maxInventory, this.settings.initialInventory);
    this.onChanged = onChanged;
    ensureTexture(scene);
    this.pickups = scene.physics.add.group({ allowGravity: false, immovable: true });
    this.projectiles = scene.physics.add.group();
    for (const object of level.objects) {
      if (object.type !== 'bomb') continue;
      const point = cellCenter(object, level.tileSize);
      this.createPickup(point.x, point.y);
    }
    this.pickupCollider = scene.physics.add.overlap(player, this.pickups, (_player, item) => {
      if (this.frozen || !(item instanceof Phaser.Physics.Arcade.Sprite) || !item.active) return;
      if (!this.inventory.add()) return;
      item.destroy();
      this.onChanged();
    });
    this.terrainCollider = scene.physics.add.collider(this.projectiles, [...solids]);
  }

  /**
   * Creates one bomb pickup in the existing pickup group. Used by a reward
   * block so bomb rewards share the normal inventory overlap and cap rules.
   * The caller owns the emergence animation and may disable the body first.
   */
  spawnRewardPickup(x: number, y: number): Phaser.Physics.Arcade.Sprite | null {
    if (this.frozen) return null;
    return this.createPickup(x, y);
  }

  private createPickup(x: number, y: number): Phaser.Physics.Arcade.Sprite {
    const pickup = this.scene.physics.add.sprite(x, y, TEXTURE);
    pickup.setTint(PALETTE.sun);
    this.pickups.add(pickup);

    if (pickup.body instanceof Phaser.Physics.Arcade.Body) {
      pickup.body.setAllowGravity(false);
      pickup.body.setImmovable(true);
      pickup.body.setSize(28, 28, true);
    }

    return pickup;
  }

  throw(): boolean {
    if (this.frozen || !canThrowBomb(
      this.settings, this.inventory.available, this.active.size, this.elapsedMs - this.lastThrowMs,
    )) return false;
    const direction = this.player.facingDirection;
    const { x, y } = bombSpawn(this.player.physicsBody, direction);
    if (x < 16 || x > this.scene.physics.world.bounds.right - 16) return false;
    const bomb = this.scene.physics.add.sprite(x, y, TEXTURE);
    // Arcade applies group defaults on insertion, including velocity and gravity.
    this.projectiles.add(bomb);
    const body = bomb.body;
    if (!(body instanceof Phaser.Physics.Arcade.Body)) { bomb.destroy(); return false; }
    body.setSize(BOMB_BODY_SIZE, BOMB_BODY_SIZE, true);
    body.setGravityY(this.settings.gravity - this.scene.physics.world.gravity.y);
    body.setVelocity(direction * this.settings.throwVelocityX, this.settings.throwVelocityY);
    body.setBounce(0.25, 0.2);
    body.setCollideWorldBounds(true);
    this.active.set(bomb, this.elapsedMs + this.settings.fuseMs);
    this.inventory.spend();
    this.lastThrowMs = this.elapsedMs;
    this.onChanged();
    return true;
  }

  update(deltaMs: number): void {
    if (this.frozen) return;
    this.elapsedMs += deltaMs;
    for (const [graphic, expiresAt] of this.effects) {
      const remaining = expiresAt - this.elapsedMs;
      if (remaining <= 0) {
        this.effects.delete(graphic);
        graphic.destroy();
      } else {
        graphic.setAlpha(remaining / EXPLOSION_DURATION_MS);
      }
    }
    for (const [bomb, deadline] of this.active) {
      const body = bomb.body;
      if (!bomb.active || !(body instanceof Phaser.Physics.Arcade.Body) || body.center.y > this.fallLimit) {
        this.active.delete(bomb);
        bomb.destroy();
      } else if (this.elapsedMs >= deadline) {
        this.active.delete(bomb);
        this.explode(body.center.x, body.center.y);
        bomb.destroy();
      }
    }
  }

  freeze(): void {
    if (this.frozen) return;
    this.frozen = true;
    for (const bomb of this.active.keys()) bomb.destroy();
    this.active.clear();
    for (const graphic of this.effects.keys()) graphic.destroy();
    this.effects.clear();
    this.pickupCollider.active = false;
    this.terrainCollider.active = false;
  }

  destroy(): void {
    this.freeze();
    // Scene shutdown may already have disposed Arcade's world.
    if (this.scene.physics.world) {
      this.pickupCollider.destroy();
      this.terrainCollider.destroy();
    }
  }

  private explode(x: number, y: number): void {
    if (this.frozen) return;
    this.enemies.damageEnemiesInRadius(x, y, this.settings.explosionRadius, this.settings.damage);
    const graphic = this.scene.add.graphics().setDepth(20);
    graphic.fillStyle(PALETTE.sun, 0.45);
    graphic.fillCircle(x, y, this.settings.explosionRadius);
    this.effects.set(graphic, this.elapsedMs + EXPLOSION_DURATION_MS);
  }
}

function ensureTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE)) return;
  const graphic = scene.make.graphics({ x: 0, y: 0 });
  graphic.fillStyle(PALETTE.ink);
  graphic.fillCircle(16, 16, 14);
  graphic.fillStyle(PALETTE.white);
  graphic.fillCircle(11, 10, 4);
  graphic.generateTexture(TEXTURE, 32, 32);
  graphic.destroy();
}
