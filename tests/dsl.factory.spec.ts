import { describe, it, expect } from "vitest";
import { Factory } from "../math/factory/factory";
import { FactoryAdapter } from "../dsl/adapters/factory.domain";
import { mapChain } from "../dsl/chain/base.chain";

describe("Factory adapter", () => {
  const add = new Factory((x: number, y: number) => x + y);
  const A = { f: add };

  it("invoke with local args", () => {
    const out = mapChain<typeof A, Factory>(FactoryAdapter, { A })
      .prop("f")
      .localSetConst("x", 7)
      .localSetConst("y", 5)
      .applyUsing("invoke", ["x", "y"])
      .value("A");

    expect(out.tag).toBe("Right");
    expect((out as any).right).toBe(12);
  });
});
