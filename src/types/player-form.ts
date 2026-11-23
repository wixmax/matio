export type PlayerForm = 'small' | 'big';

export interface PlayerFormsConfig {
  readonly schemaVersion: 1;
  readonly growth: {
    readonly durationMs: number;
    readonly visualScale: number;
    readonly bodyWidthMultiplier: number;
    readonly bodyHeightMultiplier: number;
  };
}
