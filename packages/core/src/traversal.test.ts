import { describe, expect, it } from "vitest";
import { vexError } from "./errors.ts";
import { fail, getOr, ok, type Optional } from "./result.ts";
import { Pt, PtDomain } from "./test-support.ts";
import { monoids, traversal, type TraversalItem } from "./traversal.ts";

const env = { domains: [PtDomain] };
const bad = fail(vexError("missing-field", "no value"));

const items = <T>(...results: readonly [string, T | "error"][]): readonly TraversalItem<string, T>[] =>
  results.map(([key, x]) => ({ key, result: x === "error" ? bad : ok(x) }));

const some = <T>(o: Optional<T>): T | "none" => getOr(o, "none" as const);

describe("traversals", () => {
  it("get, values, keys and errors split the items by their result", () => {
    const t = traversal(items<number>(["A", 1], ["B", "error"], ["C", 3]), env);
    expect(some(t.get("A"))).toBe(1);
    expect(some(t.get("B"))).toBe("none");
    expect(some(t.get("Z"))).toBe("none");
    expect(t.values()).toEqual([1, 3]);
    expect(t.keys()).toEqual(["A", "C"]);
    expect(t.errors().map((e) => e.code)).toEqual(["#N/A"]);
  });

  it("the number reductions skip error items, and strict() gives the first error", () => {
    const t = traversal(items<number>(["A", 1], ["B", "error"], ["C", 3]), env);
    expect(some(t.count())).toBe(2);
    expect(some(t.sum())).toBe(4);
    expect(some(t.mean())).toBe(2);
    expect(some(t.min())).toBe(1);
    expect(some(t.max())).toBe(3);
    expect(some(t.strict().sum())).toBe("none");
    const r = t.strict().reduceResult("max");
    expect(r.ok ? r.value : r.error.code).toBe("#N/A");
  });

  it("the boolean reductions", () => {
    const t = traversal(items<boolean>(["A", true], ["B", false]), env);
    expect(some(t.any())).toBe(true);
    expect(some(t.all())).toBe(false);
    expect(some(t.none())).toBe(false);
  });

  it("reduce folds with a domain op, and strict reduce keeps the op argument", () => {
    const t = traversal(items<Pt>(["A", new Pt(1, 2)], ["B", new Pt(3, 4)], ["C", "error"]), env);
    expect(some(t.reduce("add"))).toEqual(new Pt(4, 6));
    expect(some(t.strict().reduce("add"))).toBe("none");
    expect(t.reduceResult("reduce", "add")).toEqual(ok(new Pt(4, 6)));
  });

  it("map keeps error items, and an exception in f gives #CALC! for that item", () => {
    const t = traversal(items<number>(["A", 1], ["B", "error"], ["C", 3]), env);
    const m = t.map((n, k) => {
      if (k === "C") throw new Error("no");
      return n * 10;
    });
    expect(m.values()).toEqual([10]);
    expect(m.errors().map((e) => e.code)).toEqual(["#N/A", "#CALC!"]);
    expect(t.strict().map((n) => n).strict().count()).toEqual({ tag: "none" });
  });

  it("fold uses a monoid over the values", () => {
    const n = traversal(items<number>(["A", 2], ["B", 3], ["C", "error"]), env);
    expect(n.fold(monoids.sum, (x) => x)).toBe(5);
    expect(n.fold(monoids.product, (x) => x)).toBe(6);
    const b = traversal(items<boolean>(["A", true], ["B", false]), env);
    expect(b.fold(monoids.all, (x) => x)).toBe(false);
    expect(b.fold(monoids.any, (x) => x)).toBe(true);
    expect(traversal(items<boolean>(), env).fold(monoids.all, (x) => x)).toBe(true);
  });

  it("a traversal keeps the free functions of the options, and reduce needs a domain op", () => {
    const t = traversal(items<number>(["A", 2], ["B", 5]), { domains: [], options: { fns: { larger: (a: unknown, b: unknown) => Math.max(Number(a), Number(b)) } } });
    expect(some(t.max())).toBe(5);
    expect(some(t.reduce("larger"))).toBe("none");
  });
});
