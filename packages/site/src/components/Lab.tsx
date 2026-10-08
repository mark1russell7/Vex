/**
 * The Lab. The reader builds a chain from chips: a field, the ops of the domain of the current value, moves,
 * an axis and a reduction. The Lab shows the code, the result at each origin, the trace and the expression as
 * JSON. The reader can also change the JSON and evaluate it: a program is data.
 */
import { app, domainOf, each, evaluate, explain, isVexList, key as keyMove, let_, lit, other as otherMove, origin as originMove, parse, ref, serialize, v, type Expr, type Move, type ParamKind } from "@vex/core";
import { useMemo, useState, type ReactElement } from "react";
import { errorHref, show, showResult } from "../lib/format.ts";
import { DOMAINS, spaceOf, useBoxes, type BoxKey } from "../lib/specimen.ts";

const KEYS: readonly BoxKey[] = ["A", "B", "C", "D"];
const FIELDS = ["position", "size", "weight", "name", "color"] as const;

type ArgSrc = { readonly t: "field"; readonly field: string } | { readonly t: "num"; readonly n: number } | { readonly t: "of"; readonly key: BoxKey; readonly field: string };
type Body = "distance" | "offset" | "weight";
type Step =
  | { readonly t: "from"; readonly field: string }
  | { readonly t: "op"; readonly op: string; readonly args: readonly ArgSrc[] }
  | { readonly t: "nav"; readonly move: "origin" | "other" | BoxKey }
  | { readonly t: "others"; readonly body: Body }
  | { readonly t: "reduce"; readonly op: string };

const BODIES: Readonly<Record<Body, { readonly expr: (base: string) => Expr; readonly code: string }>> = {
  distance: { expr: (b) => app("length", app("subtract", v(b), ref("position"))), code: `(e) => e._.subtract("position")._.length()` },
  offset: { expr: (b) => app("subtract", v(b), ref("position")), code: `(e) => e._.subtract("position")` },
  weight: { expr: () => ref("weight"), code: `(e) => e.from("weight")` },
};

const argCode = (a: ArgSrc): string => (a.t === "field" ? JSON.stringify(a.field) : a.t === "num" ? String(a.n) : `root.of(${JSON.stringify(a.key)}, ${JSON.stringify(a.field)})`);

/** This function builds the expression and the code of the steps. */
function build(steps: readonly Step[]): { readonly expr: Expr | undefined; readonly code: string } {
  let expr: Expr | undefined;
  let code = "root";
  let addr: Move[] = [];
  let depth = 0;
  const argExpr = (a: ArgSrc): Expr => (a.t === "field" ? ref(a.field, addr) : a.t === "num" ? lit(a.n) : ref(a.field, [keyMove(a.key)]));
  for (const s of steps) {
    switch (s.t) {
      case "from":
        expr = ref(s.field, addr);
        code += `.from(${JSON.stringify(s.field)})`;
        break;
      case "op":
        if (expr !== undefined) expr = app(s.op, expr, ...s.args.map(argExpr));
        code += `\n  ._.${s.op}(${s.args.map(argCode).join(", ")})`;
        break;
      case "nav":
        addr = [...addr, s.move === "origin" ? originMove : s.move === "other" ? otherMove : keyMove(s.move)];
        code += s.move === "origin" ? ".origin()" : s.move === "other" ? ".other()" : `.to(${JSON.stringify(s.move)})`;
        break;
      case "others": {
        const name = `$${depth++}`;
        if (expr !== undefined) expr = let_({ [name]: expr }, each({ t: "others" }, BODIES[s.body].expr(name)));
        code += `\n  .others(${BODIES[s.body].code})`;
        break;
      }
      case "reduce":
        if (expr !== undefined) expr = s.op === "add" ? app("reduce", expr, lit("add")) : app(s.op, expr);
        code += s.op === "add" ? `.reduce("add")` : `.${s.op}()`;
        break;
    }
  }
  return { expr, code };
}

