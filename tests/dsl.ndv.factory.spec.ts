import { describe, it, expect } from "vitest";
import { NDVector } from "../math/vector/ndvector";
import { NDVectorAdapter } from "../dsl/adapters/ndvector.domain";
import { vectorMapChain } from "../dsl/adapters/vector.domain";
import { mapChain } from "../dsl/chain/base.chain";
import { P } from "../dsl/optics.biblo"; // path helper, but any OLens works

// You can also import { prop } from "../dsl/optics" and build your own lenses.

describe("NDV factory from optics (localSetNDV)", () => {
  const A = { px: 1, py: 2, pz: 3, base: new NDVector({}) };  // object with numeric fields
  const Biblo = {}; // unused here, just to show peers would also work

  it("collect focus fields into an NDVector and add to base", () => {
    const out = mapChain<typeof A, NDVector>(NDVectorAdapter, { A })
      .prop("base")                                               // start from {}
      .localSetNDV("pos", { x: P("px"), y: P("py"), z: P("pz") }) // NDV{x:1,y:2,z:3} from focus
      .applyUsing("add", ["pos"])                                 // {} + pos => {x:1,y:2,z:3}
      .value("A");

    expect(out.tag).toBe("Right");
    const v = (out as any).right as NDVector;
    expect(v.toJSON()).toEqual({ x: 1, y: 2, z: 3 });
  });
});
