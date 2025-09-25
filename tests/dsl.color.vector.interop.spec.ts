import { describe, it, expect } from "vitest";
import { Color } from "../math/color/color";
import { Vector } from "../math/vector/vector";
import { ColorAdapter } from "../dsl/adapters/color.domain";
import { vectorMapChain } from "../dsl/adapters/vector.domain";
import { mapChain } from "../dsl/chain/base.chain";
import { BibloOptics } from "../dsl/optics.biblo";

describe("Color ↔ Vector interop (demo)", () => {
  const A = { color: new Color(30, 40, 0), position: new Vector(1, 2) };
  const Biblo = { vector: { defaults: { factor: 3 } } };

  it("Use biblo optic to pull a scale factor, then scale a vector", () => {
    const out = vectorMapChain({ A, Biblo })
      .self("A").prop("position")                                         // Vector(1,2)
      .localSetPeerOptic("k", "Biblo", BibloOptics.vector.defaults.factor) // k := 3
      .applyUsing("scale", ["k"])                                          // → (3,6)
      .value("A");

    expect(out.tag).toBe("Right");
    const v = (out as any).right as Vector;
    expect([v.x, v.y]).toEqual([3, 6]);
  });

  it("Color.toVector then construct a Vector from (x,y) outside DSL", () => {
    const res = mapChain<typeof A, Color>(ColorAdapter, { A })
      .prop("color")
      .applyUsing("toVector", [])                                          // returns {x,y,z}
      .value("A");

    expect(res.tag).toBe("Right");
    const v3 = (res as any).right as { x:number; y:number; z:number };
    const v2 = new Vector(v3.x, v3.y);
    expect(v2 instanceof Vector).toBe(true);
  });
});
