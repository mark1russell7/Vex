import { describe, expect, it } from "vitest";
import { deps } from "./deps.ts";
import { evaluate, explain, type EvalOptions } from "./evaluate.ts";
import { app, axes, each, ext, key, let_, lit, other, ref, rec, v, type Expr } from "./ir.ts";
import { parse, serialize } from "./json.ts";
import { isVexList } from "./list.ts";
import { fail, ok } from "./result.ts";
import { space } from "./space.ts";
import { error, Pt, PtDomain, value } from "./test-support.ts";
import { vexError } from "./errors.ts";

const A = { position: new Pt(0, 0), size: new Pt(2, 2), name: "a", weight: 2 };
const B = { position: new Pt(3, 4), size: new Pt(1, 1), name: "b", weight: 3 };
const C = { position: new Pt(6, 8), size: new Pt(1, 1), name: "c", weight: 5 };
const D = { position: new Pt(0, 1), size: new Pt(1, 1), name: "d", weight: 7 };

const at = (s: EvalOptions["space"], origin: string, extra: Partial<EvalOptions> = {}): EvalOptions => ({
  space: s,
  origin,
  domains: [PtDomain],
  ...extra,
});

describe("references (REF.*)", () => {
  const s = space.record({ A, B, nested: { p: { x: 1, y: null } } });

  it("REF.FOCUS: a reference reads the field at the focus", () => {
    expect(value(evaluate(ref("position"), at(s, "A")))).toEqual(new Pt(0, 0));
    expect(value(evaluate(ref("position"), at(s, "B")))).toEqual(new Pt(3, 4));
  });

  it("REF.PATH: a dotted path reads a nested field", () => {
    expect(value(evaluate(ref("p.x"), at(s, "nested")))).toBe(1);
    expect(value(evaluate(ref([]), at(s, "nested")))).toEqual({ p: { x: 1, y: null } });
  });

  it("REF.MISSING: a missing or null field gives #N/A", () => {
    expect(error(evaluate(ref("p.z"), at(s, "nested"))).code).toBe("#N/A");
    expect(error(evaluate(ref("p.y"), at(s, "nested"))).code).toBe("#N/A");
    expect(error(evaluate(ref("p.x.deeper"), at(s, "nested"))).code).toBe("#N/A");
  });

  it("REF.FORBIDDEN: prototype names are not fields", () => {
    expect(error(evaluate(ref("__proto__"), at(s, "A"))).code).toBe("#N/A");
    expect(error(evaluate(ref("position.constructor"), at(s, "A"))).code).toBe("#N/A");
  });

  it("REF.ADDRESS: an address moves the read, and a bad address gives #REF!", () => {
    expect(value(evaluate(ref("position", [key("B")]), at(s, "A")))).toEqual(new Pt(3, 4));
    expect(error(evaluate(ref("position", [key("Z")]), at(s, "A"))).code).toBe("#REF!");
  });

  it("EVAL.ORIGIN: an unknown origin gives #REF!", () => {
    expect(error(evaluate(lit(1), at(s, "Z"))).kind).toBe("unknown-key");
  });
});

