/**
 * The error catalog: a golden file with one program for each place in the interpreter that makes an error. For
 * each program, the file has the full error (code, kind, message, path, origin, focus, op and causes) and the
 * trace with its reads. A change of an error message or of an error detail thus shows as a diff in review.
 */
import { describe, expect, it } from "vitest";
import { defineDomain } from "./domain.ts";
import type { VexError } from "./errors.ts";
import { explain, formatTrace, type EvalOptions } from "./evaluate.ts";
import { app, axes, each, ext, index, key, let_, lit, offset, other, parent, rec, ref, v, type Expr } from "./ir.ts";
import { fail, type Result } from "./result.ts";
import { space } from "./space.ts";
import { vexError } from "./errors.ts";
import { Pt, PtDomain } from "./test-support.ts";

const Num = defineDomain({
  name: "Num",
  is: (u: unknown): u is number => typeof u === "number",
  ops: {
    plus: { fn: (a: number, b: number): number => a + b, params: ["number"] },
    over: { fn: (a: number, b: number): number => a / b, params: ["number"] },
    flag: { fn: (a: number, b: boolean): number => (b ? a : -a), params: ["boolean"] },
    tag: { fn: (a: number, s: string): string => `${s}${a}`, params: ["string"] },
  },
});

const Lifty = defineDomain({
  name: "Lifty",
  is: (u: unknown): u is Pt => u instanceof Pt,
  fromScalar: (): Pt => {
    throw new Error("no lift");
  },
  ops: { add: { liftScalar: [true] } },
});

const Fussy = defineDomain({
  name: "Fussy",
  is: (u: unknown): u is Pt => u instanceof Pt,
  valid: (): boolean => {
    throw new Error("no check");
  },
  ops: { add: {} },
});

const throwing = {
  get boom(): number {
    throw new Error("getter");
  },
};

const s = space.record({
  A: { position: new Pt(0, 0), size: new Pt(2, 2), weight: 2, name: "a", deep: { x: 1 }, bad: throwing },
  B: { position: new Pt(3, 4), size: new Pt(1, 1), weight: 3, name: "b", deep: { x: null } },
  C: { position: new Pt(6, 8), size: new Pt(1, 1), weight: 5, name: "c", deep: 7 },
  N: null,
});
const row = space.array([{ v: 1 }, { v: 2 }]);
const tree = space.tree({ top: { name: "t" }, leaf: { name: "l" } }, { leaf: "top" });

interface Case {
  readonly name: string;
  readonly expr: Expr;
  readonly opts?: Partial<EvalOptions>;
}

const pts = each(axes.all, ref("position"));
const nothing = each(axes.where(axes.all, lit(false)), ref("weight"));

