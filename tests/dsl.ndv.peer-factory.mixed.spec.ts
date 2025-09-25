import { describe, it, expect } from "vitest";
import { NDVector } from "../math/vector/ndvector";
import { NDVectorAdapter } from "../dsl/adapters/ndvector.domain";
import { mapChain } from "../dsl/chain/base.chain";
import { prop, oCompose } from "../dsl/optics";

describe("NDV mixed-peers factory", () => {
  const A = { base: new NDVector({}) };
  const B1 = { p: { x: 1, z: 7 } };
  const B2 = { p: { y: 2 } };

  it("localSetNDVFromPeers: combine fields from B1 and B2", () => {
    // lenses for p.x/y/z
    const Lp = prop<any,"p">("p");
    const Lx = oCompose(Lp, prop<any,"x">("x"));
    const Ly = oCompose(Lp, prop<any,"y">("y"));
    const Lz = oCompose(Lp, prop<any,"z">("z"));

    const out = mapChain<any, NDVector>(NDVectorAdapter, { A, B1, B2 })
      .prop("base")
      .localSetNDVFromPeers("pos", {
        x: { peer: "B1", lens: Lx },
        y: { peer: "B2", lens: Ly },
        z: { peer: "B1", lens: Lz },
      })
      .applyUsing("add", ["pos"]) // {} + {x:1, y:2, z:7}
      .value("A");

    expect(out.tag).toBe("Right");
    const v = (out as any).right as NDVector;
    expect(v.toJSON()).toEqual({ x: 1, y: 2, z: 7 });
  });
});