describe("ops (CALL.*)", () => {
  const pair = space.record({ A, B });

  it("CALL.METHOD: an op calls the method of the receiver", () => {
    expect(value(evaluate(app("add", ref("position"), ref("size")), at(pair, "A")))).toEqual(new Pt(2, 2));
  });

  it("CALL.FN: an op with fn calls the function", () => {
    expect(value(evaluate(app("dot", ref("size"), ref("size")), at(pair, "A")))).toBe(8);
  });

  it("CALL.UNKNOWN-OP: an undeclared op gives #NAME?, also for inherited members (V-008)", () => {
    expect(error(evaluate(app("nope", ref("position")), at(pair, "A"))).code).toBe("#NAME?");
    expect(error(evaluate(app("toString", ref("position")), at(pair, "A"))).code).toBe("#NAME?");
    expect(error(evaluate(app("constructor", ref("position")), at(pair, "A"))).code).toBe("#NAME?");
  });

  it("CALL.RECEIVER: a receiver that no domain accepts gives #VALUE!", () => {
    expect(error(evaluate(app("add", ref("name"), lit(1)), at(pair, "A"))).code).toBe("#VALUE!");
  });

  it("CALL.PARAMS: a declared domain parameter checks its argument (V-007)", () => {
    const e = error(evaluate(app("add", ref("position"), lit(true)), at(pair, "A")));
    expect(e.code).toBe("#VALUE!");
    expect(e.kind).toBe("not-instance");
    expect(error(evaluate(app("scale", ref("position"), lit("x")), at(pair, "A"))).kind).toBe("kind-mismatch");
  });

  it("CALL.LIFT: a number argument lifts with fromScalar when the op declares liftScalar", () => {
    expect(value(evaluate(app("add", ref("position"), lit(5)), at(pair, "A")))).toEqual(new Pt(5, 5));
  });

  it("CALL.THROW: an op that throws gives #CALC! with the thrown value", () => {
    const e = error(evaluate(app("boom", ref("position")), at(pair, "A")));
    expect(e.code).toBe("#CALC!");
    expect(e.thrown).toBeInstanceOf(Error);
  });

  it("CALL.RESULT: a non-finite number or an invalid domain value gives #NUM! (V-022)", () => {
    const zero = space.record({ A: { p: new Pt(0, 0) } });
    expect(error(evaluate(app("scale", ref("p"), lit(Number.NaN)), at(zero, "A"))).code).toBe("#NUM!");
    expect(error(evaluate(app("scale", ref("p"), lit(Number.POSITIVE_INFINITY)), at(zero, "A"))).code).toBe("#NUM!");
  });

  it("CALL.ARGS: one failed argument stays as it is, two or more give #ARGS with each cause", () => {
    const one = error(evaluate(app("add", ref("position"), ref("missing")), at(pair, "A")));
    expect(one.code).toBe("#N/A");
    expect(one.path).toEqual([1]);
    const two = error(evaluate(app("add", ref("nope1"), ref("nope2")), at(pair, "A")));
    expect(two.code).toBe("#ARGS");
    expect(two.causes?.map((c) => c.path)).toEqual([[0], [1]]);
  });

  it("CALL.STRING-ARGS: a string literal is a value, not a reference (V-038)", () => {
    expect(value(evaluate(app("pick", ref("position"), lit(["x", "q"])), at(pair, "A")))).toEqual(["x"]);
  });

  it("CALL.FREE: a free function applies when no domain accepts the receiver", () => {
    const opts = at(pair, "A", { fns: { concat: (...xs: readonly unknown[]) => xs.join("") } });
    expect(value(evaluate(app("concat", ref("name"), lit("!")), opts))).toBe("a!");
  });

  it("EXAMPLE.SEPARATION: the separation test of a pair", () => {
    const sep = app("anyNonPositive", app("subtract", app("add", ref("position"), ref("size")), ref("position", [other])));
    expect(value(evaluate(sep, at(pair, "A")))).toBe(true);
    expect(value(evaluate(sep, at(pair, "B")))).toBe(false);
  });
});

describe("bindings (LET.*)", () => {
  const pair = space.record({ A, B });

  it("LET.BIND: let binds names for the body (V-006)", () => {
    const e = let_({ base: ref("position"), k: lit(2) }, app("scale", app("add", v("base"), ref("size")), v("k")));
    expect(value(evaluate(e, at(pair, "A")))).toEqual(new Pt(4, 4));
  });

  it("LET.LAZY-ERROR: a failed binding has an effect only where a var reads it", () => {
    expect(value(evaluate(let_({ bad: ref("missing") }, ref("position")), at(pair, "A")))).toEqual(new Pt(0, 0));
    const e = error(evaluate(let_({ bad: ref("missing") }, v("bad")), at(pair, "A")));
    expect(e.code).toBe("#N/A");
    expect(e.path).toEqual([0]);
  });

  it("LET.UNBOUND: an unbound name gives #NAME?", () => {
    expect(error(evaluate(v("nope"), at(pair, "A"))).kind).toBe("unbound");
  });

  it("LET.VARS: the caller can give variables", () => {
    expect(value(evaluate(app("scale", ref("position", [key("B")]), v("k")), at(pair, "A", { vars: { k: 2 } })))).toEqual(new Pt(6, 8));
  });

  it("REC.FIELDS: a record collects its fields, and failed fields give #ARGS", () => {
    expect(value(evaluate(rec({ x: lit(1), p: ref("position") }), at(pair, "A")))).toEqual({ x: 1, p: new Pt(0, 0) });
    expect(error(evaluate(rec({ x: ref("q"), y: ref("r") }), at(pair, "A"))).code).toBe("#ARGS");
  });
});

