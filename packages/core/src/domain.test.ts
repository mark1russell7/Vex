import { describe, expect, it } from "vitest";
import { defineDomain, domainOf, findMethod, liftsAt, resolveOp, type OpTable } from "./domain.ts";

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

describe("the edges of op lookup", () => {
  it("findMethod gives nothing for values without methods and for prototype names", () => {
    expect(findMethod(null, "twice")).toBeUndefined();
    expect(findMethod(undefined, "twice")).toBeUndefined();
    expect(findMethod(3, "toFixed")).toBeUndefined();
    expect(findMethod(new Thing(1), "__proto__")).toBeUndefined();
    expect(findMethod(new Thing(1), "")).toBeUndefined();
    expect(findMethod(new Thing(1), "twice")).toBeTypeOf("function");
  });

  it("domainOf gives the first domain that accepts a value, and liftsAt reads a flag list", () => {
    const d = defineDomain({ name: "Thing", is: (u: unknown): u is Thing => u instanceof Thing, ops: {} });
    expect(domainOf([d], new Thing(1))).toBe(d);
    expect(domainOf([d], 1)).toBeUndefined();
    expect(liftsAt(true, 3)).toBe(true);
    expect(liftsAt([false, true], 1)).toBe(true);
    expect(liftsAt([false, true], 0)).toBe(false);
    expect(liftsAt(undefined, 0)).toBe(false);
  });
});
