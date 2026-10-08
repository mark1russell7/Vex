import { describe, expect, expectTypeOf, it } from "vitest";
import { vex } from "./builder.ts";
import { defineDomain } from "./domain.ts";
import { evaluate } from "./evaluate.ts";
import { ok } from "./result.ts";
import { isSome, type Optional, type Result } from "./result.ts";
import { space } from "./space.ts";
import { error, Pt, PtDomain, value } from "./test-support.ts";

type Box = { readonly position: Pt; readonly size: Pt; readonly name: string; readonly weight: number };
const box = (x: number, y: number, w: number, h: number, name: string, weight = 1): Box => ({
  position: new Pt(x, y),
  size: new Pt(w, h),
  name,
  weight,
});
const A = box(0, 0, 2, 2, "a", 2);
const B = box(3, 4, 1, 1, "b", 3);
const C = box(6, 8, 1, 1, "c", 5);
const D = box(0, 1, 1, 1, "d", 7);

const Num = defineDomain({
  name: "Num",
  is: (u: unknown): u is number => typeof u === "number",
  ops: {
    plus: { fn: (a: number, b: number): number => a + b, laws: ["commutative", "associative"], identity: () => 0 },
    times: { fn: (a: number, b: number): number => a * b },
    gt: { fn: (a: number, b: number): boolean => a > b },
  },
});

const cell = (alive: boolean): { readonly alive: boolean } => ({ alive });

const optionalValue = <T>(o: Optional<T>): T => {
  if (!isSome(o)) throw new Error("expected some");
  return o.value;
};

describe("the typed builder", () => {
  const pair = vex(PtDomain).over(space.record({ A, B }));
  const four = vex(PtDomain, Num).over(space.record({ A, B, C, D }));

  it("EXAMPLE.SEPARATION: the separation test, with other()", () => {
    const sep = pair.from("position")._.add("size").other()._.subtract("position")._.anyNonPositive();
    expectTypeOf(sep.at("A")).toEqualTypeOf<Optional<boolean>>();
    expect(sep.at("A")).toEqual({ tag: "some", value: true });
    expect(optionalValue(sep.all().any())).toBe(true);
    expect(sep.all().values()).toEqual([true, false]);
  });

  it("EXAMPLE.NEAREST: the minimum distance to the others (V-001, V-042)", () => {
    const minDist = four.from("position").others((e) => e._.subtract("position")._.length()).min();
    expectTypeOf(minDist.result("A")).toEqualTypeOf<Result<number>>();
    expect(value(minDist.result("A"))).toBe(1);
    expect(value(minDist.result("B"))).toBeCloseTo(Math.sqrt(18), 12);
  });

  it("EXAMPLE.OFFSETS: reduce the offsets to the others with add", () => {
    const three = vex(PtDomain).over(space.record({ A, B, C }));
    const sum = three.from("position").others((e) => e._.subtract("position")).reduce("add");
    expect(value(sum.result("A"))).toEqual(new Pt(-9, -12));
  });

  it("V-040: origin() goes back to the start after other()", () => {
    const c = pair.from("position").other().origin()._.add("size");
    expect(value(c.result("A"))).toEqual(new Pt(2, 2));
  });

  it("V-004: an unknown key gives #REF!, not a value of another record", () => {
    const loose = vex(PtDomain).over(space.record<Record<string, Box>>({ A, B }));
    expect(error(loose.from("position").to("NO_SUCH_KEY")._.add("size").result("A")).code).toBe("#REF!");
  });

  it("V-005: other() outside a pair gives #REF! at run time", () => {
    const loose = vex(PtDomain).over(space.record<Record<string, Box>>({ A, B, C }));
    expect(error(loose.from("position")._.add("size").other()._.subtract("position").result("A")).code).toBe("#REF!");
  });

  it("BUILD.IMMUTABLE: a later call does not change an earlier chain (V-010)", () => {
    const base = pair.from("position");
    const added = base._.add("size");
    expect(value(base.result("A"))).toEqual(new Pt(0, 0));
    expect(value(added.result("A"))).toEqual(new Pt(2, 2));
    expect(base.program).toEqual({ tag: "ref", path: ["position"] });
  });

  it("V-038: string and array values pass as literals, bare strings are field references", () => {
    const c = pair.from("position")._.pick(pair.lit(["x", "q"]));
    expect(value(c.result("A"))).toEqual(["x"]);
  });

  it("V-039 and V-041: the ops section does not record then, build or symbols", () => {
    const ops = pair.from("position")._ as unknown as Record<string, unknown>;
    expect(ops["then"]).toBeUndefined();
    expect(ops["toJSON"]).toBeUndefined();
    expect(typeof ops["build"]).toBe("function");
  });

  it("V-041: a chain is not a thenable, so await gives the chain itself", async () => {
    const c = pair.from("position");
    const awaited: unknown = await Promise.resolve(c);
    expect(awaited).toBe(c);
  });

  it("absolute references with of(), and lifting with a number", () => {
    expect(value(pair.from("position")._.add(pair.of("B", "size")).result("A"))).toEqual(new Pt(1, 1));
    expect(value(pair.from("position")._.add(5).result("A"))).toEqual(new Pt(5, 5));
  });

  it("multi-domain chains: the value moves from Pt to number, and Num gives the ops", () => {
    const c = four.from("position")._.length()._.times(2)._.plus("weight");
    expectTypeOf(c.result("B")).toEqualTypeOf<Result<number>>();
    expect(value(c.result("B"))).toBe(13);
  });

  it("with(): typed variables in a lexical scope", () => {
    const c = four.from("position").with({ rhs: four.of("B", "position"), k: 2 }, (chain, { rhs, k }) => chain._.subtract(rhs)._.scale(k));
    expect(value(c.result("A"))).toEqual(new Pt(-6, -8));
  });

  it("fork(): a record of branches over the same value", () => {
    const c = four.from("position").fork({ len: (b) => b._.length(), far: (b) => b._.add("size") });
    expectTypeOf(c.result("B")).toEqualTypeOf<Result<{ readonly len: number; readonly far: Pt }>>();
    expect(value(c.result("B"))).toEqual({ len: 5, far: new Pt(4, 5) });
  });

  it("ifError(): a fallback for an error value", () => {
    const loose = vex(PtDomain).over(space.record<Record<string, Partial<Box>>>({ A, X: { name: "x" } }));
    const c = loose.from("position")._.length().ifError(-1);
    expect(c.all().values()).toEqual([0, -1]);
  });

  it("the start axis: all() gives a traversal with lenient and strict reductions", () => {
    const loose = vex(PtDomain).over(space.record<Record<string, Partial<Box>>>({ A, B, X: { name: "x" } }));
    const lengths = loose.from("position")._.length().all();
    expect(optionalValue(lengths.sum())).toBe(5);
    expect(lengths.strict().sum()).toEqual({ tag: "none" });
    expect(lengths.errors()).toHaveLength(1);
    expect(lengths.map((n) => n * 2).values()).toEqual([0, 10]);
  });

  it("the program is plain data, and evaluate gives the same result", () => {
    const c = pair.from("position")._.add("size");
    expect(JSON.parse(JSON.stringify(c.program))).toEqual(c.program);
    expect(evaluate(c.program, { space: pair.space, origin: "A", domains: [PtDomain] })).toEqual(c.result("A"));
  });

  it("neighbors(): the live neighbors of a cell", () => {
    const g = vex(Num).over(space.grid([[cell(false), cell(true), cell(false)], [cell(false), cell(true), cell(false)]]));
    const live = g.start(0).neighbors(8, (n) => n.from("alive"), { where: (n) => n.from("alive") }).count();
    expect(value(live.result("0,0"))).toBe(2);
    expect(value(live.result("1,1"))).toBe(1);
    expect(value(live.result("0,2"))).toBe(2);
  });
});

