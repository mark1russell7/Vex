// tests/dsl.color.spec.ts
import { describe, it, expect } from "vitest";
import { Color } from "../math/color/color";
import { ColorAdapter } from "../dsl/adapters/color.domain";
import { mapChainTyped } from "../dsl/chain/base.chain";
import { ValueKind } from "../dsl/value.enum";

describe("Color DSL", () => {
  type Shape = { k: ValueKind.Scalar; rhs: ValueKind.Domain; min: ValueKind.Scalar; max: ValueKind.Scalar };
  const C = { color: new Color(10, 20, 30) };

  it("typed local: multiply then add then clamp", () => {
    const out = mapChainTyped<typeof C, Color, Shape>(ColorAdapter, { C })
      .prop("color")                    // focus Color(10,20,30)
      .localSetConst("k", 2)            // typed scalar
      .applyUsing("multiply", ["k"])    // (20,40,60)
      .localSetConst("rhs", new Color(5, 5, 5))
      .applyUsing("add", ["rhs"])       // (25,45,65)
      .localSetConst("min", 0)
      .localSetConst("max", 40)
      .applyUsing("clamp", ["min", "max"]) // (25,40,40)
      .value("C");

    expect(out.tag).toBe("Right");
    const c = (out as any).right as Color;
    expect([c.r, c.g, c.b]).toEqual([25, 40, 40]);
  });
});