describe("axes (AXIS.*) and list ops (LIST.*)", () => {
  const four = space.record({ A, B, C, D });
  const distances = let_(
    { base: ref("position") },
    each(axes.others, app("length", app("subtract", v("base"), ref("position")))),
  );

  it("AXIS.OTHERS.ORIGIN and EXAMPLE.NEAREST: the base evaluates at the origin, the body at each target (V-001, V-042)", () => {
    expect(value(evaluate(app("min", distances), at(four, "A")))).toBe(1);
    const list = value(evaluate(distances, at(four, "A")));
    expect(isVexList(list) && list.items.map((item) => item.key)).toEqual(["B", "C", "D"]);
  });

  it("EXAMPLE.OFFSETS: reduce with a domain op over the others", () => {
    const three = space.record({ A, B, C });
    const offsets = let_({ base: ref("position") }, each(axes.others, app("subtract", v("base"), ref("position"))));
    expect(value(evaluate(app("reduce", offsets, lit("add")), at(three, "A")))).toEqual(new Pt(-9, -12));
  });

  it("AXIS.WHERE: where keeps the targets whose test gives true", () => {
    const heavy = each(axes.where(axes.all, app("gt", ref("weight"), lit(2))), ref("name"));
    const opts = at(four, "A", { fns: { gt: (a: unknown, b: unknown) => (a as number) > (b as number) } });
    const list = value(evaluate(app("values", heavy), opts));
    expect(list).toEqual(["b", "c", "d"]);
  });

  it("AXIS.OTHER.PAIR: the other axis outside a pair gives #REF!", () => {
    expect(error(evaluate(each(axes.other, ref("name")), at(four, "A"))).code).toBe("#REF!");
  });

  it("LIST.LENIENT: list ops skip error items by default, and strict makes the first error the result (V-013)", () => {
    const withMissing = space.record({ A, B, X: { name: "x" } });
    const lengths = each(axes.all, app("length", ref("position")));
    expect(value(evaluate(app("count", lengths), at(withMissing, "A")))).toBe(2);
    expect(value(evaluate(app("sum", lengths), at(withMissing, "A")))).toBe(5);
    expect(error(evaluate(app("sum", lengths, lit({ strict: true })), at(withMissing, "A"))).code).toBe("#N/A");
    expect(value(evaluate(app("errors", lengths), at(withMissing, "A")))).toHaveLength(1);
  });

  it("LIST.EMPTY: min of nothing gives #N/A, sum of nothing gives 0, reduce of nothing gives the identity", () => {
    const one = space.record({ A });
    const others = each(axes.others, ref("position"));
    expect(error(evaluate(app("min", each(axes.others, app("length", ref("position")))), at(one, "A"))).kind).toBe("empty");
    expect(value(evaluate(app("sum", each(axes.others, ref("weight"))), at(one, "A")))).toBe(0);
    expect(value(evaluate(app("reduce", others, lit("add")), at(one, "A")))).toEqual(new Pt(0, 0));
    expect(error(evaluate(app("reduce", others, lit("subtract")), at(one, "A"))).kind).toBe("empty");
  });

  it("LIST.KINDS: sum needs numbers and any needs booleans", () => {
    expect(error(evaluate(app("sum", each(axes.all, ref("name"))), at(four, "A"))).kind).toBe("kind-mismatch");
    expect(value(evaluate(app("any", each(axes.all, app("anyNonPositive", ref("position")))), at(four, "A")))).toBe(true);
  });

  it("AXIS.NEIGHBORS: a cellular automaton rule over a grid", () => {
    const g = space.grid([
      [{ alive: false }, { alive: true }, { alive: false }],
      [{ alive: false }, { alive: true }, { alive: false }],
      [{ alive: false }, { alive: true }, { alive: false }],
    ]);
    const liveNeighbors = app("count", each(axes.where(axes.neighbors(8), ref("alive")), lit(1)));
    expect(value(evaluate(liveNeighbors, { space: g, origin: "1,0" }))).toBe(3);
    expect(value(evaluate(liveNeighbors, { space: g, origin: "1,1" }))).toBe(2);
  });
});