describe("the types of the builder (TYPE.*)", () => {
  const pair = vex(PtDomain).over(space.record({ A, B }));
  const three = vex(PtDomain).over(space.record({ A, B, C }));

  it("TYPE.FROM: from() accepts the fields of the record and gives their type", () => {
    expectTypeOf(pair.from("position").at("A")).toEqualTypeOf<Optional<Pt>>();
    expectTypeOf(pair.from("weight").at("A")).toEqualTypeOf<Optional<number>>();
    // @ts-expect-error -- the record has no field "nope"
    pair.from("nope");
  });

  it("TYPE.OPS: ._ lists only the declared ops, with their parameter types", () => {
    expectTypeOf(pair.from("position")._).toHaveProperty("add");
    expectTypeOf(pair.from("position")._).not.toHaveProperty("toString");
    // @ts-expect-error -- "nope" is not an op of Pt
    pair.from("position")._.nope();
    // @ts-expect-error -- "name" is a string field, not a Pt field
    pair.from("position")._.add("name");
    // @ts-expect-error -- scale needs a number, and "size" is a Pt field
    pair.from("position")._.scale("size");
    // @ts-expect-error -- "C" is not a key of the space
    pair.from("position")._.add(pair.of("C", "size"));
  });

  it("TYPE.LIFT: a number argument needs liftScalar on the op", () => {
    expectTypeOf(pair.from("position")._.add(5).at("A")).toEqualTypeOf<Optional<Pt>>();
    // @ts-expect-error -- dot does not declare liftScalar
    pair.from("position")._.dot(5);
  });

  it("TYPE.STATE: after a non-domain value, ._ is gone", () => {
    expectTypeOf(pair.from("position")._.length().at("A")).toEqualTypeOf<Optional<number>>();
    // @ts-expect-error -- length() gives a number, and no domain of this chain accepts numbers
    pair.from("position")._.length()._.add("size");
  });

  it("TYPE.OTHER: other() exists only on a space with two keys", () => {
    expectTypeOf(pair.from("position").other().at("A")).toEqualTypeOf<Optional<Pt>>();
    // @ts-expect-error -- a space with three keys is not a pair
    three.from("position").other();
  });

  it("TYPE.KEYS: evaluation accepts only the keys of the space", () => {
    expectTypeOf<Parameters<typeof pair.from<"position">>[0]>().toEqualTypeOf<"position">();
    expectTypeOf<Parameters<ReturnType<typeof pair.from<"position">>["at"]>[0]>().toEqualTypeOf<"A" | "B">();
    // @ts-expect-error -- "Z" is not a key
    pair.from("position").at("Z");
  });

  it("TYPE.LIST: number reductions need a list of numbers", () => {
    expectTypeOf(three.from("position").others((e) => e._.length()).min().at("A")).toEqualTypeOf<Optional<number>>();
    // @ts-expect-error -- min needs numbers, and the body gives Pt values
    three.from("position").others((e) => e._.add("size")).min();
  });

  it("TYPE.NO-ANY: no value type is any (V-012)", () => {
    expectTypeOf(pair.from("position")._.add("size").at("A")).not.toBeAny();
    expectTypeOf(pair.from("position")._.add("size").at("A")).toEqualTypeOf<Optional<Pt>>();
  });
});

