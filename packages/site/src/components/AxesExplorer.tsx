/**
 * The axes explorer. An axis is a relation between a focus and its targets. The matrix shows the relation for
 * each origin. The boxes show the arrows from the origin to its targets, with the value of the body at each
 * target: the distance to the origin. A reduction turns the list into one value.
 */
import { app, axisTargets, each, evaluate, isVexList, let_, lit, ref, v, type Axis, type Expr } from "@mark1russell7/vex";
import { Vec2 } from "@mark1russell7/vex-domains";
import { useMemo, useState, type ReactElement } from "react";
import { show, showResult } from "../lib/format.ts";
import { DOMAINS, spaceOf, useBoxes, type BoxKey } from "../lib/specimen.ts";
import { SpaceView, UNIT } from "./SpaceView.tsx";

const KEYS: readonly BoxKey[] = ["A", "B", "C", "D"];
type AxisName = "all" | "others" | "other" | "near";
type Reduction = "min" | "max" | "count" | "sum" | "mean";

const distanceBody: Expr = app("length", app("subtract", v("$base"), ref("position")));

function axisOf(name: AxisName, radius: number): Axis {
  switch (name) {
    case "all":
      return { t: "all" };
    case "others":
      return { t: "others" };
    case "other":
      return { t: "other" };
    case "near":
      return { t: "where", axis: { t: "others" }, test: app("lt", app("length", app("subtract", v("$base"), ref("position"))), lit(radius)) };
  }
}

const codeOf = (name: AxisName, red: Reduction, radius: number): string => {
  const where = name === "near" ? `, { where: (e) => e._.subtract("position")._.length()._.lt(${radius}) }` : "";
  const axisCall = name === "all" ? "each" : name === "other" ? "each /* over the pair */" : "others";
  return `root.from("position")\n  .${axisCall}((e) => e._.subtract("position")._.length()${where})\n  .${red}()`;
};

/** The explorer. */
export default function AxesExplorer(): ReactElement {
  const boxes = useBoxes();
  const [origin, setOrigin] = useState<BoxKey>("A");
  const [axisName, setAxisName] = useState<AxisName>("others");
  const [red, setRed] = useState<Reduction>("min");
  const [radius, setRadius] = useState(8);
  const s = spaceOf(boxes);
  const axis = axisOf(axisName, radius);

  const { items, reduced, relation } = useMemo(() => {
    const listExpr = let_({ $base: ref("position") }, each(axis, distanceBody));
    const opts = { space: s, origin, domains: DOMAINS };
    const list = evaluate(listExpr, opts);
    const reducedR = evaluate(app(red, listExpr), opts);
    const rel = KEYS.map((o) => {
      if (axis.t === "where") {
        const r = evaluate(app("keys", let_({ $base: ref("position") }, each(axis, lit(true)))), { ...opts, origin: o });
        return { origin: o, targets: r.ok && Array.isArray(r.value) ? (r.value as readonly string[]) : [], error: r.ok ? undefined : r.error.code };
      }
      const t = axisTargets(s, { origin: o, focus: o }, axis);
      return { origin: o, targets: t.ok ? t.value : [], error: t.ok ? undefined : t.error.code };
    });
    return { items: list.ok && isVexList(list.value) ? list.value.items : [], reduced: reducedR, relation: rel, listError: list.ok ? undefined : list.error };
  }, [s, origin, axis, red]);

  const o = boxes[origin];
  const oc = new Vec2(o.position.x, o.position.y);
  const overlay = (
    <g>
      {axisName === "near" ? <circle cx={oc.x * UNIT} cy={oc.y * UNIT} r={radius * UNIT} fill="none" stroke="var(--color-accent)" strokeDasharray="4 4" /> : null}
      {items.map((it) => {
        const t = boxes[it.key as BoxKey];
        const x2 = t.position.x * UNIT;
        const y2 = t.position.y * UNIT;
        return (
          <g key={it.key} pointerEvents="none">
            <line x1={oc.x * UNIT} y1={oc.y * UNIT} x2={x2} y2={y2} stroke={it.result.ok ? "var(--color-accent)" : "var(--color-mark)"} strokeWidth={2} markerEnd="url(#vx-arrow-ok)" />
            <text x={(oc.x * UNIT + x2) / 2 + 4} y={(oc.y * UNIT + y2) / 2 - 4} fontFamily="var(--font-mono)" fontSize={12} fill="var(--color-ink)">
              {it.result.ok ? show(it.result.value) : it.result.error.code}
            </text>
          </g>
        );
      })}
    </g>
  );

  return (
    <section className="vx-frame" aria-label="The axes explorer">
      <header>
        <strong>Axes are relations</strong>
        <span className="vx-row">
          axis
          {(["all", "others", "other", "near"] as const).map((a) => (
            <button key={a} type="button" className="vx-button" aria-pressed={a === axisName} onClick={() => setAxisName(a)}>
              {a === "near" ? "others where near" : a}
            </button>
          ))}
        </span>
      </header>
      <SpaceView boxes={boxes} origin={origin} onSelect={setOrigin} overlay={overlay} label={`The boxes. The origin is ${origin}. Select a box to make it the origin.`} />
      <div className="vx-body" style={{ display: "grid", gap: "var(--space-4)", gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))" }}>
        <div>
          <table className="vx-table" aria-label="The relation of the axis: origins in rows, targets in columns">
            <caption className="vx-muted" style={{ textAlign: "left" }}>
              The relation. A row is an origin, a column is a target.
            </caption>
            <thead>
              <tr>
                <th scope="col" />
                {KEYS.map((k) => (
                  <th key={k} scope="col">
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {relation.map((row) => (
                <tr key={row.origin} style={{ background: row.origin === origin ? "var(--color-accent-wash)" : undefined }}>
                  <th scope="row">
                    <button type="button" onClick={() => setOrigin(row.origin)} style={{ all: "unset", cursor: "pointer" }}>
                      {row.origin}
                    </button>
                  </th>
                  {row.error === undefined ? (
                    KEYS.map((k) => (
                      <td key={k} aria-label={row.targets.includes(k) ? `${row.origin} relates to ${k}` : `${row.origin} does not relate to ${k}`}>
                        {row.targets.includes(k) ? "●" : "·"}
                      </td>
                    ))
                  ) : (
                    <td colSpan={4} className="vx-cell-error">
                      {row.error}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div className="vx-row" style={{ marginBottom: "var(--space-2)" }}>
            reduce
            {(["min", "max", "count", "sum", "mean"] as const).map((r) => (
              <button key={r} type="button" className="vx-button" aria-pressed={r === red} onClick={() => setRed(r)}>
                {r}
              </button>
            ))}
          </div>
          {axisName === "near" ? (
            <label className="vx-row">
              radius {radius}
              <input type="range" min={1} max={20} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
            </label>
          ) : null}
          <p>
            Result at {origin}:{" "}
            <span className="vx-chip" data-state={reduced.ok ? "ok" : "error"}>
              {showResult(reduced)}
            </span>
          </p>
          {axisName === "other" ? (
            <p className="vx-muted">The axis other needs a space with two keys. These boxes are four, so the result is #REF!.</p>
          ) : null}
        </div>
      </div>
      <pre className="vx-code">{codeOf(axisName, red, radius)}</pre>
    </section>
  );
}
