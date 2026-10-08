export class Angle {
  constructor(public readonly radians: number) {}
  /** add another angle (wrap not applied here) */
  add(rhs: Angle): Angle { return new Angle(this.radians + rhs.radians); }
  /** scale angle by scalar */
  scale(k: number): Angle { return new Angle(this.radians * k); }
  /** normalize to [-PI, PI) */
  normalize(): Angle {
    let t = this.radians;
    const twoPi = Math.PI * 2;
    t = ((t + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
    return new Angle(t);
  }
  /** convert to a unit vector scaled by length */
  toVector(length: number = 1): { x: number; y: number } {
    return { x: Math.cos(this.radians) * length, y: Math.sin(this.radians) * length };
  }
}
