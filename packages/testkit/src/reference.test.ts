/**
 * The reference interpreter against the core interpreter, one program for each rule of the semantics. The
 * property tests use random programs. These programs reach the rare paths: each kind of error, each special form,
 * each list op and each step of an op call.
 */
import {
  app,
  axes,
  defineDomain,
  each,
  evaluate,
  ext,
  index,
  key,
  let_,
  lit,
  offset,
  other,
  parent,
  rec,
  ref,
  space,
  v,
  type AnyDomain,
  type Expr,
  type Space,
} from "@mark1russell7/vex";
import { BoolDomain, NumDomain, Vec2, Vec2Domain } from "@mark1russell7/vex-domains";
import { describe, expect, it } from "vitest";
import { fromCore, fromReference } from "./compare.ts";
import { referenceEvaluate } from "./reference.ts";

class Thing {
  readonly n: number;
  constructor(n: number) {
    this.n = n;
  }
  twice(): Thing {
    return new Thing(this.n * 2);
  }
  nothing(): undefined {
    return undefined;
  }
  explode(): never {
    throw new Error("explode");
  }
}

const AllMethods = defineDomain({ name: "Thing", is: (u: unknown): u is Thing => u instanceof Thing, ops: {}, methods: "all" });
const Lifty = defineDomain({
  name: "Lifty",
  is: (u: unknown): u is Vec2 => u instanceof Vec2,
  fromScalar: (): Vec2 => {
    throw new Error("no lift");
  },
  ops: { add: { liftScalar: [true] } },
});
const Fussy = defineDomain({
  name: "Fussy",
  is: (u: unknown): u is Vec2 => u instanceof Vec2,
  valid: (): boolean => {
    throw new Error("no check");
  },
  ops: { add: {} },
});
const Nan = defineDomain({ name: "Nan", is: (u: unknown): u is number => typeof u === "number", ops: { nan: { fn: (): number => Number.NaN } } });
const Throws = defineDomain({
  name: "Throws",
  is: (_u: unknown): _u is Vec2 => {
    throw new Error("is");
  },
  ops: {},
});

const throwing = {
  get boom(): number {
    throw new Error("getter");
  },
};

const s = space.record({
  A: { p: new Vec2(1, 2), q: new Vec2(3, 4), n: 2, b: true, name: "a", deep: { x: 1 }, bad: throwing, t: new Thing(3) },
  B: { p: new Vec2(5, 6), q: new Vec2(0, 0), n: 3, b: false, name: "b", deep: { x: null }, t: new Thing(4) },
  C: { p: new Vec2(7, 8), n: 5, b: true, name: "c", deep: 7 },
  N: null,
});
const row = space.array([{ v: 1 }, { v: 2 }]);
const tree = space.tree({ top: { n: 1 }, leaf: { n: 2 } }, { leaf: "top" });

const D: readonly AnyDomain[] = [Vec2Domain, NumDomain, BoolDomain];
const ps = each(axes.all, ref("p"));
const ns = each(axes.all, ref("n"));
const bs = each(axes.all, ref("b"));
const nothing = each(axes.where(axes.all, lit(false)), ref("n"));

interface Case {
  readonly name: string;
  readonly expr: Expr;
  readonly space?: Space;
  readonly origin?: string;
  readonly domains?: readonly AnyDomain[];
}

