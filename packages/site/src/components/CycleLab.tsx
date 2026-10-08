/**
 * The cycle lab: four columns of a sheet over one key. Each column adds its own number and the cells that it
 * reads. The reader selects the reads in a grid, and can put `ifError(0)` around the reads of a column. Each cell
 * on a cycle gives `#CYCLE!`, also behind `ifError`. A cell that only reads a cycle can catch the error.
 */
import { app, cell, lit, space, SheetRun, type Expr } from "@vex/core";
import { NumDomain } from "@vex/domains";
import { useMemo, useState, type ReactElement } from "react";

const COLUMNS = ["a", "b", "c", "d"] as const;
type Column = (typeof COLUMNS)[number];
const BASE: Readonly<Record<Column, number>> = { a: 1, b: 2, c: 3, d: 4 };
const SPACE = space.record({ row: {} });

type Reads = Readonly<Record<Column, readonly Column[]>>;

const START: Reads = { a: ["b"], b: ["a"], c: ["a"], d: [] };
const START_CATCH: Readonly<Record<Column, boolean>> = { a: false, b: false, c: true, d: false };

/** This function gives the program of a column: its number, plus each cell that it reads. */
function formula(col: Column, reads: Reads, caught: boolean): Expr {
  return reads[col].reduce<Expr>((acc, other) => app("add", acc, caught ? app("ifError", cell(other), lit(0)) : cell(other)), lit(BASE[col]));
}

/** This function gives the text of the formula of a column. */
function formulaText(col: Column, reads: Reads, caught: boolean): string {
  return [String(BASE[col]), ...reads[col].map((o) => (caught ? `ifError(${o}, 0)` : o))].join(" + ");
}

const POS: Readonly<Record<Column, { readonly x: number; readonly y: number }>> = {
  a: { x: 60, y: 40 },
  b: { x: 200, y: 40 },
  c: { x: 60, y: 150 },
  d: { x: 200, y: 150 },
};

/** The cycle lab. */
export default function CycleLab(): ReactElement {
  const [reads, setReads] = useState<Reads>(START);
  const [caught, setCaught] = useState<Readonly<Record<Column, boolean>>>(START_CATCH);

  const results = useMemo(() => {
    const columns = new Map(COLUMNS.map((c) => [c, formula(c, reads, caught[c])]));
    const run = new SheetRun(columns, { space: SPACE, domains: [NumDomain] });
    return Object.fromEntries(COLUMNS.map((c) => [c, run.cell(c, "row")])) as Readonly<Record<Column, ReturnType<SheetRun["cell"]>>>;
  }, [reads, caught]);

  const toggle = (from: Column, to: Column): void =>
    setReads((r) => ({ ...r, [from]: r[from].includes(to) ? r[from].filter((x) => x !== to) : [...r[from], to].toSorted() }));

  const cyclic = (c: Column): boolean => {
    const r = results[c];
    return !r.ok && r.error.code === "#CYCLE!";
  };

  return (
    <section className="vx-frame" aria-label="The cycle lab">
      <header>
        <strong>Draw the reads, find the cycles</strong>
        <button
          type="button"
          className="vx-button"
          onClick={() => {
            setReads(START);
            setCaught(START_CATCH);
          }}
        >
          Reset
        </button>
      </header>
      <div className="vx-body vx-row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
        <svg viewBox="0 0 260 190" width="260" height="190" role="img" aria-label="The columns, with an arrow for each read">
          <defs>
            <marker id="vx-cycle-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-ink-muted)" />
            </marker>
          </defs>
          {COLUMNS.flatMap((from) =>
            reads[from].map((to) => {
              const a = POS[from];
              const b = POS[to];
              if (from === to) {
                return <circle key={`${from}-${to}`} cx={a.x} cy={a.y - 26} r={12} fill="none" stroke="currentColor" strokeWidth={1.5} />;
              }
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const len = Math.hypot(dx, dy);
              const ux = dx / len;
              const uy = dy / len;
              // Two arrows between the same columns curve to different sides.
              const bend = 10;
              const mx = (a.x + b.x) / 2 - uy * bend;
              const my = (a.y + b.y) / 2 + ux * bend;
              return (
                <path
                  key={`${from}-${to}`}
                  d={`M ${a.x + ux * 22} ${a.y + uy * 22} Q ${mx} ${my} ${b.x - ux * 24} ${b.y - uy * 24}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  markerEnd="url(#vx-cycle-arrow)"
                />
              );
            }),
          )}
          {COLUMNS.map((c) => (
            <g key={c}>
              <circle cx={POS[c].x} cy={POS[c].y} r={20} fill={cyclic(c) ? "var(--color-mark)" : "var(--color-surface)"} stroke="currentColor" strokeWidth={2} />
              <text x={POS[c].x} y={POS[c].y + 5} textAnchor="middle" fontWeight={700} fill={cyclic(c) ? "white" : "currentColor"}>
                {c}
              </text>
            </g>
          ))}
        </svg>
        <table className="vx-table" aria-label="The reads of each column">
          <thead>
            <tr>
              <th scope="col">reads</th>
              {COLUMNS.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
              <th scope="col">ifError</th>
            </tr>
          </thead>
          <tbody>
            {COLUMNS.map((from) => (
              <tr key={from}>
                <th scope="row">{from}</th>
                {COLUMNS.map((to) => (
                  <td key={to}>
                    <input type="checkbox" aria-label={`${from} reads ${to}`} checked={reads[from].includes(to)} onChange={() => toggle(from, to)} />
                  </td>
                ))}
                <td>
                  <input type="checkbox" aria-label={`${from} catches errors`} checked={caught[from]} onChange={() => setCaught((x) => ({ ...x, [from]: !x[from] }))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <table className="vx-table" aria-label="The cells">
        <tbody>
          {COLUMNS.map((c) => {
            const r = results[c];
            return (
              <tr key={c}>
                <th scope="row">{c}</th>
                <td>
                  <code>{formulaText(c, reads, caught[c])}</code>
                </td>
                <td className={r.ok ? undefined : "vx-cell-error"} data-testid={`cell-${c}`}>
                  {r.ok ? String(r.value) : r.error.code}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
