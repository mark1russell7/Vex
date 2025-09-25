import { describe, it, expect } from "vitest";
import { TBBox } from "../monads/tbbox";
import { TBAdapter } from "../dsl/adapters/tbbox.domain";
import { mapChain } from "../dsl/chain/base.chain";
import { ValueKind } from "../dsl/value.enum";

describe("TBBox adapter", () => {
  const A = { t: TBBox.top(3) };

  it("map over TBBox via DSL", () => {
    const out = mapChain<typeof A, TBBox<number>>(TBAdapter, { A })
      .prop("t")
      .localSetConst("f", (x: number) => x * 2)
      .applyUsing("map", ["f"])
      .value("A");

    expect(out.tag).toBe("Right");
    const t = (out as any).right as TBBox<number>;
    expect(t.isTop()).toBe(true);
    expect(t.valueOr(0)).toBe(6);
  });

  it("chain to Bottom via DSL", () => {
    const out = mapChain<typeof A, TBBox<number>>(TBAdapter, { A })
      .prop("t")
      .localSetConst("f", (_x: number) => TBBox.bottom<number>())
      .applyUsing("chain", ["f"])
      .value("A");

    expect(out.tag).toBe("Right");
    const t = (out as any).right as TBBox<number>;
    expect(t.isBottom()).toBe(true);
  });
});
