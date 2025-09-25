import { describe, it, expect } from "vitest";
import { Vector } from "../math/vector/vector";
import { Angle } from "../math/angle/angle";
import { Color } from "../math/color/color";

/**
 * Composite traversal (demo): each item has a Vector position, an Angle, and a Color.
 * Compute: scale position by (avg color / 50), then rotate by angle, and sum norms across all.
 * (Here we demo interop by plain TS for rotate; the point is "mix domains in one flow")
 */
describe("Composite Vector+Angle+Color traversal", () => {
  const items = {
    A: { position: new Vector(2, 0), angle: new Angle(Math.PI/2),  color: new Color(50, 50, 50) },
    B: { position: new Vector(0, 3), angle: new Angle(Math.PI/4),  color: new Color(30, 60, 90) },
    C: { position: new Vector(1, 1), angle: new Angle(0),          color: new Color(100, 0, 0)  },
  };

  const colorFactor = (c: Color) => ((c.r + c.g + c.b) / 3) / 50;  // ~1.0 = neutral

  const rotate = (v: Vector, a: Angle) => {
    const cos = Math.cos(a.radians), sin = Math.sin(a.radians);
    return new Vector(cos*v.x - sin*v.y, sin*v.x + cos*v.y);
  };

  it("mix domains in a fold", () => {
    const lengths: number[] = Object.keys(items).map((k) => {
      const { position, color, angle } = (items as any)[k];
      const scaled = position.scale(colorFactor(color));
      const rotated = rotate(scaled, angle);
      return rotated.length();
    });

    const total = lengths.reduce((s, n) => s + n, 0);
    expect(total).toBeGreaterThan(0);
  });
});
