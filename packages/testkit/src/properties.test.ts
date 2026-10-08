import { app, each, evaluate, explain, lit, parse, ref, serialize, space, vex, type Expr, type Space } from "@vex/core";
import { BoolDomain, NumDomain, Vec2, Vec2Domain } from "@vex/domains";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { arbExpr, arbOrigin, arbSpace, PATHS } from "./arbitraries.ts";
import { fromCore, fromReference } from "./compare.ts";
import { structuralEqual } from "./laws.ts";
import { referenceEvaluate } from "./reference.ts";

const DOMAINS = [Vec2Domain, NumDomain, BoolDomain] as const;
const vec = fc.tuple(fc.integer({ min: -5, max: 5 }), fc.integer({ min: -5, max: 5 })).map(([x, y]) => new Vec2(x, y));
const OPTS = { domainValue: vec, ops: ["add", "subtract", "scale", "length", "dot", "divide", "multiply", "anyNonPositive", "gt", "not", "and"] };

/** A space, an expression and an origin (sometimes an origin that is not in the space). */
const program = arbSpace(vec).chain((s) => fc.tuple(fc.constant(s), arbExpr(OPTS), arbOrigin(s)));

const run = (e: Expr, s: Space, origin: string): ReturnType<typeof evaluate> => evaluate(e, { space: s, origin, domains: DOMAINS });

describe("properties of the interpreter", () => {
  it("P1 EVAL.TOTAL: evaluation does not throw, and a value is never undefined (V-009, V-022, V-041)", () => {
    fc.assert(
      fc.property(program, ([s, e, k]) => {
        const r = run(e, s, k);
        expect(r.ok ? r.value !== undefined : r.error.code.startsWith("#")).toBe(true);
      }),
    );
  });

  it("P2 EVAL.PURE: two evaluations agree, and explain gives the same result (V-004, V-010)", () => {
    fc.assert(
      fc.property(program, ([s, e, k]) => {
        const first = fromCore(run(e, s, k));
        expect(fromCore(run(e, s, k))).toEqual(first);
        expect(fromCore(explain(e, { space: s, origin: k, domains: DOMAINS }).result)).toEqual(first);
      }),
    );
  });

  it("P8 EVAL.REFERENCE: the core interpreter and the reference interpreter agree", () => {
    fc.assert(
      fc.property(program, ([s, e, k]) => {
        const core = fromCore(run(e, s, k));
        const reference = fromReference(referenceEvaluate(e, { space: s, origin: k, domains: DOMAINS }));
        expect(core).toEqual(reference);
      }),
    );
  });

  it("P6 IR.JSON: an expression with JSON literals round-trips through JSON", () => {
    fc.assert(
      fc.property(arbExpr(OPTS), (e) => {
        const text = serialize(e, DOMAINS);
        // Only a number that is not finite has no JSON form.
        const nonFinite = JSON.stringify(e, (_k, v: unknown) => (typeof v === "number" && !Number.isFinite(v) ? "NONFINITE" : v)).includes("NONFINITE");
        const back = text.ok ? parse(text.value, DOMAINS) : undefined;
        const roundTrip = text.ok && back?.ok === true && structuralEqual(JSON.parse(JSON.stringify(back.value)), JSON.parse(text.value));
        expect(text.ok ? roundTrip : nonFinite).toBe(true);
      }),
    );
  });
});

describe("properties of the axes", () => {
  const recordSpace = arbSpace(vec).filter((s) => s.kind === "record");
  const pathArb = fc.constantFrom(...PATHS);

  it("P5 AXIS.OTHERS-UNION: the others and the origin give the same items as all", () => {
    fc.assert(
      fc.property(recordSpace.chain((s) => fc.tuple(fc.constant(s), fc.constantFrom(...s.keys), pathArb)), ([s, k, path]) => {
        const keysOf = (r: ReturnType<typeof run>): readonly string[] => (r.ok ? (r.value as { items: readonly { key: string }[] }).items.map((i) => i.key) : []);
        const others = keysOf(run(each({ t: "others" }, ref(path)), s, k));
        const all = keysOf(run(each({ t: "all" }, ref(path)), s, k));
        expect([...others, k].toSorted()).toEqual([...all].toSorted());
      }),
    );
  });

  it("P5 AXIS.OTHER-TWICE: in a pair, other twice reads at the origin", () => {
    const pair = arbSpace(vec).filter((s) => s.kind === "record" && s.keys.length === 2);
    fc.assert(
      fc.property(pair.chain((s) => fc.tuple(fc.constant(s), fc.constantFrom(...s.keys), pathArb)), ([s, k, path]) => {
        expect(fromCore(run(ref(path, [{ t: "other" }, { t: "other" }]), s, k))).toEqual(fromCore(run(ref(path), s, k)));
      }),
    );
  });

  it("P5 AXIS.EXTEND: an item of each(all, e) equals e evaluated at that key (the comonad law extract . extend p = p)", () => {
    fc.assert(
      fc.property(program, ([s, e]) => {
        // The law holds for programs that do not read the origin, because inside an axis the origin stays.
        fc.pre(!JSON.stringify(e).includes('"t":"origin"'));
        const all = run(each({ t: "all" }, e), s, s.keys[0] ?? "");
        if (!all.ok) return;
        const items = (all.value as { items: readonly { key: string; result: ReturnType<typeof run> }[] }).items;
        for (const item of items) expect(fromCore(item.result)).toEqual(fromCore(run(e, s, item.key)));
      }),
    );
  });

  it("P7 LIST.REDUCE: for an associative op, any reduction tree equals the left fold", () => {
    const vectors = fc.array(vec, { minLength: 1, maxLength: 8 });
    fc.assert(
      fc.property(vectors, fc.infiniteStream(fc.boolean()), (vs, choices) => {
        const flips = choices[Symbol.iterator]();
        const tree = (xs: readonly Vec2[]): Vec2 => {
          if (xs.length === 1) return xs[0] ?? Vec2.zero;
          const cut = 1 + ((flips.next().value ? 1 : 0) % (xs.length - 1));
          return tree(xs.slice(0, cut)).add(tree(xs.slice(cut)));
        };
        const s = space.array(vs.map((v) => ({ v })));
        const folded = run(app("reduce", each({ t: "all" }, ref("v")), lit("add")), s, "0");
        expect(folded.ok && folded.value).toEqual(tree(vs));
      }),
    );
  });
});

describe("properties of the builder", () => {
  it("P3 BUILD.IMMUTABLE: a later call does not change an earlier chain (V-010)", () => {
    const root = vex(Vec2Domain, NumDomain).over(space.record({ A: { p: new Vec2(1, 2), q: new Vec2(3, 4) }, B: { p: new Vec2(5, 6), q: new Vec2(7, 8) } }));
    type Step = "add" | "subtract" | "scale" | "other" | "origin" | "to";
    fc.assert(
      fc.property(fc.array(fc.constantFrom<Step>("add", "subtract", "scale", "other", "origin", "to"), { maxLength: 8 }), (steps) => {
        let chain = root.from("p");
        const seen: { readonly chain: typeof chain; readonly json: string }[] = [{ chain, json: JSON.stringify(chain.program) }];
        for (const step of steps) {
          chain =
            step === "add" ? chain._.add("q")
            : step === "subtract" ? chain._.subtract("p")
            : step === "scale" ? chain._.scale(2)
            : step === "other" ? chain.other()
            : step === "origin" ? chain.origin()
            : chain.to("B");
          seen.push({ chain, json: JSON.stringify(chain.program) });
        }
        for (const s of seen) expect(JSON.stringify(s.chain.program)).toBe(s.json);
      }),
    );
  });
});
