/**
 * The chain stepper. It evaluates a program over the boxes with `explain()`, and shows the trace one node at a
 * time. For each node, it shows the focus, the fields that the node reads, and the value or the error. A table
 * shows the result of the program at each origin (the start axis).
 */
import { evaluate, explain, type Expr, type TraceEvent } from "@mark1russell7/vex";
import { useMemo, useState, type ReactElement } from "react";
import { errorHref, show, showResult } from "../lib/format.ts";
import { programById, type SiteProgram } from "../lib/programs.ts";
import { DOMAINS, resetBoxes, rootOf, spaceOf, useBoxes, type BoxKey } from "../lib/specimen.ts";
import { SpaceView } from "./SpaceView.tsx";

const KEYS: readonly BoxKey[] = ["A", "B", "C", "D"];

/** The properties of the stepper. */
export interface StepperProps {
  /** The id of a program of `lib/programs.ts`. */
  readonly program: string;
  readonly origin?: BoxKey;
  readonly title?: string;
}

function indentOf(e: TraceEvent): number {
  return Math.min(e.path.length, 8);
}

/** The stepper. */
export default function Stepper(props: StepperProps): ReactElement {
  const boxes = useBoxes();
  const [origin, setOrigin] = useState<BoxKey>(props.origin ?? "A");
  const [step, setStep] = useState<number | undefined>(undefined);
  const program: SiteProgram | undefined = programById(props.program);

  const view = useMemo(() => {
    if (program === undefined) return undefined;
    const expr: Expr = program.build(rootOf(boxes));
    const opts = { space: spaceOf(boxes), domains: DOMAINS, ...(program.fns === undefined ? {} : { fns: program.fns }) };
    const trace = explain(expr, { ...opts, origin });
    const all = KEYS.map((k) => ({ key: k, result: evaluate(expr, { ...opts, origin: k }) }));
    return { expr, trace, all };
  }, [program, boxes, origin]);

  if (program === undefined || view === undefined) return <p className="vx-muted">There is no program with the id {props.program}.</p>;

  const events = view.trace.events;
  const last = events.length - 1;
  const at = step === undefined ? last : Math.min(step, last);
  const current = events[at];
  const reads = (current?.reads ?? []).map((r) => ({ from: current?.focus ?? origin, to: r.key, ok: r.ok }));
  const errorKeys = current !== undefined && !current.result.ok && current.result.error.focus !== undefined ? [current.result.error.focus] : [];
  const final = view.trace.result;

  return (
    <section className="vx-frame" aria-label={props.title ?? program.title}>
      <header>
        <strong>{props.title ?? program.title}</strong>
        <span className="vx-row">
          origin
          {KEYS.map((k) => (
            <button key={k} type="button" className="vx-button" aria-pressed={k === origin} onClick={() => { setOrigin(k); setStep(undefined); }}>
              {k}
            </button>
          ))}
          <button type="button" className="vx-button" onClick={resetBoxes}>
            reset boxes
          </button>
        </span>
      </header>
      <SpaceView
        boxes={boxes}
        origin={origin}
        {...(current === undefined ? {} : { focus: current.focus })}
        reads={reads}
        errorKeys={errorKeys}
        label={`The boxes. The origin is ${origin}. Drag a box to move it.`}
      />
      <pre className="vx-code">{program.code}</pre>
      <div className="vx-body">
        <div className="vx-row" style={{ marginBottom: "var(--space-3)" }}>
          <button type="button" className="vx-button" onClick={() => setStep(0)} disabled={at === 0} aria-label="First step">
            First
          </button>
          <button type="button" className="vx-button" onClick={() => setStep(Math.max(0, at - 1))} disabled={at === 0} aria-label="Previous step">
            Back
          </button>
          <input
            type="range"
            min={0}
            max={Math.max(0, last)}
            value={at}
            onChange={(e) => setStep(Number(e.target.value))}
            aria-label="Step"
            style={{ flex: "1 1 10rem" }}
          />
          <button type="button" className="vx-button" onClick={() => setStep(Math.min(last, at + 1))} disabled={at >= last} aria-label="Next step">
            Next
          </button>
          <span className="vx-muted">
            step {at + 1} of {events.length}
          </span>
        </div>
        <ol style={{ listStyle: "none", margin: 0, padding: 0, fontFamily: "var(--font-mono)", fontSize: "var(--text-sm)", maxHeight: "16rem", overflowY: "auto" }}>
          {events.map((e, i) => (
            <li
              key={`${e.path.join(".")}-${i}`}
              style={{
                paddingLeft: `${indentOf(e)}ch`,
                opacity: i > at ? 0.35 : 1,
                background: i === at ? "var(--color-accent-wash)" : undefined,
                borderLeft: i === at ? "3px solid var(--color-accent)" : "3px solid transparent",
              }}
            >
              <button type="button" onClick={() => setStep(i)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}>
                <span style={{ color: "var(--color-ink-muted)" }}>{e.tag}</span> {e.label}
                <span style={{ color: "var(--color-ink-muted)" }}> @{e.focus}</span>
                {" → "}
                {e.result.ok ? (
                  <span>{show(e.result.value)}</span>
                ) : (
                  <span className="vx-chip" data-state="error">
                    {e.result.error.code}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ol>
        <p style={{ marginBottom: 0 }}>
          Result at {origin}:{" "}
          {final.ok ? (
            <span className="vx-chip" data-state="ok">
              {show(final.value)}
            </span>
          ) : (
            <>
              <a className="vx-chip" data-state="error" href={errorHref(final.error.code)}>
                {final.error.code}
              </a>{" "}
              <span className="vx-muted">{final.error.message}</span>
            </>
          )}
        </p>
      </div>
      <table className="vx-table" aria-label="The result at each origin">
        <thead>
          <tr>
            <th scope="col">origin</th>
            {KEYS.map((k) => (
              <th key={k} scope="col">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">result</th>
            {view.all.map(({ key: k, result }) => (
              <td key={k} className={result.ok ? (k === origin ? "vx-cell-focus" : undefined) : "vx-cell-error"}>
                {showResult(result)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </section>
  );
}
