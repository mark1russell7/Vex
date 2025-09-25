import { describe, it, expect } from "vitest";
import { NDVector } from "../math/vector/ndvector";
import { NDVectorAdapter } from "../dsl/adapters/ndvector.domain";
import { mapChain } from "../dsl/chain/base.chain";
import { prop, oCompose } from "../dsl/optics"; // optics

describe("NDV peer factory from Biblo", () => {
  const A = { base: new NDVector({}) };
  const Biblo = { pos: { x: 10, y: 20, z: 0 } };

  it("localSetNDVFromPeer: collect fields from Biblo.pos.* and add", () => {
    // Lenses to Biblo.pos.x/y/z on the peer root
    const Lpos = prop<any,"pos">("pos");
    const Lx = oCompose(Lpos, prop<any,"x">("x"));
    const Ly = oCompose(Lpos, prop<any,"y">("y"));
    const Lz = oCompose(Lpos, prop<any,"z">("z"));

    const out = mapChain<any, NDVector>(NDVectorAdapter, { A, Biblo }) // <-- 'any' to avoid Obj mismatch
      .prop("base")                                                       // {}
      .localSetNDVFromPeer("pos", "Biblo", { x: Lx, y: Ly, z: Lz })       // ← from Biblo.pos.*
      .applyUsing("add", ["pos"])                                         // {} + pos => {x:10,y:20,z:0}
      .value("A");

    expect(out.tag).toBe("Right");
    const v = (out as any).right as NDVector;
    expect(v.toJSON()).toEqual({ x: 10, y: 20, z: 0 });
  });
});
