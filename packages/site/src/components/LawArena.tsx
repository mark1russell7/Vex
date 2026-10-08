/**
 * The law arena. The law checker of `@vex/testkit` runs in the browser: it tests each law that each domain
 * declares. The second part is a hunt. The old `Color.add` claimed commutativity. But it kept the alpha of the
 * receiver. fast-check finds a counterexample, and the widget shows each step of the shrinking.
 */
import { defineDomain, resolveOp, type OpTable } from "@vex/core";
import { Angle, AngleDomain, BoolDomain, Color, ColorDomain, NDVector, NDVectorDomain, NumDomain, Vec2, Vec2Domain } from "@vex/domains";
import { checkLaws, structuralEqual, type LawResult } from "@vex/testkit";
import * as fc from "fast-check";
import { useState, type ReactElement } from "react";

const small = fc.integer({ min: -20, max: 20 });

const SUITES = [
  { name: "Vec2", run: (): readonly LawResult[] => checkLaws(Vec2Domain, { arb: fc.tuple(small, small).map(([x, y]) => new Vec2(x, y)) }) },
  { name: "NDVector", run: (): readonly LawResult[] => checkLaws(NDVectorDomain, { arb: fc.record({ x: small, y: small }, { requiredKeys: [] }).map((c) => new NDVector(c as Readonly<Record<string, number>>)) }) },
  { name: "Color", run: (): readonly LawResult[] => checkLaws(ColorDomain, { arb: fc.tuple(small, small, small, fc.constantFrom(0, 0.5, 1)).map(([r, g, b, a]) => new Color(r, g, b, a)) }) },
  { name: "Angle", run: (): readonly LawResult[] => checkLaws(AngleDomain, { arb: small.map((r) => new Angle(r)) }) },
  { name: "Num", run: (): readonly LawResult[] => checkLaws(NumDomain, { arb: small }) },
  { name: "Bool", run: (): readonly LawResult[] => checkLaws(BoolDomain, { arb: fc.boolean() }) },
] as const;

/** The old color: `add` keeps the alpha of the receiver. */
class OldColor {
  readonly r: number;
  readonly a: number;
  constructor(r: number, a: number) {
    this.r = r;
    this.a = a;
  }
  add(o: OldColor): OldColor {
    return new OldColor(this.r + o.r, this.a);
  }
  toString(): string {
    return `OldColor(r ${this.r}, a ${this.a})`;
  }
}

const OldColorDomain = defineDomain<"OldColor", OldColor, OpTable<OldColor, "add">>({
  name: "OldColor",
  is: (u: unknown): u is OldColor => u instanceof OldColor,
  ops: { add: { laws: ["commutative"] } },
});

/** This function adds two old colors with the op of the domain. */
const add = (x: OldColor, y: OldColor): unknown => resolveOp(OldColorDomain, x, "add")?.call([y]);

/** This function runs the commutativity property of the old color with shrinking, and gives each failure. */
function hunt(seed: number): readonly string[] {
  const arb = fc.tuple(fc.integer({ min: -50, max: 50 }), fc.constantFrom(0, 0.25, 0.5, 1)).map(([r, a]) => new OldColor(r, a));
  const details = fc.check(
    fc.property(arb, arb, (x, y) => structuralEqual(add(x, y), add(y, x))),
    { seed, verbose: 1 },
  );
  return details.failures.map((f) => {
    const [x, y] = f as readonly [OldColor, OldColor];
    return `a = ${x.toString()}, b = ${y.toString()}`;
  });
}

/** The arena. */
export default function LawArena(): ReactElement {
  const [results, setResults] = useState<readonly { readonly suite: string; readonly results: readonly LawResult[] }[]>([]);
  const [steps, setSteps] = useState<readonly string[]>([]);
  const [shown, setShown] = useState(0);

  return (
    <section className="vx-frame" aria-label="The law arena">
      <header>
        <strong>The law arena</strong>
        <span className="vx-row">
          <button type="button" className="vx-button" data-variant="primary" onClick={() => setResults(SUITES.map((s) => ({ suite: s.name, results: s.run() })))}>
            Check the laws of each domain
          </button>
        </span>
      </header>
      {results.length === 0 ? (
        <p className="vx-body vx-muted" style={{ margin: 0 }}>
          The checker runs 200 random cases for each law. It runs in your browser, with the same code as CI.
        </p>
      ) : (
        <table className="vx-table">
          <thead>
            <tr>
              <th scope="col">law</th>
              <th scope="col">result</th>
            </tr>
          </thead>
          <tbody>
            {results.flatMap((s) =>
              s.results.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td>
                    <span className="vx-chip" data-state={r.ok ? "pass" : "fail"}>
                      {r.ok ? "holds" : "fails"}
                    </span>
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      )}
      <div className="vx-body" style={{ borderTop: "1px solid var(--color-rule)" }}>
        <p style={{ marginTop: 0 }}>
          <strong>The hunt.</strong> The old <code>Color.add</code> said that it is commutative. Find the lie.
        </p>
        <div className="vx-row">
          <button
            type="button"
            className="vx-button"
            onClick={() => {
              const s = hunt(Math.floor(Math.random() * 1e9));
              setSteps(s);
              setShown(0);
            }}
          >
            Run the property
          </button>
          <button type="button" className="vx-button" disabled={shown >= steps.length - 1} onClick={() => setShown(shown + 1)}>
            Next shrink step
          </button>
          <span className="vx-muted">{steps.length === 0 ? "" : `step ${shown + 1} of ${steps.length}`}</span>
        </div>
        <ol style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}>
          {steps.slice(0, shown + 1).map((s, i) => (
            <li key={i} style={{ color: i === shown ? "var(--color-mark)" : "var(--color-ink-muted)" }}>
              {s}
            </li>
          ))}
        </ol>
        {steps.length > 0 && shown === steps.length - 1 ? (
          <p className="vx-muted" style={{ marginBottom: 0 }}>
            The smallest counterexample: two colors with different alpha values. a + b keeps the alpha of a, and b + a keeps the alpha of b. The new <code>Color.add</code> keeps the larger alpha, so the law holds.
          </p>
        ) : null}
      </div>
    </section>
  );
}