describe("the other members of the builder", () => {
  const four = vex(PtDomain, Num).over(space.record({ A, B, C, D }));
  const weights = four.start(0).each((t) => t.from("weight"));

  it("value() and explain() evaluate at a key", () => {
    const c = four.from("weight");
    expect(optionalValue(c.value("B"))).toBe(3);
    expect(c.explain("B").events.map((e) => e.label)).toEqual(["weight"]);
  });

  it("index() and offset() move the address of the later references", () => {
    expect(optionalValue(four.start(0).index(2).from("weight").at("A"))).toBe(5);
    const row = vex(Num).over(space.array([{ n: 1 }, { n: 2 }, { n: 4 }]));
    expect(row.start(0).offset(1).from("n").all().values()).toEqual([2, 4]);
  });

  it("each() and the reductions of a list chain", () => {
    expect(weights.program.tag).toBe("let");
    expect(optionalValue(weights.sum().at("A"))).toBe(17);
    expect(optionalValue(weights.mean().at("A"))).toBe(4.25);
    expect(optionalValue(weights.max().at("A"))).toBe(7);
    expect(optionalValue(weights.values().at("A"))).toEqual([2, 3, 5, 7]);
    expect(optionalValue(weights.first().at("A"))).toBe(2);
    expect(optionalValue(weights.reduce("plus", { strict: true }).at("A"))).toBe(17);
    const flags = four.start(0).each((t) => t.from("position")._.anyNonPositive());
    expect(optionalValue(flags.any().at("A"))).toBe(true);
    expect(optionalValue(flags.all().at("A"))).toBe(false);
    expect(optionalValue(flags.none().at("A"))).toBe(false);
  });

  it("LIST.LENIENT: a list chain reduction is lenient by default, and strict with { strict: true }", () => {
    const loose = vex(PtDomain, Num).over(space.record<Record<string, Partial<Box>>>({ A, B, X: { name: "x" } }));
    const looseWeights = loose.start(0).each((t) => t.from("weight"));
    expect(optionalValue(looseWeights.max().at("A"))).toBe(3);
    expect(looseWeights.max({ strict: true }).at("A")).toEqual({ tag: "none" });
    expect(error(looseWeights.sum({ strict: true }).result("A")).code).toBe("#N/A");
    expect(error(looseWeights.values({ strict: true }).result("A")).code).toBe("#N/A");
    expect(optionalValue(looseWeights.count().at("A"))).toBe(2);
  });

  it("arguments: a list chain, null and a nested record are values of the program", () => {
    const r = four.start(four.rec({ list: weights, none: null, inner: four.rec({ w: "weight" }) })).result("A");
    const v = value(r) as { readonly list: unknown; readonly none: unknown; readonly inner: { readonly w: number } };
    expect(v.none).toBeNull();
    expect(v.inner.w).toBe(2);
    expect((v.list as { readonly items: readonly unknown[] }).items).toHaveLength(4);
    expect(value(four.start(null).result("A"))).toBeNull();
  });

  it("withOptions() gives the free functions and the extension handlers to the interpreter", () => {
    const root = vex(Num)
      .withOptions({ fns: { half: (n: unknown) => Number(n) / 2 }, extensions: { seven: () => ok(7) } })
      .over(space.record({ A }));
    // A free function has no type in the chain, so the test calls it through the untyped proxy.
    const untyped = root.from("weight")._ as unknown as Readonly<Record<string, () => { result(k: "A"): Result<unknown> }>>;
    expect(untyped["half"]?.().result("A")).toEqual(ok(1));
  });
});
