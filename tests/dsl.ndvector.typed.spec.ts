import { describe, it, expect } from "vitest";
import { NDVector } from "../math/vector/ndvector";
import { NDV } from "../math/vector/ndv";
import { NDVectorAdapter } from "../dsl/adapters/ndvector.domain";
import { mapChain, mapChainTyped } from "../dsl/chain/base.chain";
import { ValueKind } from "../dsl/value.enum";

/**
 * These tests exercise NDV<K> with the DSL:
 * - compile-time: NDV<K> gives key-level type-safety (not asserted at runtime)
 * - runtime: operations over union-of-keys behave as expected
 * - DSL interop: NDV<K> works with NDVectorAdapter (NDV extends NDVector)
 */

describe("NDV<K> typed façade over NDVector", () => {
  it("basic algebra & union of keys", () => {
    const v1 = NDV.fromExact<"x" | "y">({ x: 1, y: 2 });                 // NDV<'x'|'y'>
    const v2 = NDV.of<"x" | "z">([["x", 2], ["z", 5]] as const);          // NDV<'x'|'z'>

    const scaled = v1.scale(3);  // {x:3,y:6}
    const sum = scaled.addT(v2); // union keys {x:5,y:6,z:5}

    expect(scaled.getT("x")).toBe(3);
    expect(scaled.getT("y")).toBe(6);
    expect(sum.get("x")).toBe(5);
    expect(sum.get("y")).toBe(6);
    expect(sum.get("z")).toBe(5);

    const d = v1.dotT(v2);      // dot: 1*2 + 2*0 = 2
    expect(d).toBe(2);
  });

  it("DSL: scale + add using local map, with typed local shape", () => {
    type Shape = { k: ValueKind.Scalar; rhs: ValueKind.Domain };
    const A = { v: NDV.fromExact<"x" | "y">({ x: 1, y: 2 }) };
    const rhs = NDV.fromExact<"x" | "z">({ x: 2, z: 5 });

    const out = mapChainTyped<typeof A, NDVector, Shape>(NDVectorAdapter, { A })
      .prop("v")                    // NDV<'x'|'y'> (as NDVector at runtime)
      .localSetConst("k", 3)        // typed: k is Scalar
      .applyUsing("scale", ["k"])   // {x:3,y:6}
      .localSetConst("rhs", rhs)    // typed: rhs is Domain (NDVector/NDV)
      .applyUsing("add", ["rhs"])   // {x:5,y:6,z:5}
      .value("A");

    expect(out.tag).toBe("Right");
    const r = (out as any).right as NDVector;
    const c = r.toJSON();
    expect(c.x).toBe(5);
    expect(c.y).toBe(6);
    expect(c.z).toBe(5);
  });

  it("typed pick/withKeys roundtrip", () => {
    const v = NDV.fromExact<"x" | "y" | "z">({ x: 10, y: 20, z: 0 });
    const p = v.pickT(["x", "z"] as const);        // NDV<'x'|'z'>
    const w = p.withKeysT(["y"] as const);         // NDV<'x'|'z'|'y'>
    expect(w.get("y")).toBe(0);
  });
});