const START: readonly Step[] = [
  { t: "from", field: "position" },
  { t: "others", body: "distance" },
  { t: "reduce", op: "min" },
];

/** The Lab. */
export default function Lab(): ReactElement {
  const boxes = useBoxes();
  const s = spaceOf(boxes);
  const [steps, setSteps] = useState<readonly Step[]>(START);
  const [origin, setOrigin] = useState<BoxKey>("A");
  const [json, setJson] = useState<string | undefined>(undefined);
  const [num, setNum] = useState(2);
  const [argField, setArgField] = useState("size");
  const [argKey, setArgKey] = useState<BoxKey | "focus">("focus");

  const { expr, code } = useMemo(() => build(steps), [steps]);
  const fromJson = useMemo(() => (json === undefined ? undefined : parse(json, DOMAINS)), [json]);
  const program: Expr | undefined = fromJson?.ok === true ? fromJson.value : expr;

  const results = useMemo(
    () => (program === undefined ? [] : KEYS.map((k) => ({ key: k, result: evaluate(program, { space: s, origin: k, domains: DOMAINS }) }))),
    [program, s],
  );
  const trace = useMemo(() => (program === undefined ? undefined : explain(program, { space: s, origin, domains: DOMAINS })), [program, s, origin]);
  const current = results.find((r) => r.key === origin)?.result;
  const value = current?.ok === true ? current.value : undefined;
  const domain = value === undefined ? undefined : domainOf(DOMAINS, value);
  const isList = isVexList(value);
  const serialized = program === undefined ? "" : (() => {
    const t = serialize(program, DOMAINS);
    return t.ok ? JSON.stringify(JSON.parse(t.value) as unknown, null, 2) : t.error.message;
  })();

  const add = (step: Step): void => {
    setJson(undefined);
    setSteps([...steps, step]);
  };
  const argFor = (kind: ParamKind | undefined): ArgSrc =>
    kind === "number" ? { t: "num", n: num } : argKey === "focus" ? { t: "field", field: argField } : { t: "of", key: argKey, field: argField };

  return (
    <section className="vx-frame" aria-label="The Lab">
      <header>
        <strong>The Lab</strong>
        <span className="vx-row">
          origin
          {KEYS.map((k) => (
            <button key={k} type="button" className="vx-button" aria-pressed={k === origin} onClick={() => setOrigin(k)}>
              {k}
            </button>
          ))}
          <button type="button" className="vx-button" onClick={() => { setSteps([]); setJson(undefined); }}>
            Clear
          </button>
          <button type="button" className="vx-button" disabled={steps.length === 0} onClick={() => { setSteps(steps.slice(0, -1)); setJson(undefined); }}>
            Undo
          </button>
        </span>
      </header>
      <div className="vx-body" style={{ display: "grid", gap: "var(--space-3)" }}>
        {expr === undefined ? (
          <div className="vx-row">
            start with a field:
            {FIELDS.map((f) => (
              <button key={f} type="button" className="vx-button" onClick={() => add({ t: "from", field: f })}>
                from("{f}")
              </button>
            ))}
          </div>
        ) : (
          <>
            {domain !== undefined ? (
              <div>
                <div className="vx-row" style={{ marginBottom: "var(--space-2)" }}>
                  <span className="vx-muted">argument:</span>
                  <select className="vx-button" value={argKey} onChange={(e) => setArgKey(e.target.value as BoxKey | "focus")} aria-label="The key of a field argument">
                    <option value="focus">at the focus</option>
                    {KEYS.map((k) => (
                      <option key={k} value={k}>
                        of {k}
                      </option>
                    ))}
                  </select>
                  <select className="vx-button" value={argField} onChange={(e) => setArgField(e.target.value)} aria-label="The field of a field argument">
                    {FIELDS.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                  <label className="vx-row">
                    number
                    <input className="vx-button" type="number" value={num} onChange={(e) => setNum(Number(e.target.value))} style={{ width: "5rem" }} />
                  </label>
                </div>
                <div className="vx-row">
                  <span className="vx-muted">ops of {domain.name}:</span>
                  {Object.keys(domain.ops).map((op) => {
                    const params = (domain.ops[op] as { params?: readonly ParamKind[] }).params ?? [];
                    return (
                      <button key={op} type="button" className="vx-button" onClick={() => add({ t: "op", op, args: params.map(argFor) })} title={params.length === 0 ? "no arguments" : `arguments: ${params.join(", ")}`}>
                        {op}({params.join(", ")})
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            {isList ? (
              <div className="vx-row">
                <span className="vx-muted">reduce the list:</span>
                {["min", "max", "sum", "mean", "count", "any", "all", "values", "add"].map((op) => (
                  <button key={op} type="button" className="vx-button" onClick={() => add({ t: "reduce", op })}>
                    {op === "add" ? `reduce("add")` : `${op}()`}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="vx-row">
              <span className="vx-muted">move:</span>
              {KEYS.map((k) => (
                <button key={k} type="button" className="vx-button" onClick={() => add({ t: "nav", move: k })}>
                  to("{k}")
                </button>
              ))}
              <button type="button" className="vx-button" onClick={() => add({ t: "nav", move: "other" })}>
                other()
              </button>
              <button type="button" className="vx-button" onClick={() => add({ t: "nav", move: "origin" })}>
                origin()
              </button>
            </div>
            {!isList ? (
              <div className="vx-row">
                <span className="vx-muted">axis:</span>
                {(["distance", "offset", "weight"] as const).map((b) => (
                  <button key={b} type="button" className="vx-button" onClick={() => add({ t: "others", body: b })}>
                    others({b})
                  </button>
                ))}
                <button type="button" className="vx-button" onClick={() => add({ t: "from", field: "position" })}>
                  from("position")
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
      <pre className="vx-code">{fromJson?.ok === true ? "// the program from the JSON below" : code}</pre>
      <table className="vx-table" aria-label="The result at each origin">
        <tbody>
          {results.map(({ key: k, result }) => (
            <tr key={k} style={{ background: k === origin ? "var(--color-accent-wash)" : undefined }}>
              <th scope="row">{k}</th>
              <td className={result.ok ? undefined : "vx-cell-error"}>
                {result.ok ? show(result.value) : <a href={errorHref(result.error.code)}>{showResult(result)}</a>}
                {result.ok ? null : <span className="vx-muted"> {result.error.message}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <details className="vx-body">
        <summary>The trace at {origin}</summary>
        <ol style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)" }}>
          {trace?.events.map((e, i) => (
            <li key={i} style={{ paddingLeft: `${Math.min(e.path.length, 8)}ch` }}>
              {e.tag} {e.label} @{e.focus} → {e.result.ok ? show(e.result.value) : e.result.error.code}
            </li>
          ))}
        </ol>
      </details>
      <details className="vx-body" open>
        <summary>The program as JSON (change it, then evaluate)</summary>
        <textarea
          key={serialized}
          defaultValue={serialized}
          aria-label="The program as JSON"
          spellCheck={false}
          onBlur={(e) => setJson(e.target.value)}
          style={{ width: "100%", minHeight: "12rem", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", border: "1px solid var(--color-rule)", borderRadius: "var(--radius)", padding: "var(--space-2)", background: "var(--color-surface-sunken)", color: "var(--color-ink)" }}
        />
        <p className="vx-muted" style={{ margin: 0 }}>
          {fromJson === undefined
            ? "Change the JSON and leave the field: the Lab evaluates the new program."
            : fromJson.ok
              ? "The Lab evaluates the program from the JSON. Select a chip to go back to the builder."
              : `The JSON is not a valid program: ${fromJson.error.message}`}
        </p>
      </details>
    </section>
  );
}
