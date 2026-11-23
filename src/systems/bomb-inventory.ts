export class BombInventory {
  private count: number;
  constructor(readonly capacity: number, readonly initial: number) {
    this.count = initial;
  }
  get quantity(): number { return this.count; }
  get canAdd(): boolean { return this.count < this.capacity; }
  get available(): boolean { return this.count > 0; }
  add(): boolean { if (!this.canAdd) return false; this.count++; return true; }
  spend(): boolean { if (!this.available) return false; this.count--; return true; }
  reset(): void { this.count = this.initial; }
}
