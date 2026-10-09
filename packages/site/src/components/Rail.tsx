/**
 * The Optional rail. Each node of the trace is a station, in the order that the nodes finish. A value rides
 * the top track. A node that gives an error is on the bottom track, and the station where an error starts has
 * a signpost with the error code. An error moves up the tree, so later stations stay on the bottom track until
 * a node catches the error.
 */
import { explain, type TraceEvent } from "@mark1russell7/vex";
import { useMemo, useState, type ReactElement } from "react";
import { errorHref, show } from "../lib/format.ts";
import { ERROR_PROGRAMS, PROGRAMS, programById } from "../lib/programs.ts";
import { DOMAINS, rootOf, spaceOf, useBoxes, type BoxKey } from "../lib/specimen.ts";

const GAP = 56;
const TOP = 40;
const BOTTOM = 110;

/** This function tells if an event is the place where its error started: the error path is the event path. */
const startsError = (e: TraceEvent): boolean => !e.result.ok && e.result.error.path.join(".") === e.path.join(".");

/** The rail. */
export default function Rail(props: { readonly program?: string; readonly origin?: BoxKey }): ReactElement {
  const boxes = useBoxes();
  const choices = [...PROGRAMS.slice(0, 4), ...Object.values(ERROR_PROGRAMS)];
  const [id, setId] = useState(props.program ?? "na");
  const [origin, setOrigin] = useState<BoxKey>(props.origin ?? "A");
  const program = programById(id);

  const events = useMemo(() => {
    if (program === undefined) return [];
    const t = explain(program.build(rootOf(boxes)), { space: spaceOf(boxes), origin, domains: DOMAINS, ...(program.fns === undefined ? {} : { fns: program.fns }) });
    return t.events;
  }, [program, boxes, origin]);

  const width = Math.max(320, events.length * GAP + 40);
  const y = (e: TraceEvent): number => (e.result.ok ? TOP : BOTTOM);
  const final = events.at(-1);

  return (
    <section className="vx-frame" aria-label="The Optional rail">
      <header>
        <strong>The Optional rail</strong>
        <span className="vx-row">
          <select className="vx-button" value={id} onChange={(e) => setId(e.target.value)} aria-label="Program">
            {choices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          {(["A", "B", "C", "D"] as const).map((k) => (
            <button key={k} type="button" className="vx-button" aria-pressed={k === origin} onClick={() => setOrigin(k)}>
              {k}
            </button>
          ))}
        </span>
      </header>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${width} 170`} style={{ width: `${width}px`, maxWidth: "none", display: "block" }} role="img" aria-label={`The rail of ${events.length} nodes. ${final?.result.ok === false ? `The result is the error ${final.result.error.code}.` : "The result is a value."}`}>
          <line x1={10} y1={TOP} x2={width - 10} y2={TOP} stroke="var(--color-rule-strong)" strokeWidth={6} strokeLinecap="round" />
          <line x1={10} y1={BOTTOM} x2={width - 10} y2={BOTTOM} stroke="var(--color-mark-wash)" strokeWidth={6} strokeLinecap="round" />
          <text x={12} y={TOP - 14} fontSize={11} fill="var(--color-ink-muted)">value</text>
          <text x={12} y={BOTTOM + 24} fontSize={11} fill="var(--color-mark)">error</text>
          {events.map((e, i) => {
            const x = 30 + i * GAP;
            const prev = events[i - 1];
            return (
              <g key={i}>
                {prev === undefined ? null : <line x1={30 + (i - 1) * GAP} y1={y(prev)} x2={x} y2={y(e)} stroke={e.result.ok ? "var(--color-accent)" : "var(--color-mark)"} strokeWidth={2.5} />}
                <circle cx={x} cy={y(e)} r={7} fill={e.result.ok ? "var(--color-accent)" : "var(--color-mark)"}>
                  <title>{`${e.tag} ${e.label} at ${e.focus}: ${e.result.ok ? show(e.result.value) : `${e.result.error.code} ${e.result.error.message}`}`}</title>
                </circle>
                <text x={x} y={y(e) === TOP ? TOP + 24 : BOTTOM - 16} fontSize={10} textAnchor="middle" fontFamily="var(--font-mono)" fill="var(--color-ink-secondary)">
                  {e.label.length > 8 ? `${e.label.slice(0, 7)}…` : e.label}
                </text>
                {startsError(e) && !e.result.ok ? (
                  <g>
                    <line x1={x} y1={BOTTOM + 8} x2={x} y2={BOTTOM + 36} stroke="var(--color-mark)" />
                    <text x={x + 4} y={BOTTOM + 48} fontSize={11} fontFamily="var(--font-mono)" fill="var(--color-mark)">{e.result.error.code}</text>
                  </g>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
      {program === undefined ? null : <pre className="vx-code">{program.code}</pre>}
      <p className="vx-body" style={{ margin: 0 }}>
        Result at {origin}:{" "}
        {final === undefined ? null : final.result.ok ? (
          <span className="vx-chip" data-state="ok">{show(final.result.value)}</span>
        ) : (
          <a className="vx-chip" data-state="error" href={errorHref(final.result.error.code)}>{final.result.error.code}</a>
        )}
      </p>
    </section>
  );
}
