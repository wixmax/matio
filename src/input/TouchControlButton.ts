import Phaser from 'phaser';
import { PALETTE } from '../ui/theme';

export type TouchControlIcon = 'left' | 'right' | 'jump' | 'throw';

export interface TouchControlButtonOptions {
  readonly icon: TouchControlIcon;
  readonly radius: number;
  readonly onPointerDown: (pointerId: number) => void;
}

/**
 * A single semi-transparent touch target.
 *
 * The button is display-only for state: TouchControls owns pointer assignment
 * and release so a pointer can never be stuck to a control after it leaves the
 * button, the canvas, or the window.
 */
export class TouchControlButton extends Phaser.GameObjects.Container {
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly icon: TouchControlIcon;
  private readonly radius: number;
  private pressed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, options: TouchControlButtonOptions) {
    super(scene, x, y);

    this.icon = options.icon;
    this.radius = options.radius;
    this.background = scene.add.graphics();
    this.add(this.background);

    this.setSize(this.radius * 2, this.radius * 2);
    this.setScrollFactor(0);
    this.setDepth(1000);

    this.setInteractive({
      hitArea: new Phaser.Geom.Circle(this.radius, this.radius, this.radius),
      hitAreaCallback: Phaser.Geom.Circle.Contains,
      useHandCursor: true,
    });

    this.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      options.onPointerDown(pointer.id);
    });

    this.draw();
    scene.add.existing(this);
  }

  setPressed(pressed: boolean): this {
    if (this.pressed === pressed) {
      return this;
    }

    this.pressed = pressed;
    this.draw();

    return this;
  }

  /** Screen-space hit check used to release a pointer that slides off. */
  isPointerWithin(pointer: Phaser.Input.Pointer, tolerancePx = 10): boolean {
    const dx = pointer.x - this.x;
    const dy = pointer.y - this.y;
    const limit = this.radius + tolerancePx;

    return dx * dx + dy * dy <= limit * limit;
  }

  private draw(): void {
    const radius = this.radius;
    const pressed = this.pressed;

    this.background.clear();

    this.background.fillStyle(pressed ? PALETTE.accent : PALETTE.ink, pressed ? 0.62 : 0.3);
    this.background.fillCircle(0, 0, radius);

    this.background.lineStyle(4, PALETTE.white, pressed ? 0.95 : 0.55);
    this.background.strokeCircle(0, 0, radius);

    this.background.fillStyle(PALETTE.white, pressed ? 1 : 0.75);

    switch (this.icon) {
      case 'left':
        this.background.fillTriangle(
          -radius * 0.38,
          0,
          radius * 0.2,
          -radius * 0.36,
          radius * 0.2,
          radius * 0.36,
        );
        break;

      case 'right':
        this.background.fillTriangle(
          radius * 0.38,
          0,
          -radius * 0.2,
          -radius * 0.36,
          -radius * 0.2,
          radius * 0.36,
        );
        break;

      case 'jump':
        this.background.fillTriangle(
          0,
          -radius * 0.44,
          -radius * 0.34,
          -radius * 0.02,
          radius * 0.34,
          -radius * 0.02,
        );
        this.background.fillRoundedRect(
          -radius * 0.11,
          -radius * 0.04,
          radius * 0.22,
          radius * 0.36,
          3,
        );
        break;
      case 'throw':
        this.background.fillCircle(0, 5, radius * 0.32);
        this.background.fillRect(-4, -radius * 0.42, 8, radius * 0.2);
        break;
    }
  }
}
