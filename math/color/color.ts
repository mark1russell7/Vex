export class Color {
  constructor(public readonly r: number, public readonly g: number, public readonly b: number, public readonly a: number = 1) {}

  /** Add channel-wise (no clamp) — pairwise color add */
  add(rhs: Color): Color {
    return new Color(this.r + rhs.r, this.g + rhs.g, this.b + rhs.b, this.a);
  }

  /** Multiply by scalar factor (no clamp) */
  multiply(factor: number): Color {
    return new Color(this.r * factor, this.g * factor, this.b * factor, this.a);
  }

  /** Clamp channels to [min, max] */
  clamp(min: number = 0, max: number = 255): Color {
    const clamp1 = (x: number) => Math.min(max, Math.max(min, x));
    return new Color(clamp1(this.r), clamp1(this.g), clamp1(this.b), this.a);
  }

  /** Convert to "unit" vector scaled by average intensity (demo interop) */
  toVector(): { x: number; y: number; z: number } {
    const m = (this.r + this.g + this.b) / 3;
    // fake basis: x=r, y=g, z=b normalized to average magnitude (demo only)
    const len = Math.hypot(this.r, this.g, this.b) || 1;
    return { x: (this.r / len) * m, y: (this.g / len) * m, z: (this.b / len) * m };
  }
}
