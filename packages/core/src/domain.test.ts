import { describe, expect, it } from "vitest";
import { defineDomain, findMethod, resolveOp, type OpTable } from "./domain.ts";

class Thing {
  readonly n: number;
  constructor(n: number) {
    this.n = n;
  }
  twice(): Thing {
    return new Thing(this.n * 2);
  }
}

describe("domains (DOMAIN.*)", () => {
  it("DOMAIN.OWNED: defineDomain does not change the class, and the domain is frozen (V-003)", () => {
    const names = Object.getOwnPropertyNames(Thing.prototype);
    const symbols = Object.getOwnPropertySymbols(Thing.prototype);
    const d = defineDomain<"Thing", Thing, OpTable<Thing, "twice">>({
      name: "Thing",
      is: (u: unknown): u is Thing => u instanceof Thing,
      ops: { twice: { laws: [] } },
    });
    expect(Object.getOwnPropertyNames(Thing.prototype)).toEqual(names);
    expect(Object.getOwnPropertySymbols(Thing.prototype)).toEqual(symbols);
    expect(Object.isFrozen(d)).toBe(true);
    expect(resolveOp(d, new Thing(2), "twice")?.call([])).toEqual(new Thing(4));
  });

  it("DOMAIN.OWNED: methods: all makes each method an op, but not inherited members (V-008)", () => {
    const d = defineDomain<"Thing", Thing, Readonly<Record<string, never>>>({
      name: "Thing",
      is: (u: unknown): u is Thing => u instanceof Thing,
      ops: {},
      methods: "all",
    });
    expect(resolveOp(d, new Thing(1), "twice")).toBeDefined();
    expect(resolveOp(d, new Thing(1), "toString")).toBeUndefined();
    expect(resolveOp(d, new Thing(1), "constructor")).toBeUndefined();
    expect(findMethod(new Thing(1), "n")).toBeUndefined();
  });
});
