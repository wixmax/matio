import Phaser from 'phaser';
import { PALETTE, toCssColor } from '../theme';
import { addUiText } from './ui-text';

export interface TextButtonOptions {
  label: string;
  onClick: () => void;
  width?: number;
  height?: number;
  fontSize?: number;
}

type ButtonState = 'idle' | 'hover' | 'pressed';

const DEFAULT_WIDTH = 360;
const DEFAULT_HEIGHT = 96;
const DEFAULT_FONT_SIZE = 36;
const CORNER_RADIUS = 22;

/**
 * Reusable menu button drawn with Graphics + Text (no art dependency yet).
 *
 * Pointer events are used instead of click events so mouse and touch share the
 * exact same code path. A press is only completed when the pointer is released
 * while still over the button, which matches native button behaviour.
 */
export class TextButton extends Phaser.GameObjects.Container {
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly buttonWidth: number;
  private readonly buttonHeight: number;
  private readonly onClick: () => void;

  private enabled = true;
  private pressed = false;
  private activated = false;
  private visualState: ButtonState = 'idle';

  constructor(scene: Phaser.Scene, x: number, y: number, options: TextButtonOptions) {
    super(scene, x, y);

    this.buttonWidth = options.width ?? DEFAULT_WIDTH;
    this.buttonHeight = options.height ?? DEFAULT_HEIGHT;
    this.onClick = options.onClick;

    this.background = scene.add.graphics();
    this.labelText = addUiText(scene, 0, 0, options.label, {
      fontStyle: 'bold',
      fontSize: `${options.fontSize ?? DEFAULT_FONT_SIZE}px`,
      color: toCssColor(PALETTE.white),
      stroke: toCssColor(PALETTE.ink),
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.add([this.background, this.labelText]);
    this.setSize(this.buttonWidth, this.buttonHeight);

    this.bindPointerEvents();
    this.refreshHitArea();
    this.draw();

    scene.add.existing(this);
  }

  /** Disables the button and its hit area (used while a transition is running). */
  setEnabled(enabled: boolean): this {
    if (this.enabled === enabled) {
      return this;
    }

    this.enabled = enabled;
    this.pressed = false;
    this.visualState = 'idle';

    if (enabled) {
      this.activated = false;
      this.refreshHitArea();
    } else {
      this.disableInteractive();
    }

    this.setAlpha(enabled ? 1 : 0.6);
    this.draw();

    return this;
  }

  private bindPointerEvents(): void {
    this.on('pointerover', () => {
      if (!this.enabled) {
        return;
      }
      this.visualState = 'hover';
      this.draw();
    });

    this.on('pointerout', () => {
      this.pressed = false;
      this.visualState = 'idle';
      this.draw();
    });

    this.on('pointerdown', () => {
      if (!this.enabled) {
        return;
      }
      this.pressed = true;
      this.visualState = 'pressed';
      this.draw();
    });

    this.on('pointerup', () => {
      if (!this.enabled || !this.pressed || this.activated) {
        return;
      }

      this.activated = true;
      this.pressed = false;
      this.visualState = 'hover';
      this.draw();
      this.onClick();
    });
  }

  private refreshHitArea(): void {
    // Container hit-test coordinates are offset by the container's display
    // origin (half of its size), so the hit area is expressed from (0,0) to
    // (width,height) even though children are drawn centered on (0,0).
    this.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(0, 0, this.buttonWidth, this.buttonHeight),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
  }

  private draw(): void {
    const halfWidth = this.buttonWidth / 2;
    const halfHeight = this.buttonHeight / 2;
    const shadowOffset = this.visualState === 'pressed' ? 3 : 8;

    const fillColor =
      this.visualState === 'pressed'
        ? PALETTE.accentDark
        : this.visualState === 'hover'
          ? PALETTE.accentLight
          : PALETTE.accent;

    this.background.clear();

    // Drop shadow (also acts as the button's "depth" while pressed).
    this.background.fillStyle(PALETTE.ink, 0.3);
    this.background.fillRoundedRect(-halfWidth, -halfHeight + shadowOffset, this.buttonWidth, this.buttonHeight, CORNER_RADIUS);

    // Body and top highlight.
    this.background.fillStyle(fillColor, 1);
    this.background.fillRoundedRect(-halfWidth, -halfHeight, this.buttonWidth, this.buttonHeight, CORNER_RADIUS);
    this.background.fillStyle(PALETTE.white, 0.18);
    this.background.fillRoundedRect(
      -halfWidth + 8,
      -halfHeight + 8,
      this.buttonWidth - 16,
      this.buttonHeight / 2 - 6,
      CORNER_RADIUS - 8,
    );

    // Cartoon outline.
    this.background.lineStyle(6, PALETTE.ink, 1);
    this.background.strokeRoundedRect(-halfWidth, -halfHeight, this.buttonWidth, this.buttonHeight, CORNER_RADIUS);

    this.labelText.setY(this.visualState === 'pressed' ? 3 : 0);
  }
}
