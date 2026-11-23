import type { PlayerForm } from '../types/player-form';
import type { ActiveEffects } from './ActiveEffects';

/** Owns the attempt's physical form and a pickup waiting for clearance. */
export class PlayerTransformation {
  private currentForm: PlayerForm = 'small';
  private requested = false;
  private disposed = false;

  constructor(private readonly effects: ActiveEffects) {}

  get form(): PlayerForm {
    return this.currentForm;
  }

  get pending(): boolean {
    return !this.disposed && this.form === 'small' &&
      (this.requested || this.effects.isActive('growth'));
  }

  requestGrowth(): void {
    if (!this.disposed) this.requested = true;
  }

  /** Reconcile after effect time advances, so a new pickup gets a full interval. */
  update(canGrow: () => boolean): void {
    if (this.disposed) return;
    if (this.form === 'small' && (!this.pending || !canGrow())) return;

    if (this.requested) {
      this.effects.activate('growth');
      this.requested = false;
    }
    this.currentForm = this.effects.isActive('growth') ? 'big' : 'small';
  }

  /** A cramped spawn suspends the physical form while its existing timer runs. */
  prepareRespawn(canGrow: () => boolean): void {
    if (this.form === 'big' && !canGrow()) this.currentForm = 'small';
  }

  dispose(): void {
    this.disposed = true;
    this.requested = false;
    this.currentForm = 'small';
  }
}