const CASES: readonly Case[] = [
  // References and addresses
  { name: "an origin that is not a key", expr: ref("p"), origin: "Z" },
  { name: "a field", expr: ref("p") },
  { name: "the whole record", expr: ref([]) },
  { name: "a null record", expr: ref("p"), origin: "N" },
  { name: "a missing field", expr: ref("mass") },
  { name: "a null field in a path", expr: ref("deep.x"), origin: "B" },
  { name: "a path through a number", expr: ref("deep.x"), origin: "C" },
  { name: "a prototype name in a path", expr: ref("deep.__proto__") },
  { name: "a getter that throws", expr: ref("bad.boom") },
  { name: "a key move", expr: ref("p", [key("B")]) },
  { name: "an unknown key", expr: ref("p", [key("Z")]) },
  { name: "other outside a pair", expr: ref("p", [other]) },
  { name: "an index", expr: ref("p", [index(2)]) },
  { name: "an index outside the keys", expr: ref("p", [index(9)]) },
  { name: "an offset in a record space", expr: ref("p", [offset(1)]) },
  { name: "an offset in an array", expr: ref("v", [offset(1)]), space: row, origin: "0" },
  { name: "an offset outside an array", expr: ref("v", [offset(-1)]), space: row, origin: "0" },
  { name: "parent in a tree", expr: ref("n", [parent]), space: tree, origin: "leaf" },
  { name: "the parent of a root", expr: ref("n", [parent]), space: tree, origin: "top" },
  { name: "parent outside a tree", expr: ref("p", [parent]) },
  // Bindings, records and extensions
  { name: "an unbound name", expr: v("nope") },
  { name: "a let binding", expr: let_({ x: ref("n") }, app("add", v("x"), lit(1))) },
  { name: "a failed binding that no var reads", expr: let_({ x: ref("mass") }, lit(1)) },
  { name: "a record", expr: rec({ a: ref("n"), b: ref("name") }) },
  { name: "a record with one failed field", expr: rec({ a: ref("mass"), b: ref("n") }) },
  { name: "a record with two failed fields", expr: rec({ a: ref("mass"), b: ref("speed") }) },
  { name: "an extension without a handler", expr: ext("sheet", null) },
  // Special forms
  { name: "if true", expr: app("if", lit(true), lit(1), ref("mass")) },
  { name: "if false", expr: app("if", lit(false), ref("mass"), lit(2)) },
  { name: "if without a branch", expr: app("if", lit(true)) },
  { name: "if with a number", expr: app("if", ref("n"), lit(1), lit(2)) },
  { name: "if with a failed condition", expr: app("if", ref("mass"), lit(1), lit(2)) },
  { name: "and without arguments", expr: app("and") },
  { name: "and that stops", expr: app("and", lit(false), ref("mass")) },
  { name: "and of true values", expr: app("and", lit(true), lit(true)) },
  { name: "or that stops", expr: app("or", lit(true), ref("mass")) },
  { name: "or of false values", expr: app("or", lit(false), lit(false)) },
  { name: "or with a number", expr: app("or", lit(false), ref("n")) },
  { name: "or with a failed argument", expr: app("or", ref("mass")) },
  { name: "ifError with a value", expr: app("ifError", ref("n"), lit(0)) },
  { name: "ifError with an error", expr: app("ifError", ref("mass"), lit(0)) },
  { name: "ifError without a fallback", expr: app("ifError", ref("mass")) },
  // Axes
  { name: "each all", expr: ps },
  { name: "each others", expr: each(axes.others, ref("n")) },
  { name: "each other outside a pair", expr: each(axes.other, ref("n")) },
  { name: "neighbors outside a grid", expr: each(axes.neighbors(4), ref("n")) },
  { name: "children in a tree", expr: each(axes.children, ref("n")), space: tree, origin: "top" },
  { name: "children outside a tree", expr: each(axes.children, ref("n")) },
  { name: "where with a number test", expr: each(axes.where(axes.all, ref("n")), ref("n")) },
  { name: "where with a failed test", expr: each(axes.where(axes.all, ref("mass")), ref("n")) },
  { name: "where in where", expr: each(axes.where(axes.where(axes.all, ref("mass")), lit(true)), ref("n")) },
  { name: "where that keeps some targets", expr: each(axes.where(axes.all, ref("b")), ref("n")) },
  // List ops
  { name: "count", expr: app("count", ns) },
  { name: "values", expr: app("values", ns) },
  { name: "keys", expr: app("keys", ns) },
  { name: "errors", expr: app("errors", ns) },
  { name: "first", expr: app("first", ns) },
  { name: "first of nothing", expr: app("first", nothing) },
  { name: "sum", expr: app("sum", ns) },
  { name: "sum of vectors", expr: app("sum", ps) },
  { name: "mean", expr: app("mean", ns) },
  { name: "mean of nothing", expr: app("mean", nothing) },
  { name: "mean of vectors", expr: app("mean", ps) },
  { name: "min", expr: app("min", ns) },
  { name: "max", expr: app("max", ns) },
  { name: "min of nothing", expr: app("min", nothing) },
  { name: "max of vectors", expr: app("max", ps) },
  { name: "any", expr: app("any", bs) },
  { name: "all", expr: app("all", bs) },
  { name: "none", expr: app("none", bs) },
  { name: "any of numbers", expr: app("any", ns) },
  { name: "a strict sum with an error item", expr: app("sum", ns, lit({ strict: true })) },
  { name: "a strict sum without an error item", expr: app("sum", each(axes.where(axes.all, ref("b")), ref("n")), lit({ strict: true })) },
  { name: "reduce with add", expr: app("reduce", ps, lit("add")) },
  { name: "reduce with a number as the op", expr: app("reduce", ps, lit(1)) },
  { name: "reduce of nothing with an identity", expr: app("reduce", each(axes.where(axes.all, lit(false)), ref("p")), lit("add")) },
  { name: "reduce of nothing without an identity", expr: app("reduce", nothing, lit("subtract")) },
  { name: "reduce with an op that the values do not have", expr: app("reduce", each(axes.where(axes.all, lit(true)), ref("name")), lit("add")) },
  { name: "reduce with a strict option", expr: app("reduce", ps, lit("add"), lit({ strict: true })) },
  { name: "a list op that is not a list op", expr: app("shuffle", ns) },
  // Op calls
  { name: "an op of a domain", expr: app("add", ref("p"), ref("q")) },
  { name: "a lifted number", expr: app("add", ref("p"), lit(1)) },
  { name: "an op that the domain does not have", expr: app("fly", ref("p")) },
  { name: "a function without arguments", expr: app("nothing") },
  { name: "a receiver that no domain accepts", expr: app("shout", ref("name")) },
  { name: "a domain argument of another kind", expr: app("add", ref("p"), ref("name")) },
  { name: "a number argument of another kind", expr: app("scale", ref("p"), ref("name")) },
  { name: "a number argument", expr: app("scale", ref("p"), lit(2)) },
  { name: "more arguments than parameters", expr: app("scale", ref("p"), lit(2), lit("extra")) },
  { name: "a division by zero", expr: app("divide", ref("n"), lit(0)) },
  { name: "an invalid domain value", expr: app("divide", ref("p"), lit(0)) },
  { name: "a method of a methods-all domain", expr: app("twice", ref("t")), domains: [AllMethods] },
  { name: "a method that gives no value", expr: app("nothing", ref("t")), domains: [AllMethods] },
  { name: "an inherited name of a methods-all domain", expr: app("toString", ref("t")), domains: [AllMethods] },
  { name: "a lift that throws", expr: app("add", ref("p"), lit(1)), domains: [Lifty] },
  { name: "a valid check that throws", expr: app("add", ref("p"), ref("q")), domains: [Fussy] },
  { name: "an op that gives NaN", expr: app("nan", ref("n")), domains: [Nan] },
  { name: "a domain whose is test throws", expr: app("add", ref("p"), ref("q")), domains: [Throws, Vec2Domain] },
  { name: "an argument that no domain accepts", expr: app("add", lit(new Vec2(1, 1)), lit(throwing)) },
  { name: "a method that throws", expr: app("explode", ref("t")), domains: [AllMethods] },
  { name: "reduce with a method of a methods-all domain", expr: app("reduce", each(axes.all, ref("t")), lit("twice")), domains: [AllMethods] },
  { name: "reduce with a name that is not a method", expr: app("reduce", each(axes.all, ref("t")), lit("nope")), domains: [AllMethods] },
  { name: "reduce with a method that throws", expr: app("reduce", each(axes.all, ref("t")), lit("explode")), domains: [AllMethods] },
  {
    name: "a host space that throws",
    expr: ref("p"),
    space: {
      kind: "record",
      keys: ["A"],
      has: (k: string): k is string => k === "A",
      get: () => {
        throw new Error("disk");
      },
      coords: () => undefined,
      keyAt: () => undefined,
    },
  },
];

describe("the reference interpreter against the core (EVAL.REFERENCE)", () => {
  it.each(CASES)("EVAL.REFERENCE: $name", (c) => {
    const opts = { space: c.space ?? s, origin: c.origin ?? "A", domains: c.domains ?? D };
    expect(fromReference(referenceEvaluate(c.expr, opts))).toEqual(fromCore(evaluate(c.expr, opts)));
  });

  it("EVAL.REFERENCE: without domains, an op call gives the error of a receiver that no domain accepts", () => {
    expect(referenceEvaluate(app("add", lit(1), lit(2)), { space: s, origin: "A" })).toEqual({ ok: false, code: "#VALUE!" });
  });

  it("the comparison reads accessors as a mark, an error as its code, and arrays item by item", () => {
    expect(fromReference({ ok: true, value: [throwing, { code: "#N/A", kind: "missing-field", message: "x" }] })).toEqual({
      ok: true,
      value: [{ boom: "<accessor>" }, { code: "#N/A" }],
    });
    expect(fromReference({ ok: true, value: new Vec2(1, 2) })).toEqual({ ok: true, value: new Vec2(1, 2) });
    expect(fromReference({ ok: false, code: "#REF!" })).toEqual({ ok: false, code: "#REF!" });
  });
});