describe("special forms (FORM.*)", () => {
  const s = space.record({ A });
  it("FORM.IF is lazy", () => {
    expect(value(evaluate(app("if", lit(true), lit(1), ref("missing")), at(s, "A")))).toBe(1);
    expect(error(evaluate(app("if", lit(1), lit(1), lit(2)), at(s, "A"))).kind).toBe("kind-mismatch");
  });
  it("FORM.AND-OR: and and or short-circuit", () => {
    expect(value(evaluate(app("and", lit(false), ref("missing")), at(s, "A")))).toBe(false);
    expect(value(evaluate(app("or", lit(true), ref("missing")), at(s, "A")))).toBe(true);
  });
  it("FORM.IFERROR catches an error value", () => {
    expect(value(evaluate(app("ifError", ref("missing"), lit(0)), at(s, "A")))).toBe(0);
    expect(value(evaluate(app("ifError", lit(5), ref("missing")), at(s, "A")))).toBe(5);
  });
});

describe("totality (EVAL.TOTAL)", () => {
  it("EVAL.TOTAL: an op that throws inside a reduction gives an error value, not an exception (V-009)", () => {
    const s = space.record({ A, B });
    const r = evaluate(app("reduce", each(axes.all, ref("position")), lit("boom")), { space: s, origin: "A", domains: [PtDomain] });
    expect(error(r).code).toBe("#CALC!");
    const thrower = evaluate(app("reduce", each(axes.all, ref("position")), lit("add")), {
      space: space.record({ A: { position: new Pt(Number.NaN, 0) }, B }),
      origin: "A",
      domains: [PtDomain],
    });
    expect(thrower.ok).toBe(false);
  });

  it("a domain whose is test throws does not throw through evaluate", () => {
    const evil = { name: "Evil", kind: "vex.domain", ops: {}, is: (): boolean => { throw new Error("no"); } } as const;
    const s = space.record({ A });
    const r = evaluate(app("add", ref("position"), ref("size")), { space: s, origin: "A", domains: [evil as never, PtDomain] });
    expect(value(r)).toEqual(new Pt(2, 2));
  });

  it("an extension handler that throws gives #CALC!", () => {
    const s = space.record({ A });
    const r = evaluate(ext("bad", null), { space: s, origin: "A", extensions: { bad: () => { throw new Error("x"); } } });
    expect(error(r).code).toBe("#CALC!");
    const good = evaluate(ext("seven", null), { space: s, origin: "A", extensions: { seven: () => ok(7) } });
    expect(value(good)).toBe(7);
    const failed = evaluate(ext("no", null), { space: s, origin: "A", extensions: { no: () => fail(vexError("empty", "x")) } });
    expect(error(failed).kind).toBe("empty");
  });
});

describe("folds: explain, deps, JSON", () => {
  const pair = space.record({ A, B });
  const sep: Expr = app("subtract", app("add", ref("position"), ref("size")), ref("position", [other]));

  it("TRACE.EVENTS: explain records one event for each node, in finish order, with reads", () => {
    const t = explain(sep, at(pair, "A"));
    expect(t.events.map((e) => `${e.tag}:${e.label}`)).toEqual(["ref:position", "ref:size", "app:add", "ref:position", "app:subtract"]);
    expect(t.events[3]?.reads).toEqual([{ key: "B", path: ["position"], ok: true }]);
    expect(t.events[3]?.focus).toBe("A");
    expect(value(t.result)).toEqual(new Pt(-1, -2));
  });

  it("TRACE.AXIS: inside an axis, the focus of each event is the target", () => {
    const four = space.record({ A, B, C, D });
    const t = explain(each(axes.others, ref("name")), at(four, "A"));
    expect(t.events.filter((e) => e.tag === "ref").map((e) => e.focus)).toEqual(["B", "C", "D"]);
  });

  it("DEPS.READS: deps gives each static read with its address and axes", () => {
    const e = let_({ base: ref("position") }, each(axes.others, app("subtract", v("base"), ref("position", [key("B")]))));
    expect(deps(e)).toEqual([
      { at: [], path: ["position"], axes: [] },
      { at: [{ t: "key", key: "B" }], path: ["position"], axes: ["others"] },
    ]);
  });

  it("IR.JSON: an expression round-trips, and domain literals need encode", () => {
    const e = app("add", ref("position"), lit(new Pt(1, 2)));
    const text = value(serialize(e, [PtDomain]));
    const back = value(parse(text, [PtDomain]));
    expect(back).toEqual(e);
    expect(error(serialize(e)).code).toBe("#VALUE!");
    expect(error(parse("{\"tag\":\"nope\"}")).code).toBe("#VALUE!");
    expect(error(parse("not json")).code).toBe("#VALUE!");
  });
});
