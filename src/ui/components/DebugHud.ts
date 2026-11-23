import Phaser from 'phaser';
import { GAME_WIDTH } from '../../core/constants';
import type { MoveDirection, PlayerVisualState } from '../../types/player';
import { PALETTE, toCssColor } from '../theme';
import { addUiText } from './ui-text';

export interface DebugHudState {
  readonly levelId: string;
  readonly levelName: string;
  readonly scrollX: number;
  readonly scrollY: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly grounded: boolean;
  readonly visualState: PlayerVisualState;
  readonly coyoteAvailable: boolean;
  readonly jumpBuffered: boolean;
  readonly moveX: MoveDirection;
  readonly respawns: number;
}

/**
 * Minimal development-only HUD. Created by GameScene only when
 * `import.meta.env.DEV` is true, so production builds ship no debug UI.
 */
export class DebugHud {
  private readonly text: Phaser.GameObjects.Text;
  private lastRendered = '';

  constructor(scene: Phaser.Scene) {
    this.text = addUiText(scene, GAME_WIDTH - 22, 18, '', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '15px',
      color: toCssColor(PALETTE.mutedText),
      backgroundColor: '#0b1220',
      padding: { left: 10, right: 10, top: 8, bottom: 8 },
      lineSpacing: 3,
    })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(2000)
      .setAlpha(0.86);
  }

  update(state: DebugHudState): void {
    const rendered = [
      'PLAYER DEBUG',
      state.levelName,
      state.levelId,
      `scroll ${Math.round(state.scrollX)},${Math.round(state.scrollY)}`,
      `vx ${formatSigned(state.velocityX)}   vy ${formatSigned(state.velocityY)}`,
      `state ${state.visualState}   grounded ${state.grounded ? 'yes' : 'no'}`,
      `coyote ${state.coyoteAvailable ? 'yes' : 'no'}   buffer ${state.jumpBuffered ? 'yes' : 'no'}`,
      `input ${formatSigned(state.moveX)}   respawns ${state.respawns}`,
    ].join('\n');

    if (rendered !== this.lastRendered) {
      this.text.setText(rendered);
      this.lastRendered = rendered;
    }
  }
}

function formatSigned(value: number): string {
  const rounded = Math.round(value);

  return rounded > 0 ? `+${rounded}` : String(rounded);
}