const CASES: readonly Case[] = [
  { name: "an origin that is not a key", expr: ref("position"), opts: { origin: "Z" } },
  { name: "a record that is null", expr: ref([]), opts: { origin: "N" } },
  { name: "a missing field", expr: ref("mass") },
  { name: "a null field in a path", expr: ref("deep.x"), opts: { origin: "B" } },
  { name: "a path through a number", expr: ref("deep.x"), opts: { origin: "C" } },
  { name: "a prototype name in a path", expr: ref("deep.__proto__") },
  { name: "a getter that throws", expr: ref("bad.boom") },
  { name: "a key that is not in the space", expr: ref("position", [key("Z")]) },
  { name: "other outside a pair", expr: ref("position", [other]) },
  { name: "an index outside the keys", expr: ref("position", [index(9)]) },
  { name: "an offset in a record space", expr: ref("position", [offset(1)]) },
  { name: "an offset outside an array", expr: ref("v", [offset(-1)]), opts: { space: row, origin: "0" } },
  { name: "parent in a space that is not a tree", expr: ref("position", [parent]) },
  { name: "the parent of a root", expr: ref("name", [parent]), opts: { space: tree, origin: "top" } },
  { name: "a tree axis in a space that is not a tree", expr: each(axes.children, ref("position")) },
  { name: "an unbound name", expr: v("nope") },
  { name: "a let binding that fails, and a var that reads it", expr: let_({ x: ref("mass") }, app("add", v("x"), ref("size"))) },
  { name: "an extension without a handler", expr: ext("sheet", null) },
  { name: "an extension handler that throws", expr: ext("bad", 1), opts: { extensions: { bad: () => { throw new Error("handler"); } } } },
  { name: "an extension handler that gives an error", expr: ext("no", 1), opts: { extensions: { no: (): Result<unknown> => fail(vexError("empty", "nothing here")) } } },
  { name: "an op that the domain does not have", expr: app("fly", ref("position")) },
  { name: "a function without arguments that does not exist", expr: app("nothing") },
  { name: "a receiver that no domain accepts", expr: app("shout", ref("name")) },
  { name: "a free function that throws", expr: app("parse", ref("name")), opts: { fns: { parse: () => { throw new Error("parse"); } } } },
  { name: "a free function without a value", expr: app("nil", ref("name")), opts: { fns: { nil: () => undefined } } },
  { name: "a free function that gives NaN", expr: app("nan", ref("name")), opts: { fns: { nan: () => Number.NaN } } },
  { name: "an op that throws", expr: app("boom", ref("position")) },
  { name: "an op that gives an invalid value", expr: app("scale", ref("position"), lit(Number.POSITIVE_INFINITY)) },
  { name: "a valid check that throws", expr: app("add", ref("position"), ref("size")), opts: { domains: [Fussy] } },
  { name: "a lift that throws", expr: app("add", ref("position"), lit(1)), opts: { domains: [Lifty] } },
  { name: "a domain argument of another kind", expr: app("add", ref("position"), ref("name")) },
  { name: "a number argument of another kind", expr: app("scale", ref("position"), ref("name")) },
  { name: "a boolean argument of another kind", expr: app("flag", ref("weight"), lit(1)), opts: { domains: [Num] } },
  { name: "a string argument of another kind", expr: app("tag", ref("weight"), lit(1)), opts: { domains: [Num] } },
  { name: "a division by zero", expr: app("over", ref("weight"), lit(0)), opts: { domains: [Num] } },
  { name: "two failed arguments", expr: app("add", ref("mass"), ref("speed")) },
  { name: "two failed fields of a record", expr: rec({ m: ref("mass"), s: ref("speed"), p: ref("position") }) },
  { name: "if without a branch", expr: app("if", lit(true)) },
  { name: "if with a number condition", expr: app("if", ref("weight"), lit(1), lit(2)) },
  { name: "and without arguments", expr: app("and") },
  { name: "or with a number", expr: app("or", lit(false), ref("weight")) },
  { name: "ifError with a fallback that fails", expr: app("ifError", ref("mass"), ref("speed")) },
  { name: "neighbors in a record space", expr: each(axes.neighbors(4), ref("position")) },
  { name: "the other axis outside a pair", expr: each(axes.other, ref("position")) },
  { name: "a where test that is not a boolean", expr: app("count", each(axes.where(axes.others, ref("weight")), ref("position")), lit({ strict: true })) },
  { name: "a where test that fails", expr: app("count", each(axes.where(axes.others, ref("mass")), ref("position")), lit({ strict: true })) },
  { name: "sum of vectors", expr: app("sum", pts) },
  { name: "mean of vectors", expr: app("mean", pts) },
  { name: "max of vectors", expr: app("max", pts) },
  { name: "all of vectors", expr: app("all", pts) },
  { name: "mean of nothing", expr: app("mean", nothing) },
  { name: "min of nothing", expr: app("min", nothing) },
  { name: "first of nothing", expr: app("first", nothing) },
  { name: "a strict reduction over an error item", expr: app("sum", each(axes.all, ref("weight")), lit({ strict: true })) },
  { name: "reduce with a number as the op", expr: app("reduce", pts, lit(1)) },
  { name: "reduce with an op that the values do not have", expr: app("reduce", each(axes.where(axes.all, lit(true)), ref("name")), lit("add")) },
  { name: "reduce of nothing without an identity", expr: app("reduce", nothing, lit("subtract")) },
  { name: "reduce with an op that throws", expr: app("reduce", pts, lit("boom")) },
];

const detail = (e: VexError, indent = ""): string => {
  const thrown = e.thrown instanceof Error ? e.thrown.message : e.thrown;
  const parts = [
    `${e.code} ${e.kind}: ${e.message}`,
    `path [${e.path.join(",")}]`,
    `origin ${e.origin ?? "-"}`,
    `focus ${e.focus ?? "-"}`,
    ...(e.op === undefined ? [] : [`op ${e.op}`]),
    ...(e.thrown === undefined ? [] : [`thrown ${String(thrown)}`]),
  ];
  const causes = (e.causes ?? []).map((c) => detail(c, `${indent}  cause: `));
  return [`${indent}${parts.join(" | ")}`, ...causes].join("\n");
};

const render = (c: Case): string => {
  const trace = explain(c.expr, { space: s, origin: "A", domains: [PtDomain, Num], ...c.opts });
  const result = trace.result.ok ? `value: ${JSON.stringify(trace.result.value)}` : detail(trace.result.error);
  return [`## ${c.name}`, result, formatTrace(trace, [PtDomain]).trimEnd()].join("\n");
};

describe("the error catalog (TRACE.EVENTS)", () => {
  it("each error site gives its code, its details and its trace", async () => {
    expect(CASES.filter((c) => explain(c.expr, { space: s, origin: "A", domains: [PtDomain, Num], ...c.opts }).result.ok).map((c) => c.name)).toEqual([]);
    await expect(`${CASES.map(render).join("\n\n")}\n`).toMatchFileSnapshot("./__golden__/errors.txt");
  });

  it("an ok value prints as JSON", () => {
    expect(render({ name: "a value", expr: ref("weight") })).toBe("## a value\nvalue: 2\nweight @A [read A.weight] = 2\nresult = 2");
  });
});
